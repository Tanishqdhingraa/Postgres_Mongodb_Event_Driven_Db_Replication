const { Kafka, Partitioners } = require('kafkajs');
const createLogger = require('../logger');
const { DLQ_SUFFIX } = require('../constants');

class KafkaClient {
  constructor({ clientId, brokers, serviceName }) {
    this.logger = createLogger(serviceName || clientId);
    this.kafka = new Kafka({
      clientId,
      brokers: brokers ? brokers.split(',') : ['localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 5
      }
    });
    this.producer = null;
    this.consumers = [];
  }

  async connectProducer() {
    if (this.producer) return this.producer;

    try {
      this.logger.info('Connecting Kafka Producer...');
      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner
      });
      await this.producer.connect();
      this.logger.info('Kafka Producer connected successfully.');
      return this.producer;
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
      throw error;
    }
  }

  async publish(topic, eventType, data, key = null) {
    if (!this.producer) {
      await this.connectProducer();
    }

    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString()
    };

    try {
      this.logger.debug(`Publishing event to topic ${topic}`, { eventType, key });
      await this.producer.send({
        topic,
        messages: [
          {
            key: key ? String(key) : null,
            value: JSON.stringify(payload)
          }
        ]
      });
    } catch (error) {
      this.logger.error(`Error publishing event to topic ${topic}`, { error, payload });
      throw error;
    }
  }

  async subscribe({ groupId, topics, onMessage, maxRetries = 3 }) {
    const consumer = this.kafka.consumer({ groupId });
    this.consumers.push(consumer);

    try {
      this.logger.info(`Connecting Kafka Consumer for group: ${groupId}...`);
      await consumer.connect();
      this.logger.info(`Kafka Consumer connected for group: ${groupId}`);

      for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
        this.logger.info(`Consumer subscribed to topic: ${topic}`);
      }

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const valueStr = message.value ? message.value.toString() : null;
          const keyStr = message.key ? message.key.toString() : null;
          this.logger.debug(`Received message from ${topic}`, { partition, offset: message.offset, key: keyStr });

          let payload = null;
          try {
            payload = JSON.parse(valueStr);
          } catch (err) {
            this.logger.error('Failed to parse Kafka message JSON payload', { raw: valueStr, error: err.message });
            // Send unparseable message directly to DLQ
            await this.sendToDLQ(topic, keyStr, valueStr, 'Invalid JSON payload', err.message);
            return;
          }

          let attempt = 0;
          while (attempt <= maxRetries) {
            try {
              // Call the provided onMessage handler
              await onMessage({ topic, partition, message: payload, key: keyStr });
              // If success, break the retry loop
              break;
            } catch (err) {
              attempt++;
              this.logger.warn(`Error processing message on topic ${topic} (attempt ${attempt}/${maxRetries + 1})`, {
                error: err.message,
                key: keyStr,
                offset: message.offset
              });

              if (attempt > maxRetries) {
                this.logger.error(`Failed to process message after ${maxRetries} retries. Routing to DLQ...`, {
                  topic,
                  offset: message.offset,
                  error: err.stack
                });
                await this.sendToDLQ(topic, keyStr, valueStr, err.message, err.stack);
              } else {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 200;
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to initialize consumer group ${groupId}`, error);
      throw error;
    }
  }

  async sendToDLQ(originalTopic, key, rawValue, errorMessage, errorStack) {
    const dlqTopic = `${originalTopic}${DLQ_SUFFIX}`;
    this.logger.info(`Sending message to Dead Letter Queue: ${dlqTopic}`);

    try {
      if (!this.producer) {
        await this.connectProducer();
      }

      await this.producer.send({
        topic: dlqTopic,
        messages: [
          {
            key: key ? String(key) : null,
            value: rawValue,
            headers: {
              'x-original-topic': originalTopic,
              'x-error-message': errorMessage,
              'x-error-stack': errorStack,
              'x-failed-at': new Date().toISOString()
            }
          }
        ]
      });
      this.logger.info(`Successfully routed failed message to DLQ topic: ${dlqTopic}`);
    } catch (dlqError) {
      this.logger.error(`CRITICAL: Failed to publish message to DLQ topic ${dlqTopic}!`, dlqError);
    }
  }

  async disconnect() {
    this.logger.info('Disconnecting Kafka connections...');
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.info('Kafka Producer disconnected.');
    }
    for (const consumer of this.consumers) {
      await consumer.disconnect();
      this.logger.info('Kafka Consumer disconnected.');
    }
  }
}

module.exports = KafkaClient;

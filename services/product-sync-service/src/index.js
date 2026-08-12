require('dotenv').config();
const mongoose = require('mongoose');
const { KafkaClient, TOPICS, EVENTS } = require('shared');
const createLogger = require('shared').createLogger;
const Product = require('./models/productModel');

const logger = createLogger('product-sync-service');

let kafkaClient;

async function handleMessage({ topic, message, key }) {
  const { eventType, data } = message;
  logger.info(`Received event: ${eventType} for Product ID: ${key || data.id}`);

  switch (eventType) {
    case EVENTS.PRODUCT.CREATED:
    case EVENTS.PRODUCT.UPDATED:
      await Product.findOneAndUpdate(
        { _id: data.id },
        {
          name: data.name,
          price: parseFloat(data.price),
          description: data.description,
          inventory_count: parseInt(data.inventory_count || 0),
          created_at: data.created_at,
          updated_at: data.updated_at
        },
        { upsert: true, new: true, runValidators: true }
      );
      logger.info(`Successfully synchronized product: ${data.id}`);
      break;

    case EVENTS.PRODUCT.DELETED:
      await Product.deleteOne({ _id: data.id });
      logger.info(`Successfully deleted product: ${data.id}`);
      break;

    default:
      logger.warn(`Unhandled event type: ${eventType}`);
  }
}

async function start() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/replica_db';
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully.');

    kafkaClient = new KafkaClient({
      clientId: 'product-sync-service',
      brokers: process.env.KAFKA_BROKERS,
      serviceName: 'product-sync-service'
    });

    await kafkaClient.subscribe({
      groupId: 'product-sync-group',
      topics: [TOPICS.PRODUCT],
      onMessage: handleMessage,
      maxRetries: 3
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      if (kafkaClient) {
        await kafkaClient.disconnect();
      }
      logger.info('Closing MongoDB connection...');
      await mongoose.disconnect();
      logger.info('MongoDB connection closed.');
      logger.info('Graceful shutdown completed. Exiting.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start Product Sync Service', error);
    process.exit(1);
  }
}

start();

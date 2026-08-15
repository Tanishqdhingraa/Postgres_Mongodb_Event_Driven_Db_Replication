require('dotenv').config();
const mongoose = require('mongoose');
const { KafkaClient, TOPICS, EVENTS } = require('shared');
const createLogger = require('shared').createLogger;
const User = require('./models/userModel');

const logger = createLogger('user-sync-service');

let kafkaClient;

async function handleMessage({ topic, message, key }) {
  const { eventType, data } = message;
  logger.info(`Received event: ${eventType} for User ID: ${key || data.id}`);

  switch (eventType) {
    case EVENTS.USER.CREATED:
    case EVENTS.USER.UPDATED:
      // Upsert: prevent duplicate records by using PostgreSQL ID as _id
      await User.findOneAndUpdate(
        { _id: data.id },
        {
          name: data.name,
          email: data.email,
          created_at: data.created_at,
          updated_at: data.updated_at
        },
        { upsert: true, new: true, runValidators: true }
      );
      logger.info(`Successfully synchronized user: ${data.id}`);
      break;

    case EVENTS.USER.DELETED:
      await User.deleteOne({ _id: data.id });
      logger.info(`Successfully deleted user: ${data.id}`);
      break;

    default:
      logger.warn(`Unhandled event type: ${eventType}`);
  }
}

async function start() {
  try {
    // 1. Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/replica_db';
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully.');

    // 2. Initialize Kafka Consumer
    kafkaClient = new KafkaClient({
      clientId: 'user-sync-service',
      brokers: process.env.KAFKA_BROKERS,
      serviceName: 'user-sync-service'
    });

    await kafkaClient.subscribe({
      groupId: 'user-sync-group',
      topics: [TOPICS.USER],
      onMessage: handleMessage,
      maxRetries: 3
    });

    // Graceful Shutdown
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
    logger.error('Failed to start User Sync Service', error);
    process.exit(1);
  }
}

start();

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const createLogger = require('shared').createLogger;

const User = require('./models/userModel');
const Product = require('./models/productModel');
const Order = require('./models/orderModel');

const logger = createLogger('api-gateway');
const app = express();
const port = process.env.PORT || 3000;
const extractorServiceUrl = process.env.EXTRACTOR_SERVICE_URL || 'http://localhost:3001';

app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// Proxy helper for write operations
const forwardToExtractor = async (req, res) => {
  const targetUrl = `${extractorServiceUrl}${req.url.replace('/api', '')}`;
  logger.info(`Routing write operation ${req.method} ${req.url} -> ${targetUrl}`);

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true // Allow handling non-200 responses inside the block
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error(`Failed to forward write request to Extractor Service: ${error.message}`);
    res.status(502).json({ error: 'Extractor Service unavailable (Bad Gateway)' });
  }
};

// WRITE operations: Proxy to PostgreSQL-backed Extractor Service
app.post('/api/users', forwardToExtractor);
app.put('/api/users/:id', forwardToExtractor);
app.delete('/api/users/:id', forwardToExtractor);

app.post('/api/products', forwardToExtractor);
app.put('/api/products/:id', forwardToExtractor);
app.delete('/api/products/:id', forwardToExtractor);

app.post('/api/orders', forwardToExtractor);
app.put('/api/orders/:id', forwardToExtractor);
app.delete('/api/orders/:id', forwardToExtractor);


// READ operations: Query MongoDB directly (Read replica)
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find().sort({ _id: 1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

app.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found in replica' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const products = await Product.find().sort({ _id: 1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found in replica' });
    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', async (req, res, next) => {
  try {
    // Populate user and product info to demonstrate MongoDB enrichment/analytics capabilities
    const orders = await Order.find()
      .populate('user_id')
      .populate('product_id')
      .sort({ _id: 1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user_id')
      .populate('product_id');
    if (!order) return res.status(404).json({ error: 'Order not found in replica' });
    res.json(order);
  } catch (error) {
    next(error);
  }
});


// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'UP',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    mongodb: 'disconnected',
    extractorService: 'disconnected'
  };

  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      health.mongodb = 'connected';
    }

    // Check Extractor Service
    const extHealth = await axios.get(`${extractorServiceUrl}/health`, { timeout: 1000 });
    if (extHealth.status === 200) {
      health.extractorService = 'connected';
    }
  } catch (err) {
    health.status = 'DEGRADED';
    health.extractorService = `error: ${err.message}`;
  }

  const statusCode = health.status === 'UP' ? 200 : 207;
  res.status(statusCode).json(health);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Gateway request error', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function start() {
  try {
    // Connect MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/replica_db';
    logger.info('Connecting to MongoDB Read Replica...');
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully.');

    const server = app.listen(port, () => {
      logger.info(`API Gateway listening on port ${port}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Graceful shutdown started...`);
      server.close(() => {
        logger.info('HTTP server closed.');
      });
      logger.info('Closing MongoDB connection...');
      await mongoose.disconnect();
      logger.info('MongoDB connection closed.');
      logger.info('Graceful shutdown completed. Exiting.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start API Gateway', error);
    process.exit(1);
  }
}

start();

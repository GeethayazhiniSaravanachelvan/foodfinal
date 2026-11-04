const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');

// Connect to MongoDB Atlas / Local MongoDB
connectDB();

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploaded static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint (checks MongoDB connection state)
app.get('/api/health', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  res.status(isDbReady ? 200 : 503).json({
    status: isDbReady ? 'ok' : 'initializing',
    database: isDbReady ? 'connected' : 'connecting',
    message: isDbReady
      ? 'Foodshare Backend API is running.'
      : 'Foodshare Backend is starting up (connecting to database)...',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Guard mutations if database is still establishing connection
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is still initializing. Please retry in a few seconds.',
    });
  }
  next();
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/listings', require('./routes/listingRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/matching', require('./routes/matchingRoutes'));
app.use('/api/integrity', require('./routes/integrityRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/impact', require('./routes/impactRoutes'));

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.originalUrl} not found.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Foodshare Server] Running on http://localhost:${PORT}`);
  console.log(`[Foodshare Server] Health check available at http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Foodshare Server] Port ${PORT} is already in use by another process.`);
  } else {
    console.error('[Foodshare Server] Startup error:', err.message);
  }
});

module.exports = app;


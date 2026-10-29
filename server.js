// server.js
// The entry point: sets up Express, connects to MongoDB, and starts listening.
require('dotenv').config(); // loads values from the .env file into process.env

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Hide the "X-Powered-By: Express" header
app.disable('x-powered-by');

// Read JSON request bodies (limited to 10 KB so nobody sends huge data)
app.use(express.json({ limit: '10kb' }));

// Serve the frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Health check: handy to see if the server and database are running
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? 'ok' : 'database disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Anything else under /api is a 404, then the central error handler runs
app.use('/api', notFound);
app.use(errorHandler);

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing. Create a .env file (see .env.example).');
    process.exit(1);
  }

  try {
    await connectDB();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
  } catch (error) {
    console.error('Could not start the server:', error.message);
    process.exit(1);
  }
};

// Start only when this file is run directly (not when imported for tests)
if (require.main === module) {
  startServer();
}

module.exports = app;

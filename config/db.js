// config/db.js
// Connects our app to MongoDB using Mongoose.
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing. Create a .env file (see .env.example).');
  }

  await mongoose.connect(uri);

  // We print only the host and database name, never the full URI,
  // because the URI may contain a username and password.
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

module.exports = connectDB;

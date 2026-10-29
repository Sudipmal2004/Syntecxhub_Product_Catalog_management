// middleware/authMiddleware.js
// Protects routes so only logged-in users can use them.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('./errorMiddleware');

// Expects a header like:  Authorization: Bearer <token>
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    throw new AppError(401, 'Not authorized. Please log in.');
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new AppError(401, 'Invalid or expired token. Please log in again.');
  }

  // Make sure the user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError(401, 'The user for this token no longer exists.');
  }

  req.user = user; // later code can read req.user
  next();
});

module.exports = { protect };

// controllers/authController.js
// Handles registration, login, and "who am I?".
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');

// Create a signed token that proves who the user is.
// It only contains the user's id, never the password.
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Safe user data to send back to the browser
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(409, 'Email is already registered');
  }

  // The password is hashed automatically by the pre-save hook in models/User.js
  const user = await User.create({ name, email, password });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    token: generateToken(user._id),
    user: publicUser(user),
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password has select:false, so we must ask for it explicitly
  const user = await User.findOne({ email }).select('+password');

  // Same message for "no such user" and "wrong password",
  // so attackers cannot find out which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Invalid email or password');
  }

  res.json({
    success: true,
    message: 'Login successful',
    token: generateToken(user._id),
    user: publicUser(user),
  });
});

// GET /api/auth/me  (protected)
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

module.exports = { register, login, getMe };

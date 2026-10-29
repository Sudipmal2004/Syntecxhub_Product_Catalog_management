// middleware/errorMiddleware.js
// Helpers for handling errors in one central place.

// A small custom error that carries an HTTP status code.
// Example: throw new AppError(404, 'Product not found');
class AppError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional list of detailed messages
    this.isOperational = true; // means: "we expected this error, safe to show the message"
  }
}

// Wraps async route handlers so any error is passed to the error handler.
// Without this, a rejected promise would not reach our error middleware.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Runs when no route matched an /api URL.
const notFound = (req, res, next) => {
  next(new AppError(404, 'API route not found'));
};

// The central error handler. Express recognises it because it has 4 parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message;
  let errors = err.errors;

  if (err.name === 'ValidationError') {
    // Mongoose validation failed (e.g. price is negative)
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    // Wrong data type, e.g. an invalid ObjectId
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    // Duplicate key (unique index), e.g. email already registered
    statusCode = 409;
    message = err.keyPattern && err.keyPattern.email
      ? 'Email is already registered'
      : 'A record with this value already exists';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token. Please log in again.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  } else if (!err.isOperational) {
    // Something unexpected. Log the details on the SERVER only,
    // and send a generic message to the client (no stack traces, no secrets).
    console.error('Unexpected error:', err);
    statusCode = 500;
    message = 'Something went wrong on the server. Please try again later.';
    errors = undefined;
  }

  const body = { success: false, message };
  if (errors && errors.length) body.errors = errors;

  res.status(statusCode).json(body);
};

module.exports = { AppError, asyncHandler, notFound, errorHandler };

// middleware/validateMiddleware.js
// Checks and cleans incoming data BEFORE it reaches the controllers.
// Mongoose validation (in the models) is a second safety net.
const { AppError } = require('./errorMiddleware');

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitize text: remove HTML tags and control characters, then trim spaces.
// This helps stop people from saving <script> tags in the database.
const cleanText = (value) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

// Make sure the :id in the URL is a valid MongoDB ObjectId.
const validateObjectId = (req, res, next) => {
  if (!OBJECT_ID_PATTERN.test(req.params.id)) {
    return next(new AppError(400, 'Invalid product ID'));
  }
  next();
};

// Validates the body for creating (isCreate = true) or updating a product.
// On success, req.body is replaced with a clean object that contains ONLY the allowed fields.
const validateProductBody = (isCreate) => (req, res, next) => {
  const body = req.body || {};
  const errors = [];
  const clean = {};

  const textFields = {
    name: 'Product name',
    description: 'Product description',
    category: 'Category',
    brand: 'Brand',
  };

  for (const [field, label] of Object.entries(textFields)) {
    if (body[field] === undefined) {
      if (isCreate) errors.push(`${label} is required`);
      continue;
    }
    if (typeof body[field] !== 'string') {
      errors.push(`${label} must be text`);
      continue;
    }
    const value = cleanText(body[field]);
    if (!value) errors.push(`${label} cannot be empty`);
    else clean[field] = value;
  }

  // Price
  if (body.price === undefined) {
    if (isCreate) errors.push('Price is required');
  } else {
    const price = typeof body.price === 'string' && body.price.trim() === '' ? NaN : Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('Price must be a number that is 0 or more');
    else clean.price = price;
  }

  // Stock
  if (body.stock === undefined) {
    if (isCreate) clean.stock = 0; // default
  } else {
    const stock = typeof body.stock === 'string' && body.stock.trim() === '' ? NaN : Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) errors.push('Stock must be a whole number that is 0 or more');
    else clean.stock = stock;
  }

  // Image URL (optional)
  if (body.imageUrl !== undefined) {
    if (typeof body.imageUrl !== 'string') {
      errors.push('Image URL must be text');
    } else {
      const url = body.imageUrl.trim();
      if (url) {
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
          clean.imageUrl = url;
        } catch (error) {
          errors.push('Image URL must be a valid http:// or https:// link');
        }
      } else {
        clean.imageUrl = '';
      }
    }
  }

  if (errors.length) {
    return next(new AppError(400, 'Validation failed', errors));
  }
  if (Object.keys(clean).length === 0) {
    return next(new AppError(400, 'No valid fields were provided'));
  }

  req.body = clean;
  next();
};

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body || {};
  const errors = [];

  // typeof checks also block NoSQL injection such as { "email": { "$gt": "" } }
  if (typeof name !== 'string' || cleanText(name).length < 2 || cleanText(name).length > 50) {
    errors.push('Name must be between 2 and 50 characters');
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    errors.push('Please enter a valid email address');
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    errors.push('Password must be between 6 and 72 characters');
  }

  if (errors.length) return next(new AppError(400, 'Validation failed', errors));

  req.body = { name: cleanText(name), email: email.trim().toLowerCase(), password };
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return next(new AppError(400, 'Email and password are required'));
  }

  req.body = { email: email.trim().toLowerCase(), password };
  next();
};

module.exports = { validateObjectId, validateProductBody, validateRegister, validateLogin };

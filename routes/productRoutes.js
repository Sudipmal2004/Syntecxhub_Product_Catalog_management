// routes/productRoutes.js
// URLs starting with /api/products
const express = require('express');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getFilterOptions,
  getCategoryStats,
  getSummaryStats,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectId, validateProductBody } = require('../middleware/validateMiddleware');

const router = express.Router();

// IMPORTANT: routes with fixed words (stats, meta) come BEFORE '/:id',
// otherwise Express could treat "stats" as an id.
router.get('/stats/categories', getCategoryStats);
router.get('/stats/summary', getSummaryStats);
router.get('/meta/filters', getFilterOptions);

// Public: anyone can view products
router.get('/', getProducts);
router.get('/:id', validateObjectId, getProductById);

// Protected: you must be logged in (valid JWT) to change products
router.post('/', protect, validateProductBody(true), createProduct);
router.put('/:id', protect, validateObjectId, validateProductBody(false), updateProduct);
router.delete('/:id', protect, validateObjectId, deleteProduct);

module.exports = router;

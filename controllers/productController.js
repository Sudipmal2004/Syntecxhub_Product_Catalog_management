// controllers/productController.js
// All the logic for products: CRUD, search, filtering, pagination, statistics.
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');

/* ---------- Small helper functions ---------- */

// Query values should be plain text. If someone sends ?search[$ne]=x or
// ?search=a&search=b, we ignore anything that is not a single string.
const asString = (value) => (typeof value === 'string' ? value.trim() : '');

// Escape special regex characters so "c++" or "(test" is searched as plain text.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Convert a query value to a number, or throw a 400 error if it is not a number.
const parsePrice = (value, label) => {
  const text = asString(value);
  if (text === '') return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(400, `${label} must be a number that is 0 or more`);
  }
  return number;
};

// Only these fields may be used for sorting (prevents sorting by random fields)
const SORTABLE_FIELDS = ['name', 'price', 'stock', 'category', 'brand', 'createdAt', 'updatedAt'];

/* ---------- Products ---------- */

// GET /api/products
// Supports: search, category, brand, minPrice, maxPrice, page, limit, sortBy, order
const getProducts = asyncHandler(async (req, res) => {
  const { search, category, brand, minPrice, maxPrice, page, limit, sortBy, order } = req.query;

  // 1. Build the filter. Every filter we add narrows the results.
  const filter = {};

  const searchText = asString(search);
  if (searchText) {
    // Case-insensitive search in the product name OR category
    const pattern = new RegExp(escapeRegex(searchText), 'i');
    filter.$or = [{ name: pattern }, { category: pattern }];
  }

  const categoryText = asString(category);
  if (categoryText) {
    // ^...$ means "exact match", 'i' means "ignore upper/lower case"
    filter.category = new RegExp(`^${escapeRegex(categoryText)}$`, 'i');
  }

  const brandText = asString(brand);
  if (brandText) {
    filter.brand = new RegExp(`^${escapeRegex(brandText)}$`, 'i');
  }

  const min = parsePrice(minPrice, 'minPrice');
  const max = parsePrice(maxPrice, 'maxPrice');
  if (min !== null && max !== null && min > max) {
    throw new AppError(400, 'minPrice cannot be greater than maxPrice');
  }
  if (min !== null || max !== null) {
    filter.price = {};
    if (min !== null) filter.price.$gte = min;
    if (max !== null) filter.price.$lte = max;
  }

  // 2. Sorting (default: newest first)
  const sortField = SORTABLE_FIELDS.includes(asString(sortBy)) ? asString(sortBy) : 'createdAt';
  const sortDirection = asString(order).toLowerCase() === 'asc' ? 1 : -1;
  // _id is a tie-breaker so pages never repeat or skip products with equal values
  const sort = { [sortField]: sortDirection, _id: 1 };

  // 3. Pagination (page starts at 1, limit is between 1 and 50)
  const pageNumber = Math.max(parseInt(asString(page), 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(asString(limit), 10) || 10, 1), 50);
  const skip = (pageNumber - 1) * pageSize;

  // 4. Ask MongoDB for the products AND the total count (using the SAME filter)
  const [products, totalProducts] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(pageSize).lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProducts / pageSize);

  res.json({
    success: true,
    count: products.length,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      totalProducts,
      totalPages,
      hasPrevPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    },
    data: products,
  });
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new AppError(404, 'Product not found');

  res.json({ success: true, data: product });
});

// POST /api/products  (protected)
const createProduct = asyncHandler(async (req, res) => {
  // req.body was already cleaned by validateProductBody
  const product = await Product.create({ ...req.body, createdBy: req.user._id });

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: product,
  });
});

// PUT /api/products/:id  (protected)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError(404, 'Product not found');

  product.set(req.body);
  await product.save(); // save() runs the model validation and updates updatedAt

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: product,
  });
});

// DELETE /api/products/:id  (protected)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError(404, 'Product not found');

  res.json({ success: true, message: 'Product deleted successfully' });
});

// GET /api/products/meta/filters
// Lists all categories and brands so the frontend can fill its dropdowns.
const getFilterOptions = asyncHandler(async (req, res) => {
  const [categories, brands] = await Promise.all([
    Product.distinct('category'),
    Product.distinct('brand'),
  ]);

  const alphabetical = (a, b) => a.localeCompare(b);
  res.json({
    success: true,
    data: { categories: categories.sort(alphabetical), brands: brands.sort(alphabetical) },
  });
});

/* ---------- Statistics (MongoDB aggregation) ---------- */

// GET /api/products/stats/categories
// For each category: how many products, average/min/max price, total stock.
const getCategoryStats = asyncHandler(async (req, res) => {
  const stats = await Product.aggregate([
    {
      $group: {
        _id: '$category', // group all products that share a category
        productCount: { $sum: 1 },
        averagePrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalStock: { $sum: '$stock' },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        productCount: 1,
        averagePrice: { $round: ['$averagePrice', 2] },
        minPrice: 1,
        maxPrice: 1,
        totalStock: 1,
      },
    },
    { $sort: { productCount: -1, category: 1 } },
  ]);

  res.json({ success: true, count: stats.length, data: stats });
});

// GET /api/products/stats/summary
// Overall numbers: total products, total stock, average price,
// highest-priced and lowest-priced product.
const getSummaryStats = asyncHandler(async (req, res) => {
  const [summary] = await Product.aggregate([
    { $sort: { price: -1, _id: 1 } }, // most expensive first
    {
      $group: {
        _id: null, // null = put ALL products in one group
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        averagePrice: { $avg: '$price' },
        inventoryValue: { $sum: { $multiply: ['$price', '$stock'] } },
        // Because we sorted by price (high to low), the first product is the
        // highest-priced one and the last product is the lowest-priced one.
        highestPriced: { $first: { _id: '$_id', name: '$name', price: '$price', category: '$category' } },
        lowestPriced: { $last: { _id: '$_id', name: '$name', price: '$price', category: '$category' } },
      },
    },
    {
      $project: {
        _id: 0,
        totalProducts: 1,
        totalStock: 1,
        averagePrice: { $round: ['$averagePrice', 2] },
        inventoryValue: { $round: ['$inventoryValue', 2] },
        highestPriced: 1,
        lowestPriced: 1,
      },
    },
  ]);

  // If there are no products yet, return zeros instead of nothing
  const data = summary || {
    totalProducts: 0,
    totalStock: 0,
    averagePrice: 0,
    inventoryValue: 0,
    highestPriced: null,
    lowestPriced: null,
  };

  res.json({ success: true, data });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getFilterOptions,
  getCategoryStats,
  getSummaryStats,
};

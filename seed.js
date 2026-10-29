// seed.js
// Adds a demo user and sample products so the catalog is not empty.
//
//   npm run seed             -> only runs if there are NO products yet
//   npm run seed -- --force  -> deletes ALL existing products first, then re-adds the samples
//
// Demo login:  demo@example.com  /  password123
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const User = require('./models/User');

// Placeholder photos from picsum.photos (random pictures, not real product photos).
const image = (seed) => `https://picsum.photos/seed/${seed}/600/400`;

const sampleProducts = [
  // Electronics
  { name: 'Nova X5 Smartphone', description: '6.7-inch AMOLED display, 128 GB storage and a 50 MP camera. All-day battery with fast charging.', price: 24999, category: 'Electronics', brand: 'Nova', stock: 40, imageUrl: image('nova-x5') },
  { name: 'Pulse Wireless Earbuds', description: 'Active noise cancelling earbuds with 30 hours of total playtime and a compact charging case.', price: 3499, category: 'Electronics', brand: 'Pulse', stock: 120, imageUrl: image('pulse-buds') },
  { name: 'Orbit 14 Laptop', description: 'Lightweight 14-inch laptop with 16 GB RAM, 512 GB SSD and a bright full-HD screen.', price: 58999, category: 'Electronics', brand: 'Orbit', stock: 15, imageUrl: image('orbit-14') },
  { name: 'Nova Smart Watch', description: 'Track your steps, sleep and heart rate. Water resistant with a 7-day battery.', price: 6999, category: 'Electronics', brand: 'Nova', stock: 3, imageUrl: image('nova-watch') },
  { name: 'Pulse Bluetooth Speaker', description: 'Portable speaker with deep bass and 12 hours of battery. Splash-proof design.', price: 1999, category: 'Electronics', brand: 'Pulse', stock: 0, imageUrl: image('pulse-speaker') },
  // Fashion
  { name: 'Urban Denim Jacket', description: 'Classic mid-wash denim jacket with a comfortable regular fit.', price: 2499, category: 'Fashion', brand: 'UrbanWear', stock: 35, imageUrl: image('denim-jacket') },
  { name: 'Classic White Sneakers', description: 'Clean everyday sneakers with a cushioned sole and breathable lining.', price: 1799, category: 'Fashion', brand: 'Stride', stock: 60, imageUrl: image('white-sneakers') },
  { name: 'Cotton Crew T-Shirt (Pack of 3)', description: 'Soft 100% cotton t-shirts in three colours. Pre-shrunk and easy to wash.', price: 899, category: 'Fashion', brand: 'UrbanWear', stock: 200, imageUrl: image('tshirt-pack') },
  { name: 'Leather Bifold Wallet', description: 'Slim genuine leather wallet with six card slots and a coin pocket.', price: 799, category: 'Fashion', brand: 'Stride', stock: 4, imageUrl: image('leather-wallet') },
  // Home & Kitchen
  { name: 'Steel Pressure Cooker 5L', description: 'Durable stainless steel pressure cooker with a safety lid. Works on gas and induction.', price: 2199, category: 'Home & Kitchen', brand: 'HomeChef', stock: 25, imageUrl: image('pressure-cooker') },
  { name: 'Non-Stick Cookware Set', description: 'Set of 5 non-stick pans and pots with heat-resistant handles.', price: 3299, category: 'Home & Kitchen', brand: 'HomeChef', stock: 18, imageUrl: image('cookware-set') },
  { name: 'Aroma Desk Lamp', description: 'LED desk lamp with three brightness levels and a flexible neck.', price: 1299, category: 'Home & Kitchen', brand: 'Lumo', stock: 50, imageUrl: image('desk-lamp') },
  { name: 'Memory Foam Pillow', description: 'Ergonomic pillow that supports your neck. Removable, washable cover.', price: 999, category: 'Home & Kitchen', brand: 'Lumo', stock: 70, imageUrl: image('foam-pillow') },
  // Books
  { name: 'Learning JavaScript the Easy Way', description: 'A beginner-friendly guide to JavaScript with small projects in every chapter.', price: 549, category: 'Books', brand: 'PageTurner', stock: 90, imageUrl: image('js-book') },
  { name: 'Node.js in Practice', description: 'Build real REST APIs with Node, Express and MongoDB, step by step.', price: 699, category: 'Books', brand: 'PageTurner', stock: 45, imageUrl: image('node-book') },
  { name: 'The Daily Planner 2027', description: 'A5 planner with weekly layouts, habit tracker and goal pages.', price: 349, category: 'Books', brand: 'Inkwell', stock: 150, imageUrl: image('daily-planner') },
  // Sports
  { name: 'ProGrip Yoga Mat', description: 'Extra-thick non-slip yoga mat with a carry strap.', price: 799, category: 'Sports', brand: 'FitLife', stock: 80, imageUrl: image('yoga-mat') },
  { name: 'Adjustable Dumbbell Set', description: 'Adjustable dumbbells from 2 kg to 20 kg for full-body home workouts.', price: 4999, category: 'Sports', brand: 'FitLife', stock: 12, imageUrl: image('dumbbell-set') },
  { name: 'Trail Running Shoes', description: 'Lightweight running shoes with strong grip for roads and trails.', price: 3499, category: 'Sports', brand: 'Stride', stock: 5, imageUrl: image('running-shoes') },
  { name: 'Insulated Steel Bottle 1L', description: 'Keeps drinks cold for 24 hours and hot for 12 hours. Leak-proof lid.', price: 649, category: 'Sports', brand: 'FitLife', stock: 140, imageUrl: image('steel-bottle') },
  // Beauty
  { name: 'Herbal Face Wash 150ml', description: 'Gentle daily face wash with neem and aloe vera for fresh, clean skin.', price: 199, category: 'Beauty', brand: 'PureGlow', stock: 300, imageUrl: image('face-wash') },
  { name: 'Vitamin C Serum 30ml', description: 'Brightening serum with 10% vitamin C. Suitable for all skin types.', price: 599, category: 'Beauty', brand: 'PureGlow', stock: 65, imageUrl: image('vitamin-c') },
  { name: 'Matte Lipstick Duo', description: 'Two long-lasting matte lipsticks in everyday shades.', price: 449, category: 'Beauty', brand: 'Bloom', stock: 2, imageUrl: image('lipstick-duo') },
  { name: 'Beard Care Kit', description: 'Beard oil, balm and a wooden comb in a gift box.', price: 1099, category: 'Beauty', brand: 'Bloom', stock: 28, imageUrl: image('beard-kit') },
];

const seed = async () => {
  const force = process.argv.includes('--force');

  try {
    await connectDB();

    const existingCount = await Product.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`There are already ${existingCount} products. Nothing changed.`);
      console.log('Run "npm run seed -- --force" to delete them and add the sample products.');
      return;
    }
    if (force) {
      await Product.deleteMany({});
      console.log('Old products deleted.');
    }

    // Create (or reuse) the demo user
    let demoUser = await User.findOne({ email: 'demo@example.com' });
    if (!demoUser) {
      demoUser = await User.create({ name: 'Demo User', email: 'demo@example.com', password: 'password123' });
      console.log('Demo user created: demo@example.com / password123');
    }

    await Product.insertMany(sampleProducts.map((product) => ({ ...product, createdBy: demoUser._id })));
    console.log(`Added ${sampleProducts.length} sample products.`);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seed();

// Load environment variables first
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

console.log('📁 Current directory:', __dirname);
console.log('🔑 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('🔑 GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);

const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const reportRoutes = require('./routes/reportRoutes');
const path = require('path');

// Import routes
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cateringRoutes = require('./routes/cateringRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const testRoutes = require('./routes/testRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const aiAnalyticsRoutes = require('./routes/aiAnalyticsRoutes');

// Initialize Express app
const app = express();

// ========== CORS CONFIGURATION ==========
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://dineqrve-website.web.app',
    'https://dineqrve-manager.web.app',
    'https://dineqrve.site',
    'https://web-production-4c9c0.up.railway.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========== RAW BODY MIDDLEWARE (FOR TOYYIBPAY) ==========
// This MUST come before express.json()
app.use((req, res, next) => {
    if (req.url === '/api/payments/toyyibpay-callback' && req.method === 'POST') {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            next();
        });
    } else {
        next();
    }
});

// ========== BODY PARSERS ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== STATIC FILES ==========
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ========== ROUTES ==========
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/test', testRoutes);
app.use('/api/ai-analytics', aiAnalyticsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/catering', cateringRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'DineQRve API is running',
        endpoints: {
            menu: '/api/menu',
            orders: '/api/orders',
            catering: '/api/catering'
        },
        timestamp: new Date().toISOString()
    });
});

// Test database connection
testConnection().then(success => {
    if (!success) {
        console.log('⚠️ Database connection failed, but app will continue...');
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
});

module.exports = app;
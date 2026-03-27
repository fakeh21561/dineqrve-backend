const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Run AI analysis (admin only)
router.post('/analyze', aiController.runAnalysis);

// Get popular items
router.get('/popular', aiController.getPopularItems);

// Get recommendations for an item
router.get('/recommendations/:itemId', aiController.getRecommendations);

// Get peak hours
router.get('/peak-hours', aiController.getPeakHours);

// Get sales prediction
router.get('/prediction', aiController.getSalesPrediction);

// Get complete analytics dashboard
router.get('/analytics', aiController.getAnalytics);

module.exports = router;
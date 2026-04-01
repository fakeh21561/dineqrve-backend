const express = require('express');
const router = express.Router();
const aiAnalyticsController = require('../controllers/aiAnalyticsController');

// GET popular items
router.get('/popular', aiAnalyticsController.getPopularItems);

// POST estimate preparation time
router.post('/estimate-time', aiAnalyticsController.estimateTime);

// GET dashboard insights
router.get('/insights', aiAnalyticsController.getDashboardInsights);

// GET peak hours (ADD THIS)
router.get('/peak-hours', aiAnalyticsController.getPeakHours);

// GET sales prediction (ADD THIS)
router.get('/prediction', aiAnalyticsController.getSalesPrediction);

module.exports = router;
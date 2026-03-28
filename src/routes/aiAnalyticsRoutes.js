const express = require('express');
const router = express.Router();
const aiAnalyticsController = require('../controllers/aiAnalyticsController');

// GET popular items
router.get('/popular', aiAnalyticsController.getPopularItems);

// POST estimate preparation time
router.post('/estimate-time', aiAnalyticsController.estimateTime);

// GET dashboard insights
router.get('/insights', aiAnalyticsController.getDashboardInsights);

module.exports = router;
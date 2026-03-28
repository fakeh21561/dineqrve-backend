const aiAnalyticsService = require('../services/aiAnalyticsService');

// Get popular items
const getPopularItems = async (req, res) => {
    try {
        const limit = req.query.limit || 5;
        const items = await aiAnalyticsService.getPopularItems(parseInt(limit));
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error getting popular items:', error);
        res.status(500).json({ error: error.message });
    }
};

// Estimate preparation time
const estimateTime = async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Items array required' });
        }
        
        const estimation = await aiAnalyticsService.estimatePreparationTime(items);
        res.json({
            success: true,
            data: estimation
        });
    } catch (error) {
        console.error('Error estimating time:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get dashboard insights
const getDashboardInsights = async (req, res) => {
    try {
        const insights = await aiAnalyticsService.getDashboardInsights();
        res.json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('Error getting insights:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getPopularItems,
    estimateTime,
    getDashboardInsights
};
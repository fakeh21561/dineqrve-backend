const AIService = require('../services/aiService');

// Trigger AI analysis (can be called by cron job)
const runAnalysis = async (req, res) => {
    try {
        console.log('🤖 Running AI analysis...');
        
        await AIService.calculatePopularity();
        await AIService.findRecommendations();
        await AIService.analyzePeakHours();
        const prediction = await AIService.predictSales();

        res.json({
            success: true,
            message: 'AI analysis completed',
            prediction: prediction
        });
    } catch (error) {
        console.error('❌ AI analysis error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get popular items
const getPopularItems = async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const items = await AIService.getPopularItems(limit);
        
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get recommendations for an item
const getRecommendations = async (req, res) => {
    try {
        const { itemId } = req.params;
        const recommendations = await AIService.getRecommendations(itemId);
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get peak hours
const getPeakHours = async (req, res) => {
    try {
        const peakHours = await AIService.getPeakHours();
        
        res.json({
            success: true,
            data: peakHours
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get sales prediction
const getSalesPrediction = async (req, res) => {
    try {
        const prediction = await AIService.predictSales();
        
        res.json({
            success: true,
            data: prediction
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get dashboard analytics
const getAnalytics = async (req, res) => {
    try {
        const [popular, peakHours, prediction] = await Promise.all([
            AIService.getPopularItems(5),
            AIService.getPeakHours(),
            AIService.predictSales()
        ]);

        // Get category popularity
        const [categories] = await db.query(`
            SELECT 
                category,
                COUNT(*) as item_count,
                SUM(p.popularity_score) as total_popularity
            FROM menu_items m
            LEFT JOIN item_popularity p ON m.id = p.menu_item_id
            WHERE m.is_available = true
            GROUP BY category
            ORDER BY total_popularity DESC
        `);

        res.json({
            success: true,
            data: {
                popular_items: popular,
                peak_hours: peakHours,
                prediction: prediction,
                category_insights: categories
            }
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    runAnalysis,
    getPopularItems,
    getRecommendations,
    getPeakHours,
    getSalesPrediction,
    getAnalytics
};
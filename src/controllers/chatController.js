const geminiService = require('../services/geminiService');
const faq = require('../data/faq');

// Handle chat messages with AI
const handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a message'
            });
        }

        console.log('💬 User message:', message);

        // Try Gemini AI first
        const aiResponse = await geminiService.generateResponse(message);
        
        // Return response
        res.json({
            success: true,
            message: aiResponse.message,
            source: aiResponse.source || 'gemini',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Chat error:', error);
        
        // Ultimate fallback
        const fallback = faq.findResponse(message);
        
        res.json({
            success: true,
            message: fallback.response,
            source: 'fallback',
            timestamp: new Date().toISOString()
        });
    }
};

// Get suggested questions
const getSuggestions = async (req, res) => {
    const suggestions = [
        "What's on the menu?",
        "How much is Nasi Lemak?",
        "Do you have halal food?",
        "What are your opening hours?",
        "Do you do catering?",
        "Any vegetarian options?",
        "Where's your location?",
        "Do you deliver?",
        "What's your best seller?",
        "Ada menu Melayu?"
    ];
    
    res.json({
        success: true,
        suggestions: suggestions
    });
};

// Add this new function for refreshing cache
const refreshMenuCache = async (req, res) => {
    try {
        // Clear the menu cache in geminiService
        geminiService.menuCache = null;
        geminiService.lastMenuFetch = null;
        
        // Force a refresh by building context
        await geminiService.buildContext();
        
        res.json({ 
            success: true, 
            message: 'Menu cache refreshed successfully' 
        });
    } catch (error) {
        console.error('❌ Refresh cache error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to refresh cache' 
        });
    }
};

module.exports = {
    handleChat,
    getSuggestions,
    refreshMenuCache  // Add this to exports
};
const cron = require('node-cron');
const AIService = require('../services/aiService');

// Run AI analysis every day at 3 AM
cron.schedule('0 3 * * *', async () => {
    console.log('🤖 Running scheduled AI analysis...');
    
    try {
        await AIService.calculatePopularity();
        await AIService.findRecommendations();
        await AIService.analyzePeakHours();
        await AIService.predictSales();
        
        console.log('✅ Scheduled AI analysis completed');
    } catch (error) {
        console.error('❌ Scheduled AI analysis failed:', error);
    }
});

// Run popularity update every hour
cron.schedule('0 * * * *', async () => {
    console.log('📊 Updating popularity scores...');
    await AIService.calculatePopularity();
});
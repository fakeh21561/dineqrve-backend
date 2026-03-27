const db = require('../config/db');

const testCallback = async (req, res) => {
    console.log('🧪 TEST CALLBACK RECEIVED:');
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    console.log('Headers:', req.headers);
    
    res.json({
        received: true,
        body: req.body,
        query: req.query
    });
};

module.exports = { testCallback };
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// POST /api/chat - Send a message
router.post('/', chatController.handleChat);

// GET /api/chat/suggestions - Get suggested questions
router.get('/suggestions', chatController.getSuggestions);

// POST /api/chat/refresh-cache - Refresh menu cache (admin only)
router.post('/refresh-cache', chatController.refreshMenuCache);

module.exports = router;
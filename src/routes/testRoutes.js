const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.post('/callback', testController.testCallback);
router.get('/callback', testController.testCallback);

module.exports = router;
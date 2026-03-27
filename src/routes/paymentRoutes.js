const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ToyyibPay endpoints
router.post('/toyyibpay/create', paymentController.createToyyibPayBill);
router.post('/toyyibpay-callback', paymentController.handleToyyibPayCallback);
router.get('/toyyibpay-return', paymentController.handleToyyibPayReturn);

// Test endpoint
router.post('/test-callback/:billcode', paymentController.testCallback);

// Cash payment
router.post('/cash', paymentController.processCashPayment);

module.exports = router;
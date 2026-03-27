const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// POST /api/orders - Create new order (customer places order)
router.post('/', orderController.createOrder);

// GET /api/orders - Get all orders (for management app)
router.get('/', orderController.getAllOrders);

// GET /api/orders/:id - Get single order details
router.get('/:id', orderController.getOrderById);

// PUT /api/orders/:id/status - Update order status (preparing/completed)
router.put('/:id/status', orderController.updateOrderStatus);

// GET /api/orders/track/:orderId - Track order (public)
router.get('/track/:orderId', orderController.trackOrder);



module.exports = router;
const express = require('express');
const router = express.Router();
const cateringController = require('../controllers/cateringController');

// GET all catering bookings
router.get('/', cateringController.getAllCateringBookings);

// GET single catering booking by ID
router.get('/:id', cateringController.getCateringBookingById);

// POST create new catering booking
router.post('/', cateringController.createCateringBooking);

// PUT update catering booking status
router.put('/:id', cateringController.updateCateringBooking);

// DELETE catering booking (optional - admin only)
router.delete('/:id', cateringController.deleteCateringBooking);

// POST /api/catering/:id/resend - Resend confirmation email
router.post('/:id/resend', cateringController.resendConfirmation);

module.exports = router;
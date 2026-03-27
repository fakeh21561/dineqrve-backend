const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// GET /api/reports/sales - Get sales report
router.get('/sales', reportController.getSalesReport);

// GET /api/reports/export - Export as CSV
router.get('/export', reportController.exportReportCSV);

// GET /api/reports/dashboard - Quick dashboard stats
router.get('/dashboard', reportController.getDashboardSummary);

module.exports = router;
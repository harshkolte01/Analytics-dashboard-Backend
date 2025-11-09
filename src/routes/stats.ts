const express = require('express');
const router = express.Router();
const { getStats, getInvoiceTrends } = require('../controllers/statsController');

// GET /stats - Returns totals for overview cards
router.get('/', getStats);

// GET /invoice-trends - Returns monthly invoice count and spend
router.get('/invoice-trends', getInvoiceTrends);

module.exports = router;
const express = require('express');
const router = express.Router();
const { getTop10Vendors, getAllVendors } = require('../controllers/vendorsController');

// GET /vendors/top10 - Returns top 10 vendors by spend
router.get('/top10', getTop10Vendors);

// GET /vendors - Returns all vendors with pagination
router.get('/', getAllVendors);

module.exports = router;
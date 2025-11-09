const express = require('express');
const router = express.Router();
const { getCategorySpend, getCategorySpendSummary } = require('../controllers/categoriesController');

// GET /category-spend - Returns spend grouped by category
router.get('/', getCategorySpend);

// GET /category-spend/summary - Returns category spend summary with top categories
router.get('/summary', getCategorySpendSummary);

module.exports = router;
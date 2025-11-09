const express = require('express');
const router = express.Router();
const { getCashOutflow, getOverduePayments } = require('../controllers/cashOutflowController');

// GET /cash-outflow - Returns expected cash outflow by date range
router.get('/', getCashOutflow);

// GET /cash-outflow/overdue - Returns overdue payments
router.get('/overdue', getOverduePayments);

module.exports = router;
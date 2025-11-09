const express = require('express');
const router = express.Router();
const { getInvoices, getInvoiceById } = require('../controllers/invoicesController');

// GET /invoices - Returns list of invoices with filters/search
router.get('/', getInvoices);

// GET /invoices/:id - Returns single invoice with full details
router.get('/:id', getInvoiceById);

module.exports = router;
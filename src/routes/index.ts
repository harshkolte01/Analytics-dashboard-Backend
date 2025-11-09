const express = require('express');
const router = express.Router();

// Import route modules
const statsRoutes = require('./stats');
const invoicesRoutes = require('./invoices');
const vendorsRoutes = require('./vendors');
const categoriesRoutes = require('./categories');
const cashOutflowRoutes = require('./cashOutflow');
const chatRoutes = require('./chat');
const vendorAnalyticsRoutes = require('./vendorAnalytics');

// Mount routes
router.use('/stats', statsRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/vendors', vendorsRoutes);
router.use('/category-spend', categoriesRoutes);
router.use('/cash-outflow', cashOutflowRoutes);
router.use('/chat', chatRoutes);
router.use('/vendor-analytics', vendorAnalyticsRoutes);

// Additional routes handled by specific controllers
router.get('/invoice-trends', require('../controllers/statsController').getInvoiceTrends);

// API info endpoint
router.get('/', (req: any, res: any) => {
  res.json({
    message: 'Analytics Dashboard API',
    version: '1.0.0',
    endpoints: {
      'GET /stats': 'Returns totals for overview cards',
      'GET /invoice-trends': 'Returns monthly invoice count and spend',
      'GET /vendors/top10': 'Returns top 10 vendors by spend',
      'GET /category-spend': 'Returns spend grouped by category',
      'GET /cash-outflow': 'Returns expected cash outflow by date range',
      'GET /invoices': 'Returns list of invoices with filters/search',
      'POST /chat/query': 'Process natural language queries with AI',
      'GET /chat/suggestions': 'Get suggested questions for AI chat',
      'GET /chat/health': 'Check AI service health status',
      'GET /vendor-analytics/performance-scorecard': 'Vendor performance metrics and scorecards',
      'GET /vendor-analytics/payment-reliability': 'Payment reliability and terms analysis',
      'GET /vendor-analytics/spending-trends': 'Monthly spending trends by vendor',
      'GET /vendor-analytics/risk-assessment': 'Vendor risk assessment and scoring',
      'GET /vendor-analytics/category-analysis': 'Spending analysis by categories',
      'GET /vendor-analytics/summary': 'Overall vendor analytics summary'
    }
  });
});

module.exports = router;
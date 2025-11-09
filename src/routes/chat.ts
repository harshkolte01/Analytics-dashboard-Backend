const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Middleware for request logging
const logRequest = (req: any, res: any, next: any) => {
  console.log(`🔗 Chat API: ${req.method} ${req.path}`, {
    body: req.method === 'POST' ? Object.keys(req.body) : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    timestamp: new Date().toISOString()
  });
  next();
};

// Apply logging middleware to all routes
router.use(logRequest);

/**
 * @route POST /api/chat/query
 * @desc Process natural language query and return SQL with results
 * @body {
 *   question: string,
 *   context?: object,
 *   format?: 'json' | 'csv' | 'table' | 'chart_data' | 'summary',
 *   include_explanation?: boolean,
 *   execute_query?: boolean
 * }
 */
router.post('/query', chatController.processQuery);

/**
 * @route GET /api/chat/schema
 * @desc Get database schema information for AI context
 * @query include_sample_data?: boolean
 */
router.get('/schema', chatController.getSchema);

/**
 * @route POST /api/chat/validate
 * @desc Validate SQL query syntax and safety
 * @body { sql_query: string }
 */
router.post('/validate', chatController.validateQuery);

/**
 * @route GET /api/chat/health
 * @desc Check AI service health status
 */
router.get('/health', chatController.getHealth);

/**
 * @route GET /api/chat/suggestions
 * @desc Get suggested questions based on database schema
 */
router.get('/suggestions', chatController.getSuggestions);

/**
 * @route GET /api/chat/config
 * @desc Get AI service configuration and status
 */
router.get('/config', chatController.getConfig);

/**
 * @route POST /api/chat/batch
 * @desc Process multiple queries in batch
 * @body { queries: QueryRequest[] }
 */
router.post('/batch', chatController.processBatchQueries);

// Session Management Routes

/**
 * @route POST /api/chat/sessions
 * @desc Create a new chat session
 * @body {
 *   userId?: string,
 *   title?: string,
 *   metadata?: object
 * }
 */
router.post('/sessions', chatController.createSession);

/**
 * @route GET /api/chat/sessions/:sessionId
 * @desc Get a specific chat session
 * @params sessionId: string
 */
router.get('/sessions/:sessionId', chatController.getSession);

/**
 * @route PUT /api/chat/sessions/:sessionId
 * @desc Update a chat session
 * @params sessionId: string
 * @body {
 *   title?: string,
 *   metadata?: object
 * }
 */
router.put('/sessions/:sessionId', chatController.updateSession);

/**
 * @route DELETE /api/chat/sessions/:sessionId
 * @desc Delete a chat session
 * @params sessionId: string
 */
router.delete('/sessions/:sessionId', chatController.deleteSession);

/**
 * @route GET /api/chat/sessions
 * @desc Get all sessions for a user
 * @query userId?: string, limit?: number, offset?: number
 */
router.get('/sessions', chatController.getUserSessions);

// Query Template Routes

/**
 * @route POST /api/chat/templates
 * @desc Save a query as a template
 * @body {
 *   name: string,
 *   description?: string,
 *   question: string,
 *   sql: string,
 *   category?: string,
 *   tags?: string[],
 *   isPublic?: boolean
 * }
 */
router.post('/templates', chatController.saveQueryTemplate);

/**
 * @route GET /api/chat/templates
 * @desc Get query templates
 * @query category?: string, isPublic?: boolean, limit?: number, offset?: number
 */
router.get('/templates', chatController.getQueryTemplates);

/**
 * @route DELETE /api/chat/templates/:templateId
 * @desc Delete a query template
 * @params templateId: string
 */
router.delete('/templates/:templateId', chatController.deleteQueryTemplate);

// Feedback Routes

/**
 * @route POST /api/chat/feedback
 * @desc Submit feedback for a query
 * @body {
 *   queryId: string,
 *   rating: number,
 *   feedback?: string,
 *   isHelpful?: boolean
 * }
 */
router.post('/feedback', chatController.submitQueryFeedback);

/**
 * @route GET /api/chat/feedback/:queryId
 * @desc Get feedback for a query
 * @params queryId: string
 */
router.get('/feedback/:queryId', chatController.getQueryFeedback);

// Chat History Routes

/**
 * @route POST /api/chat/ask
 * @desc Ask a natural language question and get SQL + results
 * @body {
 *   question: string,
 *   sessionId?: string,
 *   format?: 'json' | 'csv' | 'table' | 'chart' | 'summary'
 * }
 */
router.post('/ask', chatController.askQuestion);

/**
 * @route GET /api/chat/history
 * @desc Get all chat history
 * @query limit?: number, offset?: number
 */
router.get('/history', chatController.getChatHistory);

/**
 * @route GET /api/chat/history/:sessionId
 * @desc Get chat history for a specific session
 * @params sessionId: string
 * @query limit?: number, offset?: number
 */
router.get('/history/:sessionId', chatController.getChatHistory);

/**
 * @route DELETE /api/chat/history
 * @desc Clear all chat history
 */
router.delete('/history', chatController.clearChatHistory);

/**
 * @route DELETE /api/chat/history/:sessionId
 * @desc Clear chat history for a specific session
 * @params sessionId: string
 */
router.delete('/history/:sessionId', chatController.clearChatHistory);

/**
 * @route POST /api/chat/explain
 * @desc Get explanation for a SQL query
 * @body { sql: string }
 */
router.post('/explain', chatController.explainQuery);

/**
 * @route GET /api/chat
 * @desc Chat API information and available endpoints
 */
router.get('/', (req: any, res: any) => {
  res.json({
    message: 'Analytics Chat API - Natural Language to SQL',
    version: '1.0.0',
    description: 'Convert natural language questions into SQL queries and execute them against your analytics database',
    endpoints: {
      'POST /query': {
        description: 'Process natural language query',
        parameters: {
          question: 'string (required) - Natural language question',
          context: 'object (optional) - Additional context (organization, department, etc.)',
          format: 'string (optional) - Output format: json, csv, table, chart_data, summary',
          include_explanation: 'boolean (optional) - Include query explanation (default: true)',
          execute_query: 'boolean (optional) - Execute the generated query (default: true)'
        }
      },
      'POST /ask': {
        description: 'Ask natural language question with session support',
        parameters: {
          question: 'string (required) - Natural language question',
          sessionId: 'string (optional) - Chat session ID',
          format: 'string (optional) - Output format: json, csv, table, chart, summary'
        }
      },
      'GET /schema': {
        description: 'Get database schema information',
        parameters: {
          include_sample_data: 'boolean (optional) - Include sample data from tables'
        }
      },
      'POST /validate': {
        description: 'Validate SQL query',
        parameters: {
          sql_query: 'string (required) - SQL query to validate'
        }
      },
      'GET /health': 'Check AI service health',
      'GET /suggestions': 'Get suggested questions',
      'GET /config': 'Get service configuration',
      'POST /batch': 'Process multiple queries in batch',
      'POST /sessions': 'Create new chat session',
      'GET /sessions': 'Get user chat sessions',
      'GET /sessions/:id': 'Get specific chat session',
      'PUT /sessions/:id': 'Update chat session',
      'DELETE /sessions/:id': 'Delete chat session',
      'GET /history/:sessionId?': 'Get chat history',
      'DELETE /history/:sessionId?': 'Clear chat history',
      'POST /templates': 'Save query template',
      'GET /templates': 'Get query templates',
      'DELETE /templates/:id': 'Delete query template',
      'POST /feedback': 'Submit query feedback',
      'GET /feedback/:queryId': 'Get query feedback',
      'POST /explain': 'Explain SQL query'
    },
    examples: {
      simple_query: {
        question: "Show me the top 10 vendors by spending",
        format: "json"
      },
      contextual_query: {
        question: "What are our monthly invoice trends?",
        context: {
          date_range: "last_12_months",
          organization: "ACME Corp"
        },
        format: "chart_data"
      },
      summary_query: {
        question: "Give me an overview of our vendor spending",
        format: "summary",
        include_explanation: true
      }
    },
    supported_formats: [
      {
        format: 'json',
        description: 'Raw JSON data with columns and rows'
      },
      {
        format: 'csv',
        description: 'CSV formatted string for download'
      },
      {
        format: 'table',
        description: 'Formatted table structure for UI display'
      },
      {
        format: 'chart_data',
        description: 'Data formatted for chart visualization'
      },
      {
        format: 'summary',
        description: 'Executive summary with key insights'
      }
    ],
    ai_capabilities: [
      'Natural language to SQL conversion',
      'Context-aware query generation',
      'Business intelligence insights',
      'Multi-format result presentation',
      'Query explanation and validation',
      'Batch query processing'
    ],
    service_status: {
      ai_service: 'Check /health endpoint for current status',
      database: 'Connected to PostgreSQL analytics database',
      supported_queries: [
        'Vendor analysis and spending',
        'Invoice trends and patterns',
        'Department cost analysis',
        'Payment terms and due dates',
        'Financial reporting and insights'
      ]
    }
  });
});

module.exports = router;
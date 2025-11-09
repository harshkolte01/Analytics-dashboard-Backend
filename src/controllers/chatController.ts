const vannaProxy = require('../services/vannaProxy');
const chatService = require('../services/chatService');

interface ChatQueryRequest {
  question: string;
  context?: {
    organization?: string;
    department?: string;
    vendor?: string;
    date_range?: string;
    filters?: Record<string, any>;
  };
  format?: 'json' | 'csv' | 'table' | 'chart_data' | 'summary';
  include_explanation?: boolean;
  execute_query?: boolean;
  session_id?: string;
  user_id?: string;
}

interface ChatResponse {
  success: boolean;
  question: string;
  sql_query?: string;
  explanation?: string;
  results?: any;
  metadata?: any;
  error?: string;
  timestamp: string;
}

class ChatController {
  /**
   * Process natural language query
   * POST /api/chat/query
   */
  async processQuery(req: any, res: any): Promise<void> {
    const startTime = Date.now();
    let chatQuery: any = null;
    
    try {
      const {
        question,
        context = {},
        format = 'json',
        include_explanation = true,
        execute_query = true,
        session_id,
        user_id
      }: ChatQueryRequest = req.body;

      // Validate required fields
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Question is required and must be a non-empty string',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate format
      const validFormats = ['json', 'csv', 'table', 'chart_data', 'summary'];
      if (!validFormats.includes(format)) {
        res.status(400).json({
          success: false,
          error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('🤖 Processing chat query:', {
        question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
        format,
        hasContext: Object.keys(context).length > 0,
        execute_query,
        session_id,
        user_id
      });

      // Get or create chat session
      let session = null;
      if (session_id) {
        session = await chatService.getSession(session_id);
      }
      if (!session && (user_id || session_id)) {
        session = await chatService.getOrCreateSession(user_id);
      }

      // Check if Vanna service is available
      const isServiceAvailable = await vannaProxy.isServiceAvailable();
      if (!isServiceAvailable) {
        res.status(503).json({
          success: false,
          error: 'AI service is currently unavailable. Please try again later.',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Process query with Vanna AI
      const result = await vannaProxy.processQuery({
        question,
        context,
        format,
        include_explanation,
        execute_query
      });

      const processingTime = Date.now() - startTime;

      // Extract query metadata
      const queryIntent = this.extractQueryIntent(question);
      const queryComplexity = this.assessQueryComplexity(result.sql_query || '');
      const tablesInvolved = this.extractTablesFromSQL(result.sql_query || '');

      // Log the query to database
      try {
        chatQuery = await chatService.logQuery({
          sessionId: session?.id,
          userId: user_id,
          question,
          generatedSql: result.sql_query,
          explanation: result.explanation,
          wasExecuted: execute_query,
          executionSuccess: result.success && execute_query ? !!result.results?.success : null,
          executionError: result.results?.error || result.error,
          resultRowCount: result.results?.data?.length || null,
          executionTimeMs: result.results?.execution_time ? Math.round(result.results.execution_time * 1000) : null,
          queryIntent,
          queryComplexity,
          outputFormat: format,
          tablesInvolved,
          context,
          aiModel: 'llama-3.1-70b-versatile',
          processingTimeMs: processingTime
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log query to database:', logError);
      }

      // Format response
      const response: ChatResponse = {
        success: result.success,
        question: result.question,
        sql_query: result.sql_query,
        explanation: result.explanation,
        results: result.results,
        metadata: {
          ...result.metadata,
          processing_time: processingTime,
          service_used: 'vanna-ai',
          format_requested: format,
          session_id: session?.id,
          query_id: chatQuery?.id,
          query_intent: queryIntent,
          query_complexity: queryComplexity,
          tables_involved: tablesInvolved
        },
        error: result.error,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Chat query processed:', {
        success: response.success,
        hasSql: !!response.sql_query,
        hasResults: !!response.results,
        error: response.error,
        query_id: chatQuery?.id
      });

      res.json(response);

    } catch (error: any) {
      console.error('❌ Chat query processing failed:', error);

      // Log failed query if we have the basic info
      if (chatQuery) {
        try {
          await chatService.updateQueryResults(chatQuery.id, {
            executionSuccess: false,
            executionError: error.message,
            executionTimeMs: Date.now() - startTime
          });
        } catch (updateError) {
          console.warn('⚠️ Failed to update query with error:', updateError);
        }
      }

      const statusCode = error.statusCode || 500;
      const errorMessage = error.message || 'Internal server error';

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get database schema information
   * GET /api/chat/schema
   */
  async getSchema(req: any, res: any): Promise<void> {
    try {
      const { include_sample_data = false } = req.query;

      console.log('📊 Getting database schema for chat interface');

      // Check if Vanna service is available
      const isServiceAvailable = await vannaProxy.isServiceAvailable();
      if (!isServiceAvailable) {
        res.status(503).json({
          success: false,
          error: 'AI service is currently unavailable',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await vannaProxy.getSchema(include_sample_data === 'true');

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get schema:', error);

      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Failed to retrieve schema',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate SQL query
   * POST /api/chat/validate
   */
  async validateQuery(req: any, res: any): Promise<void> {
    try {
      const { sql_query } = req.body;

      if (!sql_query || typeof sql_query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'SQL query is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('🔍 Validating SQL query:', sql_query.substring(0, 100) + '...');

      const result = await vannaProxy.validateQuery({ sql_query });

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Query validation failed:', error);

      res.status(error.statusCode || 500).json({
        valid: false,
        message: error.message || 'Validation failed',
        query: req.body.sql_query || '',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get AI service health status
   * GET /api/chat/health
   */
  async getHealth(req: any, res: any): Promise<void> {
    try {
      console.log('🏥 Checking AI service health');

      const result = await vannaProxy.healthCheck();

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ AI service health check failed:', error);

      res.status(503).json({
        status: 'unhealthy',
        services: {},
        error: error.message || 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get suggested questions based on schema
   * GET /api/chat/suggestions
   */
  async getSuggestions(req: any, res: any): Promise<void> {
    try {
      console.log('💡 Getting query suggestions');

      // Predefined suggestions based on the analytics schema
      const suggestions = [
        {
          category: 'Vendor Analysis',
          questions: [
            'Show me the top 10 vendors by total spending',
            'Which vendors have we paid the most this year?',
            'What is the average invoice amount by vendor?',
            'Show me vendors with overdue payments'
          ]
        },
        {
          category: 'Invoice Trends',
          questions: [
            'Show monthly invoice trends for the last 12 months',
            'What is our total spending this quarter?',
            'How many invoices were processed last month?',
            'Show me the largest invoices from this year'
          ]
        },
        {
          category: 'Department Analysis',
          questions: [
            'Which departments have the highest spending?',
            'Show me spending by department this year',
            'What is the average invoice amount per department?',
            'Which department processes the most invoices?'
          ]
        },
        {
          category: 'Payment Analysis',
          questions: [
            'Show me all overdue invoices',
            'What are our payment terms by vendor?',
            'Show invoices due in the next 30 days',
            'What is our average payment cycle time?'
          ]
        },
        {
          category: 'Financial Insights',
          questions: [
            'What is our total accounts payable?',
            'Show me cash flow projections',
            'What are our top expense categories?',
            'Show me year-over-year spending comparison'
          ]
        }
      ];

      res.json({
        success: true,
        suggestions,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get suggestions:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get suggestions',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get service configuration and status
   * GET /api/chat/config
   */
  async getConfig(req: any, res: any): Promise<void> {
    try {
      const config = vannaProxy.getConfig();
      const isAvailable = await vannaProxy.isServiceAvailable();

      res.json({
        success: true,
        config: {
          ...config,
          service_available: isAvailable
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get config:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Process batch queries
   * POST /api/chat/batch
   */
  async processBatchQueries(req: any, res: any): Promise<void> {
    try {
      const { queries } = req.body;

      if (!Array.isArray(queries) || queries.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Queries array is required and must not be empty',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (queries.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Maximum 10 queries allowed per batch',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log(`🔄 Processing batch of ${queries.length} queries`);

      const results = await vannaProxy.processBatchQueries(queries);

      res.json({
        success: true,
        results,
        batch_size: queries.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Batch processing failed:', error);

      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Batch processing failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get chat session history
   * GET /api/chat/sessions/:sessionId/history
   */
  async getSessionHistory(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit = 50 } = req.query;

      console.log('📜 Getting session history:', sessionId);

      const history = await chatService.getSessionHistory(sessionId, parseInt(limit));

      res.json({
        success: true,
        session_id: sessionId,
        history,
        count: history.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get session history:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get session history',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get user's chat sessions
   * GET /api/chat/sessions
   */
  async getUserSessions(req: any, res: any): Promise<void> {
    try {
      const { user_id } = req.query;
      const { limit = 10 } = req.query;

      if (!user_id) {
        res.status(400).json({
          success: false,
          error: 'user_id is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('📋 Getting user sessions:', user_id);

      const sessions = await chatService.getUserSessions(user_id, parseInt(limit));

      res.json({
        success: true,
        user_id,
        sessions,
        count: sessions.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get user sessions:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user sessions',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Add feedback to a query
   * POST /api/chat/queries/:queryId/feedback
   */
  async addQueryFeedback(req: any, res: any): Promise<void> {
    try {
      const { queryId } = req.params;
      const { feedback, rating } = req.body;

      console.log('💬 Adding query feedback:', queryId);

      const updatedQuery = await chatService.addQueryFeedback(queryId, {
        userFeedback: feedback,
        feedbackRating: rating
      });

      if (!updatedQuery) {
        res.status(404).json({
          success: false,
          error: 'Query not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        query_id: queryId,
        feedback_added: true,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to add query feedback:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add feedback',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get analytics dashboard
   * GET /api/chat/analytics
   */
  async getAnalytics(req: any, res: any): Promise<void> {
    try {
      const { days = 30 } = req.query;

      console.log('📊 Getting chat analytics dashboard');

      const analytics = await chatService.getAnalyticsDashboard(parseInt(days));

      res.json({
        success: true,
        analytics,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get analytics:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get analytics',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper methods
  private extractQueryIntent(question: string): string {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('vendor') || lowerQuestion.includes('supplier')) {
      return 'vendor_analysis';
    } else if (lowerQuestion.includes('invoice') || lowerQuestion.includes('bill')) {
      return 'invoice_trends';
    } else if (lowerQuestion.includes('department') || lowerQuestion.includes('division')) {
      return 'department_analysis';
    } else if (lowerQuestion.includes('payment') || lowerQuestion.includes('due')) {
      return 'payment_analysis';
    } else if (lowerQuestion.includes('trend') || lowerQuestion.includes('over time')) {
      return 'trend_analysis';
    } else if (lowerQuestion.includes('compare') || lowerQuestion.includes('vs')) {
      return 'comparison';
    } else {
      return 'general';
    }
  }

  private assessQueryComplexity(sql: string): string {
    if (!sql) return 'unknown';
    
    const upperSQL = sql.toUpperCase();
    let complexity = 0;
    
    // Count complexity indicators
    complexity += (upperSQL.match(/JOIN/g) || []).length * 2;
    complexity += (upperSQL.match(/SELECT/g) || []).length;
    complexity += (upperSQL.match(/GROUP BY/g) || []).length * 2;
    complexity += (upperSQL.match(/ORDER BY/g) || []).length;
    complexity += (upperSQL.match(/HAVING/g) || []).length * 2;
    complexity += (upperSQL.match(/UNION/g) || []).length * 3;
    complexity += (upperSQL.match(/CASE/g) || []).length * 2;
    
    if (complexity <= 3) return 'low';
    if (complexity <= 8) return 'medium';
    return 'high';
  }

  private extractTablesFromSQL(sql: string): string[] {
    if (!sql) return [];
    
    const tablePattern = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const matches = sql.match(tablePattern);
    
    if (!matches) return [];
    
    const tables = matches.map(match => {
      const parts = match.split(/\s+/);
      const lastPart = parts[parts.length - 1];
      return lastPart ? lastPart.toLowerCase() : '';
    }).filter(table => table.length > 0);
    
    return [...new Set(tables)]; // Remove duplicates
  }
  // Session Management Methods
  
  /**
   * Create a new chat session
   * POST /api/chat/sessions
   */
  async createSession(req: any, res: any): Promise<void> {
    try {
      const { userId, title, metadata = {} } = req.body;

      console.log('🆕 Creating new chat session:', { userId, title });

      const session = await chatService.createSession({
        userId,
        title: title || `Chat Session ${new Date().toLocaleDateString()}`,
        metadata
      });

      res.json({
        success: true,
        session,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to create session:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create session',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get a specific chat session
   * GET /api/chat/sessions/:sessionId
   */
  async getSession(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;

      console.log('📋 Getting chat session:', sessionId);

      const session = await chatService.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        session,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get session:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get session',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update a chat session
   * PUT /api/chat/sessions/:sessionId
   */
  async updateSession(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { title, metadata } = req.body;

      console.log('✏️ Updating chat session:', sessionId);

      const session = await chatService.updateSession(sessionId, {
        title,
        metadata
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        session,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to update session:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update session',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a chat session
   * DELETE /api/chat/sessions/:sessionId
   */
  async deleteSession(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;

      console.log('🗑️ Deleting chat session:', sessionId);

      const deleted = await chatService.deleteSession(sessionId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        message: 'Session deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to delete session:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete session',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Query Template Methods

  /**
   * Save a query as a template
   * POST /api/chat/templates
   */
  async saveQueryTemplate(req: any, res: any): Promise<void> {
    try {
      const { name, description, question, sql, category, tags, isPublic } = req.body;

      if (!name || !question || !sql) {
        res.status(400).json({
          success: false,
          error: 'Name, question, and SQL are required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('💾 Saving query template:', name);

      const template = await chatService.saveQueryTemplate({
        name,
        description,
        question,
        sql,
        category,
        tags: tags || [],
        isPublic: isPublic || false
      });

      res.json({
        success: true,
        template,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to save template:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save template',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get query templates
   * GET /api/chat/templates
   */
  async getQueryTemplates(req: any, res: any): Promise<void> {
    try {
      const { category, isPublic, limit = 50, offset = 0 } = req.query;

      console.log('📚 Getting query templates');

      const templates = await chatService.getQueryTemplates({
        category,
        isPublic: isPublic === 'true',
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        templates,
        count: templates.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get templates:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get templates',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a query template
   * DELETE /api/chat/templates/:templateId
   */
  async deleteQueryTemplate(req: any, res: any): Promise<void> {
    try {
      const { templateId } = req.params;

      console.log('🗑️ Deleting query template:', templateId);

      const deleted = await chatService.deleteQueryTemplate(templateId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to delete template:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete template',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Feedback Methods

  /**
   * Submit feedback for a query
   * POST /api/chat/feedback
   */
  async submitQueryFeedback(req: any, res: any): Promise<void> {
    try {
      const { queryId, rating, feedback, isHelpful } = req.body;

      if (!queryId) {
        res.status(400).json({
          success: false,
          error: 'Query ID is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('💬 Submitting query feedback:', queryId);

      const feedbackRecord = await chatService.submitQueryFeedback({
        queryId,
        rating,
        feedback,
        isHelpful
      });

      res.json({
        success: true,
        feedback: feedbackRecord,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to submit feedback:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit feedback',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feedback for a query
   * GET /api/chat/feedback/:queryId
   */
  async getQueryFeedback(req: any, res: any): Promise<void> {
    try {
      const { queryId } = req.params;

      console.log('📊 Getting query feedback:', queryId);

      const feedback = await chatService.getQueryFeedback(queryId);

      res.json({
        success: true,
        feedback,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get feedback:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get feedback',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Chat History Methods

  /**
   * Ask a natural language question
   * POST /api/chat/ask
   */
  async askQuestion(req: any, res: any): Promise<void> {
    try {
      const { question, sessionId, format = 'json' } = req.body;

      if (!question) {
        res.status(400).json({
          success: false,
          error: 'Question is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('❓ Processing ask question:', question.substring(0, 100));

      // Use the existing processQuery method but with session context
      req.body = {
        question,
        format,
        session_id: sessionId,
        include_explanation: true,
        execute_query: true
      };

      await this.processQuery(req, res);

    } catch (error: any) {
      console.error('❌ Failed to process question:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process question',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get chat history
   * GET /api/chat/history/:sessionId?
   */
  async getChatHistory(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      console.log('📜 Getting chat history:', sessionId || 'all sessions');

      const history = sessionId
        ? await chatService.getSessionHistory(sessionId, parseInt(limit))
        : await chatService.getAllChatHistory(parseInt(limit), parseInt(offset));

      res.json({
        success: true,
        history,
        session_id: sessionId,
        count: history.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to get chat history:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get chat history',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Clear chat history
   * DELETE /api/chat/history/:sessionId?
   */
  async clearChatHistory(req: any, res: any): Promise<void> {
    try {
      const { sessionId } = req.params;

      console.log('🧹 Clearing chat history:', sessionId || 'all sessions');

      const cleared = sessionId
        ? await chatService.clearSessionHistory(sessionId)
        : await chatService.clearAllChatHistory();

      res.json({
        success: true,
        message: `Chat history cleared${sessionId ? ' for session' : ''}`,
        cleared_count: cleared,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to clear chat history:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clear chat history',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Explain a SQL query
   * POST /api/chat/explain
   */
  async explainQuery(req: any, res: any): Promise<void> {
    try {
      const { sql } = req.body;

      if (!sql) {
        res.status(400).json({
          success: false,
          error: 'SQL query is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log('🔍 Explaining SQL query:', sql.substring(0, 100));

      const explanation = await vannaProxy.explainQuery({ sql });

      res.json({
        success: true,
        sql,
        explanation,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Failed to explain query:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to explain query',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export controller instance
const chatController = new ChatController();

module.exports = {
  processQuery: chatController.processQuery.bind(chatController),
  getSchema: chatController.getSchema.bind(chatController),
  validateQuery: chatController.validateQuery.bind(chatController),
  getHealth: chatController.getHealth.bind(chatController),
  getSuggestions: chatController.getSuggestions.bind(chatController),
  getConfig: chatController.getConfig.bind(chatController),
  processBatchQueries: chatController.processBatchQueries.bind(chatController),
  getSessionHistory: chatController.getSessionHistory.bind(chatController),
  getUserSessions: chatController.getUserSessions.bind(chatController),
  addQueryFeedback: chatController.addQueryFeedback.bind(chatController),
  getAnalytics: chatController.getAnalytics.bind(chatController),
  // Session management
  createSession: chatController.createSession.bind(chatController),
  getSession: chatController.getSession.bind(chatController),
  updateSession: chatController.updateSession.bind(chatController),
  deleteSession: chatController.deleteSession.bind(chatController),
  // Query templates
  saveQueryTemplate: chatController.saveQueryTemplate.bind(chatController),
  getQueryTemplates: chatController.getQueryTemplates.bind(chatController),
  deleteQueryTemplate: chatController.deleteQueryTemplate.bind(chatController),
  // Feedback
  submitQueryFeedback: chatController.submitQueryFeedback.bind(chatController),
  getQueryFeedback: chatController.getQueryFeedback.bind(chatController),
  // Chat history
  askQuestion: chatController.askQuestion.bind(chatController),
  getChatHistory: chatController.getChatHistory.bind(chatController),
  clearChatHistory: chatController.clearChatHistory.bind(chatController),
  explainQuery: chatController.explainQuery.bind(chatController)
};
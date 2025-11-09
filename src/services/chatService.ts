const prisma = require('./prismaClient');

interface ChatSession {
  id: string;
  userId?: string;
  sessionName?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

interface ChatQuery {
  id: string;
  sessionId?: string;
  userId?: string;
  question: string;
  generatedSql?: string;
  explanation?: string;
  wasExecuted: boolean;
  executionSuccess?: boolean;
  executionError?: string;
  resultRowCount?: number;
  executionTimeMs?: number;
  queryIntent?: string;
  queryComplexity?: string;
  outputFormat?: string;
  tablesInvolved?: string[];
  context?: any;
  userFeedback?: string;
  feedbackRating?: number;
  aiModel?: string;
  aiServiceVersion?: string;
  processingTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

class ChatService {
  /**
   * Create or get existing chat session
   */
  async getOrCreateSession(userId?: string, sessionName?: string): Promise<ChatSession> {
    try {
      // Try to find an active session for the user
      if (userId) {
        const existingSession = await prisma.chatSession.findFirst({
          where: {
            userId: userId,
            isActive: true
          },
          orderBy: {
            lastUsedAt: 'desc'
          }
        });

        if (existingSession) {
          // Update last used time
          return await prisma.chatSession.update({
            where: { id: existingSession.id },
            data: { lastUsedAt: new Date() }
          });
        }
      }

      // Ensure user exists before creating session
      if (userId) {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: `${userId}@example.com`,
            name: `User ${userId}`
          }
        });
      }

      // Create new session
      const newSession = await prisma.chatSession.create({
        data: {
          userId: userId || null,
          sessionName: sessionName || 'New Chat Session',
          isActive: true,
          metadata: {},
          lastUsedAt: new Date()
        }
      });

      console.log('📝 Created new chat session:', newSession.id);
      return newSession;

    } catch (error: any) {
      console.error('❌ Failed to create/get chat session:', error);
      throw new Error(`Failed to manage chat session: ${error.message}`);
    }
  }

  /**
   * Get chat session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      return await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          queries: {
            orderBy: { createdAt: 'desc' },
            take: 10 // Last 10 queries
          }
        }
      });
    } catch (error) {
      console.error('❌ Failed to get chat session:', error);
      return null;
    }
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<ChatSession[]> {
    try {
      return await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
        take: limit,
        include: {
          _count: {
            select: { queries: true }
          }
        }
      });
    } catch (error) {
      console.error('❌ Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Log a chat query
   */
  async logQuery(queryData: {
    sessionId?: string;
    userId?: string;
    question: string;
    generatedSql?: string;
    explanation?: string;
    wasExecuted?: boolean;
    executionSuccess?: boolean;
    executionError?: string;
    resultRowCount?: number;
    executionTimeMs?: number;
    queryIntent?: string;
    queryComplexity?: string;
    outputFormat?: string;
    tablesInvolved?: string[];
    context?: any;
    aiModel?: string;
    aiServiceVersion?: string;
    processingTimeMs?: number;
  }): Promise<ChatQuery> {
    try {
      // Ensure user exists before logging query
      if (queryData.userId) {
        await prisma.user.upsert({
          where: { id: queryData.userId },
          update: {},
          create: {
            id: queryData.userId,
            email: `${queryData.userId}@example.com`,
            name: `User ${queryData.userId}`
          }
        });
      }

      const query = await prisma.chatQuery.create({
        data: {
          sessionId: queryData.sessionId || null,
          userId: queryData.userId || null,
          question: queryData.question,
          generatedSql: queryData.generatedSql || null,
          explanation: queryData.explanation || null,
          wasExecuted: queryData.wasExecuted || false,
          executionSuccess: queryData.executionSuccess || null,
          executionError: queryData.executionError || null,
          resultRowCount: queryData.resultRowCount || null,
          executionTimeMs: queryData.executionTimeMs || null,
          queryIntent: queryData.queryIntent || null,
          queryComplexity: queryData.queryComplexity || null,
          outputFormat: queryData.outputFormat || null,
          tablesInvolved: queryData.tablesInvolved || [],
          context: queryData.context || null,
          aiModel: queryData.aiModel || 'llama-3.1-70b-versatile',
          aiServiceVersion: queryData.aiServiceVersion || null,
          processingTimeMs: queryData.processingTimeMs || null
        }
      });

      // Update session last used time if session exists
      if (queryData.sessionId) {
        await prisma.chatSession.update({
          where: { id: queryData.sessionId },
          data: { lastUsedAt: new Date() }
        }).catch((err: any) => console.warn('Failed to update session lastUsedAt:', err));
      }

      console.log('📊 Logged chat query:', query.id);
      return query;

    } catch (error: any) {
      console.error('❌ Failed to log chat query:', error);
      throw new Error(`Failed to log query: ${error.message}`);
    }
  }

  /**
   * Update query with execution results
   */
  async updateQueryResults(queryId: string, results: {
    executionSuccess: boolean;
    executionError?: string;
    resultRowCount?: number;
    executionTimeMs?: number;
  }): Promise<ChatQuery | null> {
    try {
      return await prisma.chatQuery.update({
        where: { id: queryId },
        data: {
          executionSuccess: results.executionSuccess,
          executionError: results.executionError || null,
          resultRowCount: results.resultRowCount || null,
          executionTimeMs: results.executionTimeMs || null,
          wasExecuted: true
        }
      });
    } catch (error) {
      console.error('❌ Failed to update query results:', error);
      return null;
    }
  }

  /**
   * Add user feedback to a query
   */
  async addQueryFeedback(queryId: string, feedback: {
    userFeedback?: string;
    feedbackRating?: number;
  }): Promise<ChatQuery | null> {
    try {
      return await prisma.chatQuery.update({
        where: { id: queryId },
        data: {
          userFeedback: feedback.userFeedback || null,
          feedbackRating: feedback.feedbackRating || null
        }
      });
    } catch (error) {
      console.error('❌ Failed to add query feedback:', error);
      return null;
    }
  }

  /**
   * Get query history for a session
   */
  async getSessionHistory(sessionId: string, limit: number = 50): Promise<ChatQuery[]> {
    try {
      return await prisma.chatQuery.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('❌ Failed to get session history:', error);
      return [];
    }
  }

  /**
   * Get user's query history
   */
  async getUserQueryHistory(userId: string, limit: number = 100): Promise<ChatQuery[]> {
    try {
      return await prisma.chatQuery.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          session: {
            select: {
              id: true,
              sessionName: true
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Failed to get user query history:', error);
      return [];
    }
  }


  /**
   * Record daily metrics
   */
  async recordDailyMetrics(date: Date, metrics: {
    totalQueries?: number;
    successfulQueries?: number;
    failedQueries?: number;
    avgResponseTimeMs?: number;
    avgExecutionTimeMs?: number;
    simpleQueries?: number;
    mediumQueries?: number;
    complexQueries?: number;
    vendorAnalysisQueries?: number;
    invoiceTrendQueries?: number;
    departmentQueries?: number;
    paymentQueries?: number;
    otherQueries?: number;
    sqlGenerationErrors?: number;
    executionErrors?: number;
    timeoutErrors?: number;
  }): Promise<any> {
    try {
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      return await prisma.aIServiceMetrics.upsert({
        where: { date: dateOnly },
        update: metrics,
        create: {
          date: dateOnly,
          ...metrics
        }
      });
    } catch (error) {
      console.error('❌ Failed to record daily metrics:', error);
      return null;
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getAnalyticsDashboard(days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalQueries,
        successfulQueries,
        recentQueries,
        popularIntents,
        dailyMetrics
      ] = await Promise.all([
        // Total queries count
        prisma.chatQuery.count({
          where: {
            createdAt: { gte: startDate }
          }
        }),

        // Successful queries count
        prisma.chatQuery.count({
          where: {
            createdAt: { gte: startDate },
            executionSuccess: true
          }
        }),

        // Recent queries
        prisma.chatQuery.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            question: true,
            queryIntent: true,
            executionSuccess: true,
            createdAt: true
          }
        }),

        // Popular query intents
        prisma.chatQuery.groupBy({
          by: ['queryIntent'],
          where: {
            createdAt: { gte: startDate },
            queryIntent: { not: null }
          },
          _count: { queryIntent: true },
          orderBy: { _count: { queryIntent: 'desc' } },
          take: 5
        }),

        // Daily metrics
        prisma.aIServiceMetrics.findMany({
          where: {
            date: { gte: startDate }
          },
          orderBy: { date: 'asc' }
        })
      ]);

      return {
        summary: {
          totalQueries,
          successfulQueries,
          successRate: totalQueries > 0 ? (successfulQueries / totalQueries * 100).toFixed(1) : '0',
          failedQueries: totalQueries - successfulQueries
        },
        recentQueries,
        popularIntents,
        dailyMetrics,
        period: `${days} days`
      };

    } catch (error) {
      console.error('❌ Failed to get analytics dashboard:', error);
      return {
        summary: { totalQueries: 0, successfulQueries: 0, successRate: '0', failedQueries: 0 },
        recentQueries: [],
        popularIntents: [],
        dailyMetrics: [],
        period: `${days} days`
      };
    }
  }

  /**
   * Clean up old sessions and queries
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<{ deletedSessions: number; deletedQueries: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Delete old queries first (due to foreign key constraints)
      const deletedQueries = await prisma.chatQuery.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      // Delete old inactive sessions
      const deletedSessions = await prisma.chatSession.deleteMany({
        where: {
          lastUsedAt: { lt: cutoffDate },
          isActive: false
        }
      });

      console.log(`🧹 Cleanup completed: ${deletedQueries.count} queries, ${deletedSessions.count} sessions deleted`);

      return {
        deletedSessions: deletedSessions.count,
        deletedQueries: deletedQueries.count
      };

    } catch (error) {
      console.error('❌ Failed to cleanup old data:', error);
      return { deletedSessions: 0, deletedQueries: 0 };
    }
  }

  // Additional methods needed by the controller

  /**
   * Create a new chat session
   */
  async createSession(sessionData: {
    userId?: string;
    title?: string;
    metadata?: any;
  }): Promise<ChatSession> {
    try {
      // Ensure user exists before creating session
      if (sessionData.userId) {
        await prisma.user.upsert({
          where: { id: sessionData.userId },
          update: {},
          create: {
            id: sessionData.userId,
            email: `${sessionData.userId}@example.com`,
            name: `User ${sessionData.userId}`
          }
        });
      }

      const session = await prisma.chatSession.create({
        data: {
          userId: sessionData.userId || null,
          sessionName: sessionData.title || 'New Chat Session',
          isActive: true,
          metadata: sessionData.metadata || {},
          lastUsedAt: new Date()
        }
      });

      console.log('📝 Created new chat session:', session.id);
      return session;

    } catch (error: any) {
      console.error('❌ Failed to create chat session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Update a chat session
   */
  async updateSession(sessionId: string, updates: {
    title?: string;
    metadata?: any;
  }): Promise<ChatSession | null> {
    try {
      const updateData: any = {};
      if (updates.title) updateData.sessionName = updates.title;
      if (updates.metadata) updateData.metadata = updates.metadata;

      return await prisma.chatSession.update({
        where: { id: sessionId },
        data: updateData
      });

    } catch (error) {
      console.error('❌ Failed to update session:', error);
      return null;
    }
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // First delete all queries in the session
      await prisma.chatQuery.deleteMany({
        where: { sessionId }
      });

      // Then delete the session
      await prisma.chatSession.delete({
        where: { id: sessionId }
      });

      console.log('🗑️ Deleted chat session:', sessionId);
      return true;

    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Save a query as a template
   */
  async saveQueryTemplate(templateData: {
    name: string;
    description?: string;
    question: string;
    sql: string;
    category?: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<any> {
    try {
      const template = await prisma.queryTemplate.create({
        data: {
          name: templateData.name,
          description: templateData.description || null,
          question: templateData.question,
          sql: templateData.sql,
          category: templateData.category || 'general',
          tags: templateData.tags || [],
          isPublic: templateData.isPublic || false,
          usageCount: 0
        }
      });

      console.log('💾 Saved query template:', template.id);
      return template;

    } catch (error: any) {
      console.error('❌ Failed to save template:', error);
      throw new Error(`Failed to save template: ${error.message}`);
    }
  }

  /**
   * Get query templates with filters
   */
  async getQueryTemplates(filters: {
    category?: string;
    isPublic?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};
      if (filters.category) where.category = filters.category;
      if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;

      return await prisma.queryTemplate.findMany({
        where,
        orderBy: { usageCount: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      });

    } catch (error) {
      console.error('❌ Failed to get query templates:', error);
      return [];
    }
  }

  /**
   * Delete a query template
   */
  async deleteQueryTemplate(templateId: string): Promise<boolean> {
    try {
      await prisma.queryTemplate.delete({
        where: { id: templateId }
      });

      console.log('🗑️ Deleted query template:', templateId);
      return true;

    } catch (error) {
      console.error('❌ Failed to delete template:', error);
      return false;
    }
  }

  /**
   * Submit feedback for a query
   */
  async submitQueryFeedback(feedbackData: {
    queryId: string;
    rating?: number;
    feedback?: string;
    isHelpful?: boolean;
  }): Promise<any> {
    try {
      const feedback = await prisma.queryFeedback.create({
        data: {
          queryId: feedbackData.queryId,
          rating: feedbackData.rating || null,
          feedback: feedbackData.feedback || null,
          isHelpful: feedbackData.isHelpful || null
        }
      });

      // Also update the query with feedback
      await prisma.chatQuery.update({
        where: { id: feedbackData.queryId },
        data: {
          userFeedback: feedbackData.feedback,
          feedbackRating: feedbackData.rating
        }
      }).catch((err: any) => console.warn('Failed to update query with feedback:', err));

      console.log('💬 Submitted query feedback:', feedback.id);
      return feedback;

    } catch (error: any) {
      console.error('❌ Failed to submit feedback:', error);
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }
  }

  /**
   * Get feedback for a query
   */
  async getQueryFeedback(queryId: string): Promise<any[]> {
    try {
      return await prisma.queryFeedback.findMany({
        where: { queryId },
        orderBy: { createdAt: 'desc' }
      });

    } catch (error) {
      console.error('❌ Failed to get query feedback:', error);
      return [];
    }
  }

  /**
   * Get all chat history (across sessions)
   */
  async getAllChatHistory(limit: number = 50, offset: number = 0): Promise<ChatQuery[]> {
    try {
      return await prisma.chatQuery.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          session: {
            select: {
              id: true,
              sessionName: true
            }
          }
        }
      });

    } catch (error) {
      console.error('❌ Failed to get all chat history:', error);
      return [];
    }
  }

  /**
   * Clear session history
   */
  async clearSessionHistory(sessionId: string): Promise<number> {
    try {
      const result = await prisma.chatQuery.deleteMany({
        where: { sessionId }
      });

      console.log(`🧹 Cleared ${result.count} queries from session:`, sessionId);
      return result.count;

    } catch (error) {
      console.error('❌ Failed to clear session history:', error);
      return 0;
    }
  }

  /**
   * Clear all chat history
   */
  async clearAllChatHistory(): Promise<number> {
    try {
      const result = await prisma.chatQuery.deleteMany({});

      console.log(`🧹 Cleared all ${result.count} queries from database`);
      return result.count;

    } catch (error) {
      console.error('❌ Failed to clear all chat history:', error);
      return 0;
    }
  }
}

// Export singleton instance
const chatService = new ChatService();

module.exports = chatService;
module.exports.ChatService = ChatService;
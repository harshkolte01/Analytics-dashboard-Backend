const axios = require('axios');

interface QueryRequest {
  question: string;
  context?: Record<string, any>;
  format?: string;
  include_explanation?: boolean;
  execute_query?: boolean;
}

interface QueryResponse {
  success: boolean;
  question: string;
  sql_query?: string;
  explanation?: string;
  results?: Record<string, any>;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: string;
}

interface SchemaResponse {
  success: boolean;
  schema_info?: string;
  tables?: string[];
  error?: string;
}

interface ValidationRequest {
  sql_query: string;
}

interface ValidationResponse {
  valid: boolean;
  message: string;
  query: string;
  suggestions?: string[];
}

interface HealthResponse {
  status: string;
  services: Record<string, boolean>;
  timestamp: string;
}

class VannaProxyService {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.baseUrl = process.env.VANNA_SERVICE_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.VANNA_TIMEOUT || '30000');
    this.retryAttempts = parseInt(process.env.VANNA_RETRY_ATTEMPTS || '3');
    this.retryDelay = parseInt(process.env.VANNA_RETRY_DELAY || '1000');
  }

  /**
   * Process natural language query and return SQL with results
   */
  async processQuery(request: QueryRequest): Promise<QueryResponse> {
    try {
      console.log('🤖 Processing query with Vanna AI:', request.question);

      const response = await this.makeRequest<QueryResponse>('POST', '/query', request);

      console.log('✅ Query processed successfully:', {
        question: request.question,
        hasSql: !!response.sql_query,
        hasResults: !!response.results,
        success: response.success
      });

      return response;

    } catch (error) {
      console.error('❌ Failed to process query:', error);
      throw this.handleError(error, 'Query processing failed');
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(includeSampleData: boolean = false): Promise<SchemaResponse> {
    try {
      console.log('📊 Getting database schema, includeSampleData:', includeSampleData);

      const response = await this.makeRequest<SchemaResponse>('GET', '/schema', null, {
        include_sample_data: includeSampleData
      });

      console.log('✅ Schema retrieved successfully:', {
        success: response.success,
        tableCount: response.tables?.length || 0
      });

      return response;

    } catch (error) {
      console.error('❌ Failed to get schema:', error);
      throw this.handleError(error, 'Schema retrieval failed');
    }
  }

  /**
   * Validate SQL query syntax and safety
   */
  async validateQuery(request: ValidationRequest): Promise<ValidationResponse> {
    try {
      console.log('🔍 Validating SQL query:', request.sql_query.substring(0, 100) + '...');

      const response = await this.makeRequest<ValidationResponse>('POST', '/validate', request);

      console.log('✅ Query validation completed:', {
        valid: response.valid,
        message: response.message
      });

      return response;

    } catch (error) {
      console.error('❌ Failed to validate query:', error);
      throw this.handleError(error, 'Query validation failed');
    }
  }

  /**
   * Check health of Vanna AI service
   */
  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await this.makeRequest<HealthResponse>('GET', '/health');

      console.log('🏥 Vanna AI health check:', {
        status: response.status,
        services: response.services
      });

      return response;

    } catch (error) {
      console.error('❌ Vanna AI health check failed:', error);
      throw this.handleError(error, 'Health check failed');
    }
  }

  /**
   * Get service metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    try {
      const response = await this.makeRequest<Record<string, any>>('GET', '/metrics');
      return response;

    } catch (error) {
      console.error('❌ Failed to get metrics:', error);
      throw this.handleError(error, 'Metrics retrieval failed');
    }
  }

  /**
   * Make HTTP request to Vanna service with retry logic
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url,
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          ...(data && { data }),
          ...(params && { params })
        };

        console.log(`🔄 Vanna API request (attempt ${attempt}/${this.retryAttempts}):`, {
          method,
          endpoint,
          hasData: !!data,
          hasParams: !!params
        });

        const response = await axios(config);

        if (response.status >= 200 && response.status < 300) {
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error: any) {
        const isLastAttempt = attempt === this.retryAttempts;
        
        if (this.isRetryableError(error) && !isLastAttempt) {
          console.warn(`⚠️ Vanna API request failed (attempt ${attempt}), retrying in ${this.retryDelay}ms:`, error.message);
          await this.delay(this.retryDelay);
          continue;
        }

        // Last attempt or non-retryable error
        throw error;
      }
    }

    throw new Error('All retry attempts exhausted');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return true;
    }

    // HTTP 5xx errors
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any, context: string): Error {
    let errorMessage = context;
    let statusCode = 500;

    if (error.response) {
      // HTTP error response
      statusCode = error.response.status;
      const responseData = error.response.data;
      
      if (responseData && responseData.error) {
        errorMessage = `${context}: ${responseData.error}`;
      } else if (responseData && responseData.message) {
        errorMessage = `${context}: ${responseData.message}`;
      } else {
        errorMessage = `${context}: HTTP ${statusCode} ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Network error
      errorMessage = `${context}: Network error - ${error.message}`;
    } else {
      // Other error
      errorMessage = `${context}: ${error.message}`;
    }

    const customError = new Error(errorMessage) as any;
    customError.statusCode = statusCode;
    customError.originalError = error;

    return customError;
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if Vanna service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service configuration
   */
  getConfig(): Record<string, any> {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    };
  }

  /**
   * Process multiple queries in batch (if needed)
   */
  async processBatchQueries(requests: QueryRequest[]): Promise<QueryResponse[]> {
    try {
      console.log(`🔄 Processing batch of ${requests.length} queries`);

      // Process queries sequentially to avoid overwhelming the service
      const results: QueryResponse[] = [];
      
      for (const request of requests) {
        const result = await this.processQuery(request);
        results.push(result);
      }

      console.log(`✅ Batch processing completed: ${results.length} queries processed`);
      
      return results;

    } catch (error) {
      console.error('❌ Batch query processing failed:', error);
      throw this.handleError(error, 'Batch query processing failed');
    }
  }

  /**
   * Stream query processing (for long-running queries)
   */
  async streamQuery(request: QueryRequest, onProgress?: (progress: any) => void): Promise<QueryResponse> {
    // For now, just use regular processing
    // This could be enhanced with WebSocket or Server-Sent Events in the future
    return this.processQuery(request);
  }

  /**
   * Explain a SQL query
   */
  async explainQuery(request: { sql: string }): Promise<{ explanation: string; sql: string }> {
    try {
      console.log('🔍 Explaining SQL query:', request.sql.substring(0, 100) + '...');

      const response = await this.makeRequest<{ explanation: string; sql: string }>('POST', '/explain', request);

      console.log('✅ Query explanation completed');

      return response;

    } catch (error) {
      console.error('❌ Failed to explain query:', error);
      throw this.handleError(error, 'Query explanation failed');
    }
  }
}

// Export singleton instance
const vannaProxy = new VannaProxyService();

module.exports = vannaProxy;
module.exports.VannaProxyService = VannaProxyService;
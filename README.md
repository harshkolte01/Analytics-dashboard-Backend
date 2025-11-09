# 🚀 Analytics Dashboard API

Express.js backend API service providing comprehensive analytics endpoints for invoice, vendor, and financial data analysis.

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "API Service"
        ROUTES[Express Routes]
        CONTROLLERS[Controllers]
        SERVICES[Business Logic]
        UTILS[Utilities]
    end
    
    subgraph "Database Layer"
        PRISMA[Prisma ORM]
        POSTGRES[(PostgreSQL)]
    end
    
    subgraph "External Services"
        VANNA[Vanna AI Service]
        FRONTEND[Next.js Frontend]
    end
    
    ROUTES --> CONTROLLERS
    CONTROLLERS --> SERVICES
    SERVICES --> PRISMA
    PRISMA --> POSTGRES
    SERVICES --> VANNA
    FRONTEND --> ROUTES
```

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (ready for implementation)
- **Validation**: Custom validation utilities
- **Process Management**: PM2 (production)

## 📁 Project Structure

```
apps/api/
├── src/
│   ├── controllers/           # Route controllers
│   │   ├── cashOutflowController.ts
│   │   ├── categoriesController.ts
│   │   ├── chatController.ts
│   │   ├── invoicesController.ts
│   │   ├── statsController.ts
│   │   ├── vendorsController.ts
│   │   └── vendorAnalyticsController.ts
│   │
│   ├── routes/               # API route definitions
│   │   ├── index.ts          # Main router
│   │   ├── cashOutflow.ts
│   │   ├── categories.ts
│   │   ├── chat.ts
│   │   ├── invoices.ts
│   │   ├── stats.ts
│   │   ├── vendors.ts
│   │   └── vendorAnalytics.ts
│   │
│   ├── services/             # Business logic layer
│   │   ├── chatService.ts
│   │   ├── prismaClient.ts
│   │   ├── sqlExecutor.ts
│   │   └── vannaProxy.ts
│   │
│   ├── types/                # TypeScript definitions
│   │   └── api.d.ts
│   │
│   ├── utils/                # Utility functions
│   │   ├── transform.ts
│   │   └── validations.ts
│   │
│   ├── generated/            # Prisma generated files
│   │   └── prisma/
│   │
│   ├── index.ts              # Application entry point
│   └── server.ts             # Express server setup
│
├── prisma/                   # Database schema & migrations
│   ├── schema.prisma         # Database schema
│   ├── seed.ts              # Database seeding
│   └── migrations/          # Database migrations
│
├── package.json
├── tsconfig.json
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Installation
```bash
cd apps/api
npm install
```

### Environment Setup
```bash
cp .env.example .env
```

Configure your `.env` file:
```env
NODE_ENV=development
PORT=8000
DATABASE_URL=postgresql://username:password@localhost:5432/analytics_dashboard
CORS_ORIGIN=http://localhost:3000
VANNA_SERVICE_URL=http://localhost:8001
JWT_SECRET=your-jwt-secret-here
```

### Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📚 API Documentation

### Base URL
- **Development**: `http://localhost:8000`
- **Production**: `https://your-domain.com/api`

### Authentication
Currently, the API is open for development. JWT authentication is ready for implementation.

```typescript
// Future authentication header
Authorization: Bearer <jwt-token>
```

## 🔗 API Endpoints

### 📊 Dashboard Analytics

#### Get Dashboard Statistics
```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInvoices": 1250,
    "totalAmount": 2450000.50,
    "avgInvoiceValue": 1960.00,
    "uniqueVendors": 85,
    "pendingInvoices": 23,
    "overdueAmount": 45000.00,
    "monthlyGrowth": 12.5,
    "topVendor": "Tech Solutions Inc"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Get Invoice Trends
```http
GET /api/invoice-trends?period=6months&groupBy=month
```

**Query Parameters:**
- `period`: `3months`, `6months`, `12months`, `24months`
- `groupBy`: `day`, `week`, `month`, `quarter`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-01",
      "invoiceCount": 125,
      "totalAmount": 245000.50,
      "avgAmount": 1960.00
    }
  ],
  "metadata": {
    "period": "6months",
    "groupBy": "month",
    "totalRecords": 6
  }
}
```

#### Get Cash Outflow Analysis
```http
GET /api/cash-outflow?period=12months&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "month": "2024-01",
      "totalOutflow": 185000.75,
      "invoiceCount": 95,
      "avgInvoiceValue": 1947.38,
      "categories": [
        {
          "category": "Technology",
          "amount": 75000.00,
          "percentage": 40.5
        }
      ]
    }
  ]
}
```

#### Get Category Spending
```http
GET /api/category-spend?limit=10&period=6months
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category": "Technology",
      "totalSpend": 450000.00,
      "invoiceCount": 125,
      "avgInvoiceValue": 3600.00,
      "percentage": 35.2,
      "growth": 12.5
    }
  ]
}
```

### 🏢 Vendor Analytics

#### Get Top Vendors
```http
GET /api/vendors/top10?period=6months&sortBy=totalSpend
```

**Query Parameters:**
- `period`: Time period for analysis
- `sortBy`: `totalSpend`, `invoiceCount`, `avgInvoiceValue`
- `limit`: Number of vendors to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "vendorTaxId": "12-3456789",
      "totalSpend": 125000.00,
      "invoiceCount": 45,
      "avgInvoiceValue": 2777.78,
      "firstInvoice": "2023-06-15",
      "lastInvoice": "2024-01-10",
      "growth": 15.2
    }
  ]
}
```

#### Get Vendor Performance Scorecard
```http
GET /api/vendor-analytics/performance-scorecard?timeframe=12&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "vendorTaxId": "12-3456789",
      "totalSpend": 125000.00,
      "invoiceCount": 45,
      "avgInvoiceValue": 2777.78,
      "activeMonths": 8,
      "avgPaymentTerms": 30.5,
      "performanceScore": {
        "overall": 87,
        "consistency": 92,
        "volume": 85,
        "reliability": 84
      }
    }
  ],
  "metadata": {
    "timeframe": "12 months",
    "totalVendors": 15
  }
}
```

#### Get Payment Reliability Analysis
```http
GET /api/vendor-analytics/payment-reliability?limit=15
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "paymentRecords": 45,
      "avgPaymentTerms": 30.5,
      "avgDiscountRate": 2.5,
      "overdueCount": 3,
      "overdueRate": 6.67,
      "discountEligible": 12,
      "discountUtilization": 26.67,
      "potentialSavings": 1250.00,
      "reliabilityScore": 86
    }
  ]
}
```

#### Get Spending Trends Analysis
```http
GET /api/vendor-analytics/spending-trends?months=12&topVendors=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "trends": [
        {
          "month": "2024-01-01T00:00:00Z",
          "invoiceCount": 8,
          "monthlySpend": 15000.00,
          "avgInvoiceValue": 1875.00
        }
      ],
      "summary": {
        "totalSpend": 125000.00,
        "avgMonthlySpend": 10416.67,
        "growthRate": 12.5,
        "activeMonths": 12,
        "totalInvoices": 45
      }
    }
  ]
}
```

#### Get Risk Assessment
```http
GET /api/vendor-analytics/risk-assessment?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "vendorTaxId": "12-3456789",
      "totalInvoices": 45,
      "totalExposure": 125000.00,
      "avgInvoiceValue": 2777.78,
      "invoiceVariability": 850.25,
      "lateInvoices": 2,
      "lateInvoiceRate": 4.44,
      "overduePayments": 3,
      "overdueRate": 6.67,
      "avgPaymentWindow": 30.5,
      "riskScores": {
        "overall": 25,
        "exposure": 12,
        "variability": 30,
        "timeliness": 18,
        "payment": 35
      },
      "riskCategory": "Low"
    }
  ],
  "metadata": {
    "totalVendors": 15,
    "riskDistribution": {
      "high": 2,
      "medium": 5,
      "low": 8
    }
  }
}
```

### 🤖 AI Chat Interface

#### Send Natural Language Query
```http
POST /api/chat/query
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "Show me top 5 vendors by total spend in the last 6 months",
  "sessionId": "optional-session-id",
  "context": {
    "timeframe": "6months",
    "limit": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queryId": "uuid-query-id",
    "question": "Show me top 5 vendors by total spend in the last 6 months",
    "generatedSql": "SELECT v.\"vendorName\", SUM(i.\"invoiceTotal\") as total_spend FROM \"Vendor\" v JOIN \"Invoice\" i ON v.id = i.\"vendorId\" WHERE i.\"invoiceDate\" >= CURRENT_DATE - INTERVAL '6 months' GROUP BY v.id, v.\"vendorName\" ORDER BY total_spend DESC LIMIT 5",
    "explanation": "Here are the top 5 vendors by total spending in the last 6 months:",
    "results": [
      {
        "vendorName": "Tech Solutions Inc",
        "total_spend": "125000.00"
      }
    ],
    "executionSuccess": true,
    "executionTimeMs": 245,
    "resultRowCount": 5
  }
}
```

#### Export Query Results
```http
POST /api/chat/export
Content-Type: application/json
```

**Request Body:**
```json
{
  "data": [
    {
      "vendorName": "Tech Solutions Inc",
      "total_spend": "125000.00"
    }
  ],
  "format": "csv",
  "filename": "top_vendors_report"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/downloads/top_vendors_report.csv",
    "filename": "top_vendors_report.csv",
    "format": "csv",
    "recordCount": 5,
    "fileSize": "1.2KB"
  }
}
```

#### Get Chat Sessions
```http
GET /api/chat/sessions?userId=optional-user-id&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-uuid",
      "sessionName": "Vendor Analysis Session",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "lastUsedAt": "2024-01-15T11:30:00Z",
      "queryCount": 5
    }
  ]
}
```

#### Get Session History
```http
GET /api/chat/sessions/:sessionId/history?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "query-uuid",
      "question": "Show me top vendors",
      "generatedSql": "SELECT ...",
      "wasExecuted": true,
      "executionSuccess": true,
      "resultRowCount": 10,
      "createdAt": "2024-01-15T11:30:00Z"
    }
  ]
}
```

### 📋 Invoice Management

#### Get Invoices
```http
GET /api/invoices?page=1&limit=50&sortBy=invoiceDate&order=desc
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50)
- `sortBy`: Sort field (`invoiceDate`, `invoiceTotal`, `vendorName`)
- `order`: Sort order (`asc`, `desc`)
- `vendorId`: Filter by vendor ID
- `startDate`: Filter from date (YYYY-MM-DD)
- `endDate`: Filter to date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-uuid",
      "invoiceNumber": "INV-2024-001",
      "invoiceDate": "2024-01-15",
      "deliveryDate": "2024-01-10",
      "invoiceTotal": 2500.00,
      "subTotal": 2100.00,
      "totalTax": 400.00,
      "currencySymbol": "USD",
      "vendor": {
        "vendorName": "Tech Solutions Inc",
        "vendorTaxId": "12-3456789"
      },
      "lineItems": [
        {
          "description": "Software License",
          "quantity": 1,
          "unitPrice": 2100.00,
          "totalPrice": 2100.00
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25
  }
}
```

## 🔧 Development

### Available Scripts
```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start           # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio

# Code Quality
npm run lint         # Lint TypeScript code
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Testing
npm test            # Run tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Database Schema

#### Core Entities
- **Organization**: Company/organization data
- **Department**: Organizational departments
- **User**: System users
- **Document**: File management
- **Vendor**: Vendor information
- **Customer**: Customer data
- **Invoice**: Invoice records
- **Payment**: Payment information
- **LineItem**: Invoice line items

#### Chat & AI Entities
- **ChatSession**: User chat sessions
- **ChatQuery**: Individual queries and responses
- **QueryTemplate**: Predefined query templates
- **QueryFeedback**: User feedback on queries
- **AIServiceMetrics**: AI service performance metrics

### Adding New Endpoints

1. **Create Controller**
```typescript
// src/controllers/newController.ts
export const getNewData = async (req: Request, res: Response) => {
  try {
    // Business logic here
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

2. **Create Route**
```typescript
// src/routes/newRoute.ts
import express from 'express';
import { getNewData } from '../controllers/newController';

const router = express.Router();
router.get('/new-data', getNewData);

export default router;
```

3. **Register Route**
```typescript
// src/routes/index.ts
import newRoutes from './newRoute';
app.use('/api/new', newRoutes);
```

### Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {
    "field": "validation error details"
  }
}
```

### Logging

Structured logging with different levels:
```typescript
console.log('📊 Info message');
console.warn('⚠️ Warning message');
console.error('❌ Error message');
```

## 🚀 Production Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://user:password@localhost:5432/analytics_dashboard
CORS_ORIGIN=https://your-frontend.vercel.app
VANNA_SERVICE_URL=http://localhost:8001
JWT_SECRET=your-super-secure-jwt-secret
LOG_LEVEL=info
```

### PM2 Configuration
```bash
# Start with PM2
pm2 start dist/server.js --name "analytics-api"

# PM2 ecosystem file (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'analytics-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};
```

### Health Monitoring
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "database": "connected",
  "services": {
    "vanna": "healthy"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check PostgreSQL service status
   - Verify DATABASE_URL format
   - Ensure database exists and user has permissions

2. **Prisma Client Issues**
   - Run `npx prisma generate`
   - Check schema.prisma syntax
   - Verify database migrations are up to date

3. **CORS Errors**
   - Check CORS_ORIGIN environment variable
   - Ensure frontend URL is correctly configured

4. **Vanna Service Connection**
   - Verify VANNA_SERVICE_URL
   - Check if Vanna service is running
   - Review network connectivity

### Debug Mode
```bash
DEBUG=* npm run dev  # Enable all debug logs
DEBUG=api:* npm run dev  # Enable API-specific logs
```

---

**API Documentation last updated: January 2024**
-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionName" TEXT DEFAULT 'New Chat Session',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatQuery" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "generatedSql" TEXT,
    "explanation" TEXT,
    "wasExecuted" BOOLEAN NOT NULL DEFAULT false,
    "executionSuccess" BOOLEAN,
    "executionError" TEXT,
    "resultRowCount" INTEGER,
    "executionTimeMs" INTEGER,
    "queryIntent" TEXT,
    "queryComplexity" TEXT,
    "outputFormat" TEXT,
    "tablesInvolved" TEXT[],
    "context" JSONB,
    "userFeedback" TEXT,
    "feedbackRating" INTEGER,
    "aiModel" TEXT DEFAULT 'llama-3.1-70b-versatile',
    "aiServiceVersion" TEXT,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "templateQuery" TEXT NOT NULL,
    "sqlTemplate" TEXT,
    "parameters" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "difficulty" TEXT,
    "estimatedTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryFeedback" (
    "id" TEXT NOT NULL,
    "queryId" TEXT,
    "originalQuestion" TEXT NOT NULL,
    "generatedSql" TEXT,
    "feedbackType" TEXT NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "rating" INTEGER,
    "userEmail" TEXT,
    "userName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueryFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIServiceMetrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "successfulQueries" INTEGER NOT NULL DEFAULT 0,
    "failedQueries" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER,
    "avgExecutionTimeMs" INTEGER,
    "simpleQueries" INTEGER NOT NULL DEFAULT 0,
    "mediumQueries" INTEGER NOT NULL DEFAULT 0,
    "complexQueries" INTEGER NOT NULL DEFAULT 0,
    "vendorAnalysisQueries" INTEGER NOT NULL DEFAULT 0,
    "invoiceTrendQueries" INTEGER NOT NULL DEFAULT 0,
    "departmentQueries" INTEGER NOT NULL DEFAULT 0,
    "paymentQueries" INTEGER NOT NULL DEFAULT 0,
    "otherQueries" INTEGER NOT NULL DEFAULT 0,
    "sqlGenerationErrors" INTEGER NOT NULL DEFAULT 0,
    "executionErrors" INTEGER NOT NULL DEFAULT 0,
    "timeoutErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIServiceMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatSession_isActive_idx" ON "ChatSession"("isActive");

-- CreateIndex
CREATE INDEX "ChatSession_lastUsedAt_idx" ON "ChatSession"("lastUsedAt");

-- CreateIndex
CREATE INDEX "ChatQuery_sessionId_idx" ON "ChatQuery"("sessionId");

-- CreateIndex
CREATE INDEX "ChatQuery_userId_idx" ON "ChatQuery"("userId");

-- CreateIndex
CREATE INDEX "ChatQuery_wasExecuted_idx" ON "ChatQuery"("wasExecuted");

-- CreateIndex
CREATE INDEX "ChatQuery_executionSuccess_idx" ON "ChatQuery"("executionSuccess");

-- CreateIndex
CREATE INDEX "ChatQuery_queryIntent_idx" ON "ChatQuery"("queryIntent");

-- CreateIndex
CREATE INDEX "ChatQuery_createdAt_idx" ON "ChatQuery"("createdAt");

-- CreateIndex
CREATE INDEX "QueryTemplate_category_idx" ON "QueryTemplate"("category");

-- CreateIndex
CREATE INDEX "QueryTemplate_isPublic_idx" ON "QueryTemplate"("isPublic");

-- CreateIndex
CREATE INDEX "QueryTemplate_usageCount_idx" ON "QueryTemplate"("usageCount");

-- CreateIndex
CREATE INDEX "QueryFeedback_feedbackType_idx" ON "QueryFeedback"("feedbackType");

-- CreateIndex
CREATE INDEX "QueryFeedback_status_idx" ON "QueryFeedback"("status");

-- CreateIndex
CREATE INDEX "QueryFeedback_createdAt_idx" ON "QueryFeedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIServiceMetrics_date_key" ON "AIServiceMetrics"("date");

-- CreateIndex
CREATE INDEX "AIServiceMetrics_date_idx" ON "AIServiceMetrics"("date");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatQuery" ADD CONSTRAINT "ChatQuery_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatQuery" ADD CONSTRAINT "ChatQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
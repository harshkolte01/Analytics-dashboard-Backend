const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Middleware for request logging
const logRequest = (req: any, res: any, next: any) => {
  console.log(`🔗 Vendor Analytics API: ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    timestamp: new Date().toISOString()
  });
  next();
};

router.use(logRequest);

/**
 * @route GET /api/vendor-analytics/performance-scorecard
 * @desc Get vendor performance metrics for scorecard display
 */
router.get('/performance-scorecard', async (req: any, res: any) => {
  try {
    const { limit = 20, timeframe = '12' } = req.query;
    
    console.log('📊 Getting vendor performance scorecard data');

    const vendorPerformance = await prisma.$queryRaw`
      SELECT 
        v."vendorName",
        v."vendorTaxId",
        COUNT(i.id)::int as invoice_count,
        COALESCE(SUM(i."invoiceTotal"), 0)::decimal as total_spend,
        COALESCE(AVG(i."invoiceTotal"), 0)::decimal as avg_invoice_value,
        MIN(i."invoiceDate") as first_invoice,
        MAX(i."invoiceDate") as last_invoice,
        COUNT(DISTINCT DATE_TRUNC('month', i."invoiceDate"))::int as active_months,
        COALESCE(AVG(EXTRACT(days FROM (p."dueDate" - i."invoiceDate"))), 0)::decimal as avg_payment_terms
      FROM "Vendor" v
      LEFT JOIN "Invoice" i ON v.id = i."vendorId"
      LEFT JOIN "Payment" p ON i.id = p."invoiceId"
      WHERE i."invoiceDate" >= CURRENT_DATE - INTERVAL '${timeframe} months'
      GROUP BY v.id, v."vendorName", v."vendorTaxId"
      HAVING COUNT(i.id) > 0
      ORDER BY total_spend DESC
      LIMIT ${parseInt(limit)}
    `;

    // Calculate performance scores
    const scorecardData = vendorPerformance.map((vendor: any) => {
      const consistencyScore = Math.min(100, (vendor.active_months / parseInt(timeframe)) * 100);
      const volumeScore = Math.min(100, (vendor.invoice_count / 50) * 100); // Normalize to 50 invoices = 100%
      const reliabilityScore = vendor.avg_payment_terms > 0 ? Math.max(0, 100 - (vendor.avg_payment_terms - 30)) : 50;
      
      const overallScore = Math.round((consistencyScore + volumeScore + reliabilityScore) / 3);

      return {
        vendorName: vendor.vendorName,
        vendorTaxId: vendor.vendorTaxId,
        totalSpend: parseFloat(vendor.total_spend),
        invoiceCount: vendor.invoice_count,
        avgInvoiceValue: parseFloat(vendor.avg_invoice_value),
        firstInvoice: vendor.first_invoice,
        lastInvoice: vendor.last_invoice,
        activeMonths: vendor.active_months,
        avgPaymentTerms: parseFloat(vendor.avg_payment_terms),
        performanceScore: {
          overall: overallScore,
          consistency: Math.round(consistencyScore),
          volume: Math.round(volumeScore),
          reliability: Math.round(reliabilityScore)
        }
      };
    });

    res.json({
      success: true,
      data: scorecardData,
      metadata: {
        timeframe: `${timeframe} months`,
        totalVendors: scorecardData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get vendor performance scorecard:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get vendor performance data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/vendor-analytics/payment-reliability
 * @desc Get payment reliability metrics by vendor
 */
router.get('/payment-reliability', async (req: any, res: any) => {
  try {
    const { limit = 15 } = req.query;
    
    console.log('💳 Getting vendor payment reliability data');

    const paymentReliability = await prisma.$queryRaw`
      SELECT 
        v."vendorName",
        COUNT(p.id)::int as payment_records,
        COALESCE(AVG(p."netDays"), 0)::decimal as avg_payment_terms,
        COALESCE(AVG(p."discountPercentage"), 0)::decimal as avg_discount_rate,
        COUNT(CASE WHEN p."dueDate" < CURRENT_DATE THEN 1 END)::int as overdue_count,
        COUNT(CASE WHEN p."discountDueDate" >= CURRENT_DATE THEN 1 END)::int as discount_eligible,
        COALESCE(SUM(CASE WHEN p."discountDueDate" >= CURRENT_DATE THEN p."discountedTotal" ELSE 0 END), 0)::decimal as potential_savings,
        MIN(p."dueDate") as earliest_due,
        MAX(p."dueDate") as latest_due
      FROM "Vendor" v
      JOIN "Invoice" i ON v.id = i."vendorId"
      JOIN "Payment" p ON i.id = p."invoiceId"
      WHERE p."dueDate" IS NOT NULL
      GROUP BY v.id, v."vendorName"
      HAVING COUNT(p.id) > 0
      ORDER BY payment_records DESC
      LIMIT ${parseInt(limit)}
    `;

    const reliabilityData = paymentReliability.map((vendor: any) => {
      const overdueRate = vendor.payment_records > 0 ? (vendor.overdue_count / vendor.payment_records) * 100 : 0;
      const discountUtilization = vendor.payment_records > 0 ? (vendor.discount_eligible / vendor.payment_records) * 100 : 0;
      
      // Calculate reliability score (lower overdue rate = higher score)
      const reliabilityScore = Math.max(0, 100 - (overdueRate * 2));
      
      return {
        vendorName: vendor.vendorName,
        paymentRecords: vendor.payment_records,
        avgPaymentTerms: parseFloat(vendor.avg_payment_terms),
        avgDiscountRate: parseFloat(vendor.avg_discount_rate),
        overdueCount: vendor.overdue_count,
        overdueRate: Math.round(overdueRate * 100) / 100,
        discountEligible: vendor.discount_eligible,
        discountUtilization: Math.round(discountUtilization * 100) / 100,
        potentialSavings: parseFloat(vendor.potential_savings),
        reliabilityScore: Math.round(reliabilityScore),
        paymentWindow: {
          earliest: vendor.earliest_due,
          latest: vendor.latest_due
        }
      };
    });

    res.json({
      success: true,
      data: reliabilityData,
      metadata: {
        totalVendors: reliabilityData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get payment reliability data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment reliability data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/vendor-analytics/spending-trends
 * @desc Get monthly spending trends by vendor
 */
router.get('/spending-trends', async (req: any, res: any) => {
  try {
    const { months = 12, topVendors = 10 } = req.query;
    
    console.log('📈 Getting vendor spending trends data');

    // First get top vendors by total spend
    const topVendorsList = await prisma.$queryRaw`
      SELECT 
        v.id,
        v."vendorName",
        SUM(i."invoiceTotal")::decimal as total_spend
      FROM "Vendor" v
      JOIN "Invoice" i ON v.id = i."vendorId"
      WHERE i."invoiceDate" >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY v.id, v."vendorName"
      ORDER BY total_spend DESC
      LIMIT ${parseInt(topVendors)}
    `;

    const vendorIds = topVendorsList.map((v: any) => v.id);

    // Get monthly trends for top vendors
    const spendingTrends = await prisma.$queryRaw`
      SELECT 
        v."vendorName",
        DATE_TRUNC('month', i."invoiceDate") as month,
        COUNT(i.id)::int as invoice_count,
        COALESCE(SUM(i."invoiceTotal"), 0)::decimal as monthly_spend,
        COALESCE(AVG(i."invoiceTotal"), 0)::decimal as avg_invoice_value
      FROM "Vendor" v
      JOIN "Invoice" i ON v.id = i."vendorId"
      WHERE v.id = ANY(${vendorIds}::uuid[])
        AND i."invoiceDate" >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY v.id, v."vendorName", DATE_TRUNC('month', i."invoiceDate")
      ORDER BY v."vendorName", month DESC
    `;

    // Group by vendor
    const trendsByVendor = spendingTrends.reduce((acc: any, record: any) => {
      const vendorName = record.vendorName;
      if (!acc[vendorName]) {
        acc[vendorName] = [];
      }
      acc[vendorName].push({
        month: record.month,
        invoiceCount: record.invoice_count,
        monthlySpend: parseFloat(record.monthly_spend),
        avgInvoiceValue: parseFloat(record.avg_invoice_value)
      });
      return acc;
    }, {});

    // Calculate trend metrics
    const trendsData = Object.entries(trendsByVendor).map(([vendorName, trends]: [string, any]) => {
      const sortedTrends = trends.sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime());
      const totalSpend = trends.reduce((sum: number, t: any) => sum + t.monthlySpend, 0);
      const avgMonthlySpend = totalSpend / trends.length;
      
      // Calculate growth rate (last 3 months vs previous 3 months)
      const recent = sortedTrends.slice(-3);
      const previous = sortedTrends.slice(-6, -3);
      const recentAvg = recent.reduce((sum: number, t: any) => sum + t.monthlySpend, 0) / recent.length;
      const previousAvg = previous.length > 0 ? previous.reduce((sum: number, t: any) => sum + t.monthlySpend, 0) / previous.length : recentAvg;
      const growthRate = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

      return {
        vendorName,
        trends: sortedTrends,
        summary: {
          totalSpend,
          avgMonthlySpend: Math.round(avgMonthlySpend * 100) / 100,
          growthRate: Math.round(growthRate * 100) / 100,
          activeMonths: trends.length,
          totalInvoices: trends.reduce((sum: number, t: any) => sum + t.invoiceCount, 0)
        }
      };
    });

    res.json({
      success: true,
      data: trendsData,
      metadata: {
        timeframe: `${months} months`,
        topVendorsCount: parseInt(topVendors),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get spending trends data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get spending trends data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/vendor-analytics/risk-assessment
 * @desc Get vendor risk assessment metrics
 */
router.get('/risk-assessment', async (req: any, res: any) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log('⚠️ Getting vendor risk assessment data');

    const riskAssessment = await prisma.$queryRaw`
      SELECT 
        v."vendorName",
        v."vendorTaxId",
        COUNT(i.id)::int as total_invoices,
        COALESCE(SUM(i."invoiceTotal"), 0)::decimal as total_exposure,
        COALESCE(AVG(i."invoiceTotal"), 0)::decimal as avg_invoice_value,
        COALESCE(STDDEV(i."invoiceTotal"), 0)::decimal as invoice_variability,
        COUNT(CASE WHEN i."invoiceDate" > i."deliveryDate" + INTERVAL '30 days' THEN 1 END)::int as late_invoices,
        COUNT(CASE WHEN p."dueDate" < CURRENT_DATE THEN 1 END)::int as overdue_payments,
        COALESCE(AVG(EXTRACT(days FROM (p."dueDate" - i."invoiceDate"))), 0)::decimal as avg_payment_window,
        MIN(i."invoiceDate") as relationship_start,
        MAX(i."invoiceDate") as last_activity,
        COUNT(DISTINCT DATE_TRUNC('month', i."invoiceDate"))::int as active_months
      FROM "Vendor" v
      JOIN "Invoice" i ON v.id = i."vendorId"
      LEFT JOIN "Payment" p ON i.id = p."invoiceId"
      WHERE i."invoiceDate" >= CURRENT_DATE - INTERVAL '24 months'
      GROUP BY v.id, v."vendorName", v."vendorTaxId"
      HAVING COUNT(i.id) > 0
      ORDER BY total_exposure DESC
      LIMIT ${parseInt(limit)}
    `;

    const riskData = riskAssessment.map((vendor: any) => {
      const totalInvoices = vendor.total_invoices;
      const totalExposure = parseFloat(vendor.total_exposure);
      const avgInvoiceValue = parseFloat(vendor.avg_invoice_value);
      const invoiceVariability = parseFloat(vendor.invoice_variability);
      const lateInvoiceRate = totalInvoices > 0 ? (vendor.late_invoices / totalInvoices) * 100 : 0;
      const overdueRate = totalInvoices > 0 ? (vendor.overdue_payments / totalInvoices) * 100 : 0;
      
      // Calculate risk scores (0-100, higher = more risky)
      const exposureRisk = Math.min(100, (totalExposure / 1000000) * 100); // Normalize to $1M = 100%
      const variabilityRisk = avgInvoiceValue > 0 ? Math.min(100, (invoiceVariability / avgInvoiceValue) * 100) : 0;
      const timelinessRisk = Math.min(100, lateInvoiceRate * 2);
      const paymentRisk = Math.min(100, overdueRate * 3);
      
      // Overall risk score (weighted average)
      const overallRisk = Math.round(
        (exposureRisk * 0.3 + variabilityRisk * 0.2 + timelinessRisk * 0.25 + paymentRisk * 0.25)
      );
      
      // Risk category
      let riskCategory = 'Low';
      if (overallRisk > 70) riskCategory = 'High';
      else if (overallRisk > 40) riskCategory = 'Medium';
      
      return {
        vendorName: vendor.vendorName,
        vendorTaxId: vendor.vendorTaxId,
        totalInvoices,
        totalExposure,
        avgInvoiceValue,
        invoiceVariability,
        lateInvoices: vendor.late_invoices,
        lateInvoiceRate: Math.round(lateInvoiceRate * 100) / 100,
        overduePayments: vendor.overdue_payments,
        overdueRate: Math.round(overdueRate * 100) / 100,
        avgPaymentWindow: parseFloat(vendor.avg_payment_window),
        relationshipDuration: {
          start: vendor.relationship_start,
          lastActivity: vendor.last_activity,
          activeMonths: vendor.active_months
        },
        riskScores: {
          overall: overallRisk,
          exposure: Math.round(exposureRisk),
          variability: Math.round(variabilityRisk),
          timeliness: Math.round(timelinessRisk),
          payment: Math.round(paymentRisk)
        },
        riskCategory
      };
    });

    res.json({
      success: true,
      data: riskData,
      metadata: {
        totalVendors: riskData.length,
        riskDistribution: {
          high: riskData.filter((v: any) => v.riskCategory === 'High').length,
          medium: riskData.filter((v: any) => v.riskCategory === 'Medium').length,
          low: riskData.filter((v: any) => v.riskCategory === 'Low').length
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get risk assessment data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get risk assessment data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/vendor-analytics/category-analysis
 * @desc Get vendor spending analysis by categories (based on line items)
 */
router.get('/category-analysis', async (req: any, res: any) => {
  try {
    const { limit = 15 } = req.query;
    
    console.log('📊 Getting vendor category analysis data');

    const categoryAnalysis = await prisma.$queryRaw`
      SELECT 
        v."vendorName",
        COALESCE(li.description, 'Uncategorized') as category,
        COUNT(li.id)::int as item_count,
        COALESCE(SUM(li."totalPrice"), 0)::decimal as category_spend,
        COALESCE(AVG(li."unitPrice"), 0)::decimal as avg_unit_price,
        COALESCE(AVG(li.quantity), 0)::decimal as avg_quantity
      FROM "Vendor" v
      JOIN "Invoice" i ON v.id = i."vendorId"
      JOIN "LineItem" li ON i.id = li."invoiceId"
      WHERE i."invoiceDate" >= CURRENT_DATE - INTERVAL '12 months'
        AND li."totalPrice" IS NOT NULL
      GROUP BY v.id, v."vendorName", li.description
      HAVING COUNT(li.id) > 0
      ORDER BY category_spend DESC
      LIMIT ${parseInt(limit) * 5}
    `;

    // Group by vendor and calculate category distributions
    const vendorCategories = categoryAnalysis.reduce((acc: any, record: any) => {
      const vendorName = record.vendorName;
      if (!acc[vendorName]) {
        acc[vendorName] = {
          vendorName,
          categories: [],
          totalSpend: 0,
          totalItems: 0
        };
      }
      
      const categorySpend = parseFloat(record.category_spend);
      acc[vendorName].categories.push({
        category: record.category,
        itemCount: record.item_count,
        categorySpend,
        avgUnitPrice: parseFloat(record.avg_unit_price),
        avgQuantity: parseFloat(record.avg_quantity)
      });
      
      acc[vendorName].totalSpend += categorySpend;
      acc[vendorName].totalItems += record.item_count;
      
      return acc;
    }, {});

    // Calculate percentages and sort
    const categoryData = Object.values(vendorCategories)
      .map((vendor: any) => {
        // Sort categories by spend and calculate percentages
        vendor.categories = vendor.categories
          .sort((a: any, b: any) => b.categorySpend - a.categorySpend)
          .map((cat: any) => ({
            ...cat,
            percentage: vendor.totalSpend > 0 ? Math.round((cat.categorySpend / vendor.totalSpend) * 10000) / 100 : 0
          }));
        
        return vendor;
      })
      .sort((a: any, b: any) => b.totalSpend - a.totalSpend)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: categoryData,
      metadata: {
        totalVendors: categoryData.length,
        timeframe: '12 months',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get category analysis data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get category analysis data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/vendor-analytics/summary
 * @desc Get overall vendor analytics summary
 */
router.get('/summary', async (req: any, res: any) => {
  try {
    console.log('📋 Getting vendor analytics summary');

    const summary = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT v.id)::int as total_vendors,
        COUNT(DISTINCT i.id)::int as total_invoices,
        COALESCE(SUM(i."invoiceTotal"), 0)::decimal as total_spend,
        COALESCE(AVG(i."invoiceTotal"), 0)::decimal as avg_invoice_value,
        COUNT(DISTINCT CASE WHEN i."invoiceDate" >= CURRENT_DATE - INTERVAL '30 days' THEN v.id END)::int as active_vendors_30d,
        COUNT(DISTINCT CASE WHEN i."invoiceDate" >= CURRENT_DATE - INTERVAL '90 days' THEN v.id END)::int as active_vendors_90d,
        COUNT(CASE WHEN p."dueDate" < CURRENT_DATE THEN 1 END)::int as overdue_invoices,
        COALESCE(SUM(CASE WHEN p."dueDate" < CURRENT_DATE THEN i."invoiceTotal" ELSE 0 END), 0)::decimal as overdue_amount
      FROM "Vendor" v
      LEFT JOIN "Invoice" i ON v.id = i."vendorId"
      LEFT JOIN "Payment" p ON i.id = p."invoiceId"
      WHERE i."invoiceDate" >= CURRENT_DATE - INTERVAL '12 months'
    `;

    const summaryData = summary[0];

    res.json({
      success: true,
      data: {
        totalVendors: summaryData.total_vendors,
        totalInvoices: summaryData.total_invoices,
        totalSpend: parseFloat(summaryData.total_spend),
        avgInvoiceValue: parseFloat(summaryData.avg_invoice_value),
        activeVendors: {
          last30Days: summaryData.active_vendors_30d,
          last90Days: summaryData.active_vendors_90d
        },
        overdueMetrics: {
          invoiceCount: summaryData.overdue_invoices,
          totalAmount: parseFloat(summaryData.overdue_amount)
        }
      },
      metadata: {
        timeframe: '12 months',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get vendor analytics summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get vendor analytics summary',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
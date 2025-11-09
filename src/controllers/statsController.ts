const prisma = require('../services/prismaClient');

// GET /stats - Returns totals for overview cards
const getStats = async (req: any, res: any) => {
  try {
    // Get total invoices count
    const totalInvoices = await prisma.invoice.count();

    // Get total spend amount
    const totalSpendResult = await prisma.invoice.aggregate({
      _sum: {
        invoiceTotal: true
      }
    });
    const totalSpend = totalSpendResult._sum.invoiceTotal || 0;

    // Get unique vendor count
    const vendorCount = await prisma.vendor.count();

    // Get pending payments (invoices without payments or partial payments)
    const pendingPayments = await prisma.invoice.count({
      where: {
        Payments: {
          none: {}
        }
      }
    });

    // Get current month stats for comparison
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const currentMonthInvoices = await prisma.invoice.count({
      where: {
        invoiceDate: {
          gte: firstDayOfMonth
        }
      }
    });

    const currentMonthSpendResult = await prisma.invoice.aggregate({
      where: {
        invoiceDate: {
          gte: firstDayOfMonth
        }
      },
      _sum: {
        invoiceTotal: true
      }
    });
    const currentMonthSpend = currentMonthSpendResult._sum.invoiceTotal || 0;

    res.json({
      totalInvoices,
      totalSpend: parseFloat(totalSpend.toString()),
      vendorCount,
      pendingPayments,
      currentMonth: {
        invoices: currentMonthInvoices,
        spend: parseFloat(currentMonthSpend.toString())
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// GET /invoice-trends - Returns monthly invoice count and spend
const getInvoiceTrends = async (req: any, res: any) => {
  try {
    // Get last 12 months of data
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Raw SQL query to get monthly aggregated data
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "invoiceDate") as month,
        COUNT(*)::int as invoice_count,
        COALESCE(SUM("invoiceTotal"), 0) as total_spend
      FROM "Invoice"
      WHERE "invoiceDate" >= ${twelveMonthsAgo}
        AND "invoiceDate" IS NOT NULL
      GROUP BY DATE_TRUNC('month', "invoiceDate")
      ORDER BY month ASC
    `;

    // Format the response
    const formattedTrends = monthlyTrends.map((trend: any) => ({
      month: trend.month.toISOString().substring(0, 7), // YYYY-MM format
      invoiceCount: trend.invoice_count,
      totalSpend: parseFloat(trend.total_spend.toString())
    }));

    res.json(formattedTrends);
  } catch (error) {
    console.error('Error fetching invoice trends:', error);
    res.status(500).json({ error: 'Failed to fetch invoice trends' });
  }
};

module.exports = {
  getStats,
  getInvoiceTrends
};
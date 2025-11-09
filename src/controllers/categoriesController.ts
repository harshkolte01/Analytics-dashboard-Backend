const prisma = require('../services/prismaClient');

// GET /category-spend - Returns spend grouped by category (sachkonto)
const getCategorySpend = async (req: any, res: any) => {
  try {
    // Get date range from query parameters (optional)
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    // Build where clause for date filtering
    let whereClause: any = {
      sachkonto: {
        not: null
      }
    };

    if (startDate || endDate) {
      whereClause.invoice = {};
      if (startDate) {
        whereClause.invoice.invoiceDate = { gte: startDate };
      }
      if (endDate) {
        whereClause.invoice.invoiceDate = {
          ...whereClause.invoice.invoiceDate,
          lte: endDate
        };
      }
    }

    // Get line items grouped by sachkonto (category)
    const categorySpend = await prisma.lineItem.groupBy({
      by: ['sachkonto'],
      where: whereClause,
      _sum: {
        totalPrice: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc'
        }
      }
    });

    // Format the response
    const formattedCategorySpend = categorySpend.map((category: any) => ({
      category: category.sachkonto,
      totalSpend: category._sum.totalPrice ? parseFloat(category._sum.totalPrice.toString()) : 0,
      itemCount: category._count._all
    }));

    // Get total spend for percentage calculations
    const totalSpend = formattedCategorySpend.reduce((sum: number, category: any) => sum + category.totalSpend, 0);

    // Add percentage to each category
    const categorySpendWithPercentage = formattedCategorySpend.map((category: any) => ({
      ...category,
      percentage: totalSpend > 0 ? ((category.totalSpend / totalSpend) * 100).toFixed(2) : '0.00'
    }));

    res.json({
      categories: categorySpendWithPercentage,
      totalSpend,
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null
      }
    });
  } catch (error) {
    console.error('Error fetching category spend:', error);
    res.status(500).json({ error: 'Failed to fetch category spend data' });
  }
};

// GET /category-spend/summary - Returns category spend summary with top categories
const getCategorySpendSummary = async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get top categories by spend
    const topCategories = await prisma.lineItem.groupBy({
      by: ['sachkonto'],
      where: {
        sachkonto: {
          not: null
        }
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc'
        }
      },
      take: limit
    });

    // Get total categories count
    const totalCategoriesResult = await prisma.lineItem.groupBy({
      by: ['sachkonto'],
      where: {
        sachkonto: {
          not: null
        }
      }
    });
    const totalCategories = totalCategoriesResult.length;

    // Format response
    const formattedCategories = topCategories.map((category: any) => ({
      category: category.sachkonto,
      totalSpend: category._sum.totalPrice ? parseFloat(category._sum.totalPrice.toString()) : 0,
      itemCount: category._count._all
    }));

    res.json({
      topCategories: formattedCategories,
      totalCategories,
      showing: Math.min(limit, formattedCategories.length)
    });
  } catch (error) {
    console.error('Error fetching category spend summary:', error);
    res.status(500).json({ error: 'Failed to fetch category spend summary' });
  }
};

module.exports = {
  getCategorySpend,
  getCategorySpendSummary
};
const prisma = require('../services/prismaClient');

// GET /cash-outflow - Returns expected cash outflow by date range
const getCashOutflow = async (req: any, res: any) => {
  try {
    // Get date range from query parameters
    // For demo purposes, default to a broader range that includes historical data
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date('2020-01-01');
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date('2030-12-31');

    // Get payments with due dates in the specified range
    const upcomingPayments = await prisma.payment.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate
        },
        invoice: {
          invoiceTotal: {
            not: null
          }
        }
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            invoiceTotal: true,
            vendor: {
              select: {
                vendorName: true
              }
            }
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    // Group payments by week for better visualization
    const weeklyOutflow: any = {};
    const dailyOutflow: any = {};

    upcomingPayments.forEach((payment: any) => {
      const dueDate = new Date(payment.dueDate);
      const dateKey = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get week start (Monday)
      const weekStart = new Date(dueDate);
      weekStart.setDate(dueDate.getDate() - dueDate.getDay() + 1);
      const weekKey = weekStart.toISOString().split('T')[0];

      const amount = payment.invoice?.invoiceTotal ? parseFloat(payment.invoice.invoiceTotal.toString()) : 0;

      // Daily grouping
      if (!dailyOutflow[dateKey as string]) {
        dailyOutflow[dateKey as string] = {
          date: dateKey,
          totalAmount: 0,
          paymentCount: 0,
          payments: []
        };
      }
      dailyOutflow[dateKey as string].totalAmount += amount;
      dailyOutflow[dateKey as string].paymentCount += 1;
      dailyOutflow[dateKey as string].payments.push({
        id: payment.id,
        invoiceId: payment.invoice?.id,
        invoiceNumber: payment.invoice?.invoiceNumber,
        vendorName: payment.invoice?.vendor?.vendorName,
        amount,
        dueDate: payment.dueDate,
        paymentTerms: payment.paymentTerms
      });

      // Weekly grouping
      if (!weeklyOutflow[weekKey as string]) {
        weeklyOutflow[weekKey as string] = {
          weekStart: weekKey,
          totalAmount: 0,
          paymentCount: 0
        };
      }
      weeklyOutflow[weekKey as string].totalAmount += amount;
      weeklyOutflow[weekKey as string].paymentCount += 1;
    });

    // Convert objects to arrays and sort
    const dailyOutflowArray = Object.values(dailyOutflow).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const weeklyOutflowArray = Object.values(weeklyOutflow).sort((a: any, b: any) => 
      new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
    );

    // Calculate totals
    const totalOutflow = upcomingPayments.reduce((sum: number, payment: any) => {
      const amount = payment.invoice?.invoiceTotal ? parseFloat(payment.invoice.invoiceTotal.toString()) : 0;
      return sum + amount;
    }, 0);

    res.json({
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      summary: {
        totalOutflow,
        totalPayments: upcomingPayments.length
      },
      dailyOutflow: dailyOutflowArray,
      weeklyOutflow: weeklyOutflowArray
    });
  } catch (error) {
    console.error('Error fetching cash outflow:', error);
    res.status(500).json({ error: 'Failed to fetch cash outflow data' });
  }
};

// GET /cash-outflow/overdue - Returns overdue payments
const getOverduePayments = async (req: any, res: any) => {
  try {
    const currentDate = new Date();

    const overduePayments = await prisma.payment.findMany({
      where: {
        dueDate: {
          lt: currentDate
        },
        invoice: {
          invoiceTotal: {
            not: null
          }
        }
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            invoiceTotal: true,
            vendor: {
              select: {
                vendorName: true
              }
            }
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    const totalOverdue = overduePayments.reduce((sum: number, payment: any) => {
      const amount = payment.invoice?.invoiceTotal ? parseFloat(payment.invoice.invoiceTotal.toString()) : 0;
      return sum + amount;
    }, 0);

    const formattedPayments = overduePayments.map((payment: any) => ({
      id: payment.id,
      invoiceId: payment.invoice?.id,
      invoiceNumber: payment.invoice?.invoiceNumber,
      vendorName: payment.invoice?.vendor?.vendorName,
      amount: payment.invoice?.invoiceTotal ? parseFloat(payment.invoice.invoiceTotal.toString()) : 0,
      dueDate: payment.dueDate,
      daysPastDue: Math.floor((currentDate.getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      paymentTerms: payment.paymentTerms
    }));

    res.json({
      overduePayments: formattedPayments,
      summary: {
        totalOverdue,
        totalCount: overduePayments.length
      }
    });
  } catch (error) {
    console.error('Error fetching overdue payments:', error);
    res.status(500).json({ error: 'Failed to fetch overdue payments' });
  }
};

module.exports = {
  getCashOutflow,
  getOverduePayments
};
const prisma = require('../services/prismaClient');

// GET /invoices - Returns list of invoices with filters/search
const getInvoices = async (req: any, res: any) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Search and filter parameters
    const search = req.query.search || '';
    const vendorId = req.query.vendorId;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount) : null;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount) : null;
    const status = req.query.status; // 'paid', 'pending', 'overdue'

    // Build where clause
    let whereClause: any = {};

    // Search in invoice number or vendor name
    if (search) {
      whereClause.OR = [
        {
          invoiceNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          vendor: {
            vendorName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Vendor filter
    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.invoiceDate = {};
      if (startDate) {
        whereClause.invoiceDate.gte = startDate;
      }
      if (endDate) {
        whereClause.invoiceDate.lte = endDate;
      }
    }

    // Amount range filter
    if (minAmount !== null || maxAmount !== null) {
      whereClause.invoiceTotal = {};
      if (minAmount !== null) {
        whereClause.invoiceTotal.gte = minAmount;
      }
      if (maxAmount !== null) {
        whereClause.invoiceTotal.lte = maxAmount;
      }
    }

    // Status filter (requires complex logic)
    if (status) {
      const currentDate = new Date();
      switch (status) {
        case 'paid':
          whereClause.Payments = {
            some: {}
          };
          break;
        case 'pending':
          whereClause.AND = [
            {
              Payments: {
                none: {}
              }
            },
            {
              OR: [
                {
                  Payments: {
                    none: {
                      dueDate: {
                        lt: currentDate
                      }
                    }
                  }
                },
                {
                  Payments: {
                    every: {
                      dueDate: {
                        gte: currentDate
                      }
                    }
                  }
                }
              ]
            }
          ];
          break;
        case 'overdue':
          whereClause.AND = [
            {
              Payments: {
                none: {}
              }
            },
            {
              Payments: {
                some: {
                  dueDate: {
                    lt: currentDate
                  }
                }
              }
            }
          ];
          break;
      }
    }

    // Get invoices with related data
    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          vendor: {
            select: {
              id: true,
              vendorName: true,
              vendorPartyNumber: true
            }
          },
          customer: {
            select: {
              id: true,
              customerName: true
            }
          },
          Payments: {
            select: {
              id: true,
              dueDate: true,
              paymentTerms: true
            }
          },
          LineItems: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              sachkonto: true
            }
          },
          _count: {
            select: {
              LineItems: true,
              Payments: true
            }
          }
        },
        orderBy: {
          invoiceDate: 'desc'
        }
      }),
      prisma.invoice.count({ where: whereClause })
    ]);

    // Format the response with additional computed fields
    const formattedInvoices = invoices.map((invoice: any) => {
      const hasPayments = invoice.Payments.length > 0;
      const isOverdue = invoice.Payments.some((payment: any) => 
        payment.dueDate && new Date(payment.dueDate) < new Date()
      );

      let paymentStatus = 'pending';
      if (hasPayments) {
        paymentStatus = 'paid';
      } else if (isOverdue) {
        paymentStatus = 'overdue';
      }

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        deliveryDate: invoice.deliveryDate,
        documentType: invoice.documentType,
        currencySymbol: invoice.currencySymbol,
        subTotal: invoice.subTotal ? parseFloat(invoice.subTotal.toString()) : null,
        totalTax: invoice.totalTax ? parseFloat(invoice.totalTax.toString()) : null,
        invoiceTotal: invoice.invoiceTotal ? parseFloat(invoice.invoiceTotal.toString()) : null,
        vendor: invoice.vendor,
        customer: invoice.customer,
        paymentStatus,
        lineItemsCount: invoice._count.LineItems,
        paymentsCount: invoice._count.Payments,
        nextDueDate: invoice.Payments.length > 0 
          ? invoice.Payments.reduce((earliest: any, payment: any) => {
              if (!payment.dueDate) return earliest;
              return !earliest || payment.dueDate < earliest ? payment.dueDate : earliest;
            }, null)
          : null,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
      };
    });

    res.json({
      invoices: formattedInvoices,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: {
        search,
        vendorId,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        minAmount,
        maxAmount,
        status
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// GET /invoices/:id - Returns single invoice with full details
const getInvoiceById = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        customer: true,
        document: {
          select: {
            id: true,
            name: true,
            filePath: true,
            fileType: true,
            fileSize: true,
            status: true,
            createdAt: true
          }
        },
        Payments: true,
        LineItems: {
          orderBy: {
            srNo: 'asc'
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Format the response
    const formattedInvoice = {
      ...invoice,
      subTotal: invoice.subTotal ? parseFloat(invoice.subTotal.toString()) : null,
      totalTax: invoice.totalTax ? parseFloat(invoice.totalTax.toString()) : null,
      invoiceTotal: invoice.invoiceTotal ? parseFloat(invoice.invoiceTotal.toString()) : null,
      LineItems: invoice.LineItems.map((item: any) => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity.toString()) : null,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : null,
        totalPrice: item.totalPrice ? parseFloat(item.totalPrice.toString()) : null,
        vatRate: item.vatRate ? parseFloat(item.vatRate.toString()) : null,
        vatAmount: item.vatAmount ? parseFloat(item.vatAmount.toString()) : null
      })),
      Payments: invoice.Payments.map((payment: any) => ({
        ...payment,
        discountPercentage: payment.discountPercentage ? parseFloat(payment.discountPercentage.toString()) : null,
        discountedTotal: payment.discountedTotal ? parseFloat(payment.discountedTotal.toString()) : null
      }))
    };

    res.json(formattedInvoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById
};
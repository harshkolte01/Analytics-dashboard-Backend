const prisma = require('../services/prismaClient');

// GET /vendors/top10 - Returns top 10 vendors by spend
const getTop10Vendors = async (req: any, res: any) => {
  try {
    // Get top 10 vendors by total spend
    const topVendors = await prisma.vendor.findMany({
      select: {
        id: true,
        vendorName: true,
        vendorPartyNumber: true,
        vendorAddress: true,
        firstSeen: true,
        lastSeen: true,
        Invoices: {
          select: {
            invoiceTotal: true,
            invoiceDate: true
          }
        }
      }
    });

    // Calculate total spend for each vendor and sort
    const vendorsWithSpend = topVendors.map((vendor: any) => {
      const totalSpend = vendor.Invoices.reduce((sum: number, invoice: any) => {
        return sum + (invoice.invoiceTotal ? parseFloat(invoice.invoiceTotal.toString()) : 0);
      }, 0);

      const invoiceCount = vendor.Invoices.length;
      
      // Get latest invoice date
      const latestInvoiceDate = vendor.Invoices.reduce((latest: any, invoice: any) => {
        if (!invoice.invoiceDate) return latest;
        return !latest || invoice.invoiceDate > latest ? invoice.invoiceDate : latest;
      }, null as Date | null);

      return {
        id: vendor.id,
        vendorName: vendor.vendorName,
        vendorPartyNumber: vendor.vendorPartyNumber,
        vendorAddress: vendor.vendorAddress,
        totalSpend,
        invoiceCount,
        firstSeen: vendor.firstSeen,
        lastSeen: vendor.lastSeen,
        latestInvoiceDate
      };
    });

    // Sort by total spend (descending) and take top 10
    const top10 = vendorsWithSpend
      .sort((a: any, b: any) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    res.json(top10);
  } catch (error) {
    console.error('Error fetching top vendors:', error);
    res.status(500).json({ error: 'Failed to fetch top vendors' });
  }
};

// GET /vendors - Returns all vendors with pagination
const getAllVendors = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [vendors, totalCount] = await Promise.all([
      prisma.vendor.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          vendorName: true,
          vendorPartyNumber: true,
          vendorAddress: true,
          vendorTaxId: true,
          firstSeen: true,
          lastSeen: true,
          _count: {
            select: {
              Invoices: true
            }
          }
        },
        orderBy: {
          vendorName: 'asc'
        }
      }),
      prisma.vendor.count()
    ]);

    res.json({
      vendors,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
};

module.exports = {
  getTop10Vendors,
  getAllVendors
};
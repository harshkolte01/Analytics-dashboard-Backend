const { PrismaClient } = require('../src/generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to parse MongoDB date format
function parseMongoDate(mongoDate: any): Date | null {
  if (!mongoDate) return null;
  if (typeof mongoDate === 'string') return new Date(mongoDate);
  if (mongoDate.$date) return new Date(mongoDate.$date);
  return null;
}

// Helper function to parse MongoDB NumberLong format
function parseMongoNumber(mongoNumber: any): number | null {
  if (!mongoNumber) return null;
  if (typeof mongoNumber === 'number') return mongoNumber;
  if (mongoNumber.$numberLong) return parseInt(mongoNumber.$numberLong);
  return null;
}

// Helper function to safely convert to decimal
function toDecimal(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

// Helper function to safely convert to integer
function toInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseInt(value) : value;
  return isNaN(num) ? null : num;
}

// Data transformation functions
function transformDocument(doc: any) {
  return {
    sourceId: doc._id,
    name: doc.name || null,
    filePath: doc.filePath || null,
    fileSize: parseMongoNumber(doc.fileSize),
    fileType: doc.fileType || null,
    status: doc.status || null,
    organizationId: doc.organizationId || null,
    departmentId: doc.departmentId || null,
    createdAt: parseMongoDate(doc.createdAt),
    updatedAt: parseMongoDate(doc.updatedAt),
    processedAt: parseMongoDate(doc.processedAt),
    uploadedById: doc.uploadedById || null,
    isValidatedByHuman: doc.isValidatedByHuman || false,
    analyticsId: doc.analyticsId || null,
    metadata: doc.metadata || null,
    extractedData: doc.extractedData || null,
    validatedData: doc.validatedData || null,
    validatedAt: parseMongoDate(doc.validatedData?.lastValidatedAt),
    validatedBy: doc.validatedData?.validatedBy || doc.extractedData?.validatedBy || null,
  };
}

function transformVendor(doc: any, documentId: string) {
  const vendorData = doc.extractedData?.llmData?.vendor?.value;
  if (!vendorData || !vendorData.vendorName?.value) return null;

  return {
    vendorName: vendorData.vendorName.value,
    vendorPartyNumber: vendorData.vendorPartyNumber?.value || null,
    vendorAddress: vendorData.vendorAddress?.value || null,
    vendorTaxId: vendorData.vendorTaxId?.value || null,
    firstSeen: parseMongoDate(doc.createdAt),
    lastSeen: parseMongoDate(doc.updatedAt),
    canonicalDocumentId: documentId,
  };
}

function transformCustomer(doc: any, documentId: string) {
  const customerData = doc.extractedData?.llmData?.customer?.value;
  if (!customerData || !customerData.customerName?.value) return null;

  return {
    customerName: customerData.customerName.value,
    customerAddress: customerData.customerAddress?.value || null,
    firstSeen: parseMongoDate(doc.createdAt),
    lastSeen: parseMongoDate(doc.updatedAt),
    canonicalDocumentId: documentId,
  };
}

function transformInvoice(doc: any, documentId: string, vendorId?: string, customerId?: string) {
  const invoiceData = doc.extractedData?.llmData?.invoice?.value;
  const summaryData = doc.extractedData?.llmData?.summary?.value;
  
  if (!invoiceData && !summaryData) return null;

  return {
    documentId: documentId,
    invoiceNumber: invoiceData?.invoiceId?.value || null,
    invoiceDate: parseMongoDate(invoiceData?.invoiceDate?.value),
    deliveryDate: parseMongoDate(invoiceData?.deliveryDate?.value),
    documentType: summaryData?.documentType?.value || null,
    currencySymbol: summaryData?.currencySymbol?.value || null,
    subTotal: toDecimal(summaryData?.subTotal?.value),
    totalTax: toDecimal(summaryData?.totalTax?.value),
    invoiceTotal: toDecimal(summaryData?.invoiceTotal?.value),
    vendorId: vendorId || null,
    customerId: customerId || null,
    notes: null,
  };
}

function transformPayment(doc: any, documentId: string, invoiceId?: string) {
  const paymentData = doc.extractedData?.llmData?.payment?.value;
  if (!paymentData) return null;

  return {
    invoiceId: invoiceId || null,
    documentId: documentId,
    dueDate: parseMongoDate(paymentData.dueDate?.value),
    paymentTerms: paymentData.paymentTerms?.value || null,
    bankAccountNumber: paymentData.bankAccountNumber?.value || null,
    bic: paymentData.BIC?.value || null,
    accountName: paymentData.accountName?.value || null,
    netDays: toInt(paymentData.netDays?.value),
    discountPercentage: toDecimal(paymentData.discountPercentage?.value),
    discountDays: toInt(paymentData.discountDays?.value),
    discountDueDate: parseMongoDate(paymentData.discountDueDate?.value),
    discountedTotal: toDecimal(paymentData.discountedTotal?.value),
    sourceRaw: paymentData,
  };
}

function transformLineItems(doc: any, documentId: string, invoiceId?: string) {
  const lineItemsData = doc.extractedData?.llmData?.lineItems?.value?.items?.value;
  if (!lineItemsData || !Array.isArray(lineItemsData)) return [];

  return lineItemsData.map((item: any) => ({
    invoiceId: invoiceId || null,
    documentId: documentId,
    srNo: toInt(item.srNo?.value),
    description: item.description?.value || null,
    quantity: toDecimal(item.quantity?.value),
    unitPrice: toDecimal(item.unitPrice?.value),
    totalPrice: toDecimal(item.totalPrice?.value),
    sachkonto: item.Sachkonto?.value ? String(item.Sachkonto.value) : null,
    buSchluessel: item.BUSchluessel?.value ? String(item.BUSchluessel.value) : null,
    vatRate: toDecimal(item.vatRate?.value),
    vatAmount: toDecimal(item.vatAmount?.value),
    sourceRaw: item,
  }));
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Read the JSON file
    const jsonPath = path.join(__dirname, 'Analytics_Test_Data.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log(`📊 Found ${jsonData.length} documents to process`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    await prisma.lineItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.extractionAudit.deleteMany();
    await prisma.entityAlias.deleteMany();
    await prisma.document.deleteMany();
    await prisma.user.deleteMany();
    await prisma.department.deleteMany();
    await prisma.organization.deleteMany();

    // Collect unique organizations, departments, and users
    const organizations = new Set<string>();
    const departments = new Set<string>();
    const users = new Set<string>();

    jsonData.forEach((doc: any) => {
      if (doc.organizationId) organizations.add(doc.organizationId);
      if (doc.departmentId) departments.add(doc.departmentId);
      if (doc.uploadedById) users.add(doc.uploadedById);
      if (doc.extractedData?.validatedBy) users.add(doc.extractedData.validatedBy);
      if (doc.validatedData?.validatedBy) users.add(doc.validatedData.validatedBy);
    });

    // Create organizations
    console.log(`🏢 Creating ${organizations.size} organizations...`);
    const orgArray = Array.from(organizations);
    for (const orgId of orgArray) {
      await prisma.organization.upsert({
        where: { id: orgId },
        update: {},
        create: {
          id: orgId,
          name: `Organization ${orgId.slice(-8)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create departments
    console.log(`🏬 Creating ${departments.size} departments...`);
    const deptArray = Array.from(departments);
    for (const deptId of deptArray) {
      // Find an organization for this department
      const orgId = jsonData.find((doc: any) => doc.departmentId === deptId)?.organizationId;
      
      await prisma.department.upsert({
        where: { id: deptId },
        update: {},
        create: {
          id: deptId,
          organizationId: orgId || null,
          name: `Department ${deptId.slice(-8)}`,
        },
      });
    }

    // Create users
    console.log(`👥 Creating ${users.size} users...`);
    const userArray = Array.from(users);
    for (const userId of userArray) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `user-${userId.slice(-8)}@example.com`,
          name: `User ${userId.slice(-8)}`,
        },
      });
    }

    // Process documents and related data
    console.log('📄 Processing documents and related data...');
    let processedCount = 0;

    for (const doc of jsonData) {
      try {
        // Transform and create document
        const documentData = transformDocument(doc);
        const createdDocument = await prisma.document.create({
          data: documentData,
        });

        // Create vendor if exists
        let vendorId: string | undefined;
        const vendorData = transformVendor(doc, createdDocument.id);
        if (vendorData) {
          try {
            const vendor = await prisma.vendor.create({
              data: vendorData,
            });
            vendorId = vendor.id;
          } catch (error: any) {
            // Handle duplicate vendor tax ID
            if (error.code === 'P2002' && vendorData.vendorTaxId) {
              const existingVendor = await prisma.vendor.findUnique({
                where: { vendorTaxId: vendorData.vendorTaxId },
              });
              vendorId = existingVendor?.id;
            }
          }
        }

        // Create customer if exists
        let customerId: string | undefined;
        const customerData = transformCustomer(doc, createdDocument.id);
        if (customerData) {
          const customer = await prisma.customer.create({
            data: customerData,
          });
          customerId = customer.id;
        }

        // Create invoice if exists
        let invoiceId: string | undefined;
        const invoiceData = transformInvoice(doc, createdDocument.id, vendorId, customerId);
        if (invoiceData) {
          const invoice = await prisma.invoice.create({
            data: invoiceData,
          });
          invoiceId = invoice.id;
        }

        // Create payment if exists
        const paymentData = transformPayment(doc, createdDocument.id, invoiceId);
        if (paymentData) {
          await prisma.payment.create({
            data: paymentData,
          });
        }

        // Create line items if exist
        const lineItemsData = transformLineItems(doc, createdDocument.id, invoiceId);
        if (lineItemsData.length > 0) {
          await prisma.lineItem.createMany({
            data: lineItemsData,
          });
        }

        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`✅ Processed ${processedCount}/${jsonData.length} documents`);
        }

      } catch (error) {
        console.error(`❌ Error processing document ${doc._id}:`, error);
        // Continue with next document
      }
    }

    console.log(`🎉 Successfully seeded database with ${processedCount} documents!`);

    // Print summary statistics
    const stats = await Promise.all([
      prisma.organization.count(),
      prisma.department.count(),
      prisma.user.count(),
      prisma.document.count(),
      prisma.vendor.count(),
      prisma.customer.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.lineItem.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`Organizations: ${stats[0]}`);
    console.log(`Departments: ${stats[1]}`);
    console.log(`Users: ${stats[2]}`);
    console.log(`Documents: ${stats[3]}`);
    console.log(`Vendors: ${stats[4]}`);
    console.log(`Customers: ${stats[5]}`);
    console.log(`Invoices: ${stats[6]}`);
    console.log(`Payments: ${stats[7]}`);
    console.log(`Line Items: ${stats[8]}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase()
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
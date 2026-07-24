'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(authenticate);

// GET all orders with search + filters
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { search, status, customer, certType, process, csWare, ncr } = req.query;

    const where = {};

    // Status filter
    if (status && status !== 'all') where.status = status;

    // Customer filter
    if (customer && customer !== 'all') where.customer = { contains: customer, mode: 'insensitive' };

    // Cert type filter
    if (certType && certType !== 'all') where.typeOfCertRequired = certType;

    // CS Ware filter
    if (csWare && csWare !== 'all') where.customerSuppliedWare = csWare;

    // NCR filter
    if (ncr === 'true') where.ncr = true;
    if (ncr === 'false') where.ncr = false;

    // Search across multiple fields
    if (search) {
      where.OR = [
        { customer:           { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } },
        { lotNumber:          { contains: search, mode: 'insensitive' } },
        { partNumber:         { contains: search, mode: 'insensitive' } },
        { fgNumber:           { contains: search, mode: 'insensitive' } },
        { poNumber:           { contains: search, mode: 'insensitive' } },
        { agreementNumber:    { contains: search, mode: 'insensitive' } },
        { sgsPONumber:        { contains: search, mode: 'insensitive' } },
        { process:            { contains: search, mode: 'insensitive' } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.orderRecord.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.orderRecord.count({ where }),
    ]);

    return paginated(res, records, total, page, limit);
  } catch (e) { next(e); }
});

// GET single order
router.get('/:id', async (req, res, next) => {
  try {
    const record = await prisma.orderRecord.findUnique({ where: { id: parseInt(req.params.id) } });
    return success(res, record);
  } catch (e) { next(e); }
});

// GET filter options (distinct values)
router.get('/meta/filters', async (req, res, next) => {
  try {
    const [statuses, certTypes, csWareOptions] = await Promise.all([
      prisma.orderRecord.findMany({ select: { status: true }, distinct: ['status'], where: { status: { not: null } } }),
      prisma.orderRecord.findMany({ select: { typeOfCertRequired: true }, distinct: ['typeOfCertRequired'], where: { typeOfCertRequired: { not: null } } }),
      prisma.orderRecord.findMany({ select: { customerSuppliedWare: true }, distinct: ['customerSuppliedWare'], where: { customerSuppliedWare: { not: null } } }),
    ]);
    return success(res, {
      statuses:    statuses.map(s => s.status).filter(Boolean),
      certTypes:   certTypes.map(c => c.typeOfCertRequired).filter(Boolean),
      csWareOptions: csWareOptions.map(c => c.customerSuppliedWare).filter(Boolean),
    });
  } catch (e) { next(e); }
});

// POST create order
router.post('/', async (req, res, next) => {
  try {
    const record = await prisma.orderRecord.create({ data: sanitize(req.body) });
    return created(res, record, 'Order record created');
  } catch (e) { next(e); }
});

// PUT update order
router.put('/:id', async (req, res, next) => {
  try {
    const record = await prisma.orderRecord.update({
      where: { id: parseInt(req.params.id) },
      data: sanitize(req.body),
    });
    return success(res, record, 'Order record updated');
  } catch (e) { next(e); }
});

// DELETE order
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.orderRecord.delete({ where: { id: parseInt(req.params.id) } });
    return success(res, null, 'Order record deleted');
  } catch (e) { next(e); }
});

// Helper — sanitize dates and numbers
function sanitize(body) {
  const dateFields = [
    'dateAgreementPORcvd','dateCSWareReceived','dateCSReceivingDocsSubmitted',
    'dateCSDocumentsSavedToServer','dateDACAssigned','dateWOCreatedQA','dateWOApproved',
    'dateMaterialPulled','startDate','actualBioShipDate','dateBFSTestReportsRcvd',
    'dateDTSTestReportsRcvd','dateLALVALTestReportsRcvd','dateRLALTestReportsRcvd',
    'completionDate','completionDateBoxed','dateWOSubmittedToQA','dateWOSubmittedToProduction',
    'quarantineWaiverCreated','dateRequestForCertSent','dateCertCreated','certReviewedAndApproved',
    'dateParticulateSamplesCollected','dateSGSSamplesCollected',
  ];
  const intFields = [
    'qtyRcvdCSWare','totalOrderYield','quantityShippedSoFar','quantityParticulateSamples',
    'quantitySGSSamples','orderQuantityEaches','quantityPerTrayBag','totalOrderBalance',
  ];
  const floatFields = [
    'processedYieldDifferencePct','orderQuantityTraysBags','pricePerUnit',
    'sublotPriceExpectedNonShipped','sublotPriceYieldNonShipped','expectedYieldPriceDiff',
    'shippedPricePerUnit','sublotPriceExpected','sublotPriceYield','orderBalanceValue',
  ];
  const boolFields = ['ncr','allResultsReceived','quarantine','quarantineReleaseRequired'];

  const clean = { ...body };
  dateFields.forEach(f => { if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f]) clean[f] = new Date(clean[f]); });
  intFields.forEach(f => { if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f] !== undefined) clean[f] = parseInt(clean[f]); });
  floatFields.forEach(f => { if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f] !== undefined) clean[f] = parseFloat(clean[f]); });
  boolFields.forEach(f => { if (clean[f] !== undefined) clean[f] = clean[f] === true || clean[f] === 'true'; });
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  return clean;
}

module.exports = router;

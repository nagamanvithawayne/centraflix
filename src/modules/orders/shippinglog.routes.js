'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { search, partialShipment, quarantine } = req.query;
    const where = {};
    if (partialShipment === 'true') where.partialShipment = true;
    if (quarantine === 'true') where.quarantineShipment = true;
    if (search) {
      where.OR = [
        { customer:           { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } },
        { lotNumber:          { contains: search, mode: 'insensitive' } },
        { partNumber:         { contains: search, mode: 'insensitive' } },
        { fgNumber:           { contains: search, mode: 'insensitive' } },
        { shipperNumber:      { contains: search, mode: 'insensitive' } },
      ];
    }
    const [records, total] = await Promise.all([
      prisma.shippingLog.findMany({ where, skip, take: limit, orderBy: { shipDate: 'desc' } }),
      prisma.shippingLog.count({ where }),
    ]);
    return paginated(res, records, total, page, limit);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const record = await prisma.shippingLog.findUnique({ where: { id: parseInt(req.params.id) } });
    return success(res, record);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const record = await prisma.shippingLog.create({ data: cleanShipping(req.body) });
    return created(res, record, 'Shipping log created');
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const record = await prisma.shippingLog.update({ where: { id: parseInt(req.params.id) }, data: cleanShipping(req.body) });
    return success(res, record, 'Shipping log updated');
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.shippingLog.delete({ where: { id: parseInt(req.params.id) } });
    return success(res, null, 'Shipping log deleted');
  } catch (e) { next(e); }
});

function cleanShipping(body) {
  const clean = { ...body };
  ['shipDate'].forEach(f => { if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f]) clean[f] = new Date(clean[f]); });
  ['forecastedAmount','totalOrderYield','shippedSoFar','orderBalance','shipQuantity','quantityPerTrayBag'].forEach(f => { if (clean[f] !== undefined && clean[f] !== '') clean[f] = parseInt(clean[f]); else clean[f] = null; });
  ['pricePerUnit','sublotPriceYield','sublotPriceShipped','yieldShippedPriceDiff','sublotPriceForecasted','shippedSoFarValue','forecastedShippedPriceDiff'].forEach(f => { if (clean[f] !== undefined && clean[f] !== '') clean[f] = parseFloat(clean[f]); else clean[f] = null; });
  ['quarantineShipment','partialShipment'].forEach(f => { if (clean[f] !== undefined) clean[f] = clean[f] === true || clean[f] === 'true'; });
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  return clean;
}

module.exports = router;

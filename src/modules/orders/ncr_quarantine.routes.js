'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success, paginated, created } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(authenticate);

// NCR Records
const ncrRouter = require('express').Router();
ncrRouter.use(authenticate);

ncrRouter.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { customer:           { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } },
        { lotNumber:          { contains: search, mode: 'insensitive' } },
        { partNumber:         { contains: search, mode: 'insensitive' } },
      ];
    }
    const [records, total] = await Promise.all([
      prisma.nCRRecord.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.nCRRecord.count({ where }),
    ]);
    return paginated(res, records, total, page, limit);
  } catch (e) { next(e); }
});

ncrRouter.get('/:id', async (req, res, next) => {
  try {
    return success(res, await prisma.nCRRecord.findUnique({ where: { id: parseInt(req.params.id) } }));
  } catch (e) { next(e); }
});

ncrRouter.post('/', async (req, res, next) => {
  try {
    const record = await prisma.nCRRecord.create({ data: cleanNCR(req.body) });
    return created(res, record, 'NCR record created');
  } catch (e) { next(e); }
});

ncrRouter.put('/:id', async (req, res, next) => {
  try {
    const record = await prisma.nCRRecord.update({ where: { id: parseInt(req.params.id) }, data: cleanNCR(req.body) });
    return success(res, record, 'NCR updated');
  } catch (e) { next(e); }
});

ncrRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.nCRRecord.delete({ where: { id: parseInt(req.params.id) } });
    return success(res, null, 'NCR deleted');
  } catch (e) { next(e); }
});

function cleanNCR(body) {
  const clean = { ...body };
  ['ncrCreatedDate','washStartDate','boxedDate','reconciledDate','reviewedDate','certRequestSentDate','certifiedDate','shipDate'].forEach(f => {
    if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f]) clean[f] = new Date(clean[f]);
  });
  ['totalOrderYield','shipQuantity','totalOrderBalance'].forEach(f => {
    if (clean[f] !== undefined && clean[f] !== '') clean[f] = parseInt(clean[f]); else clean[f] = null;
  });
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  return clean;
}

// Quarantine Records
const quarantineRouter = require('express').Router();
quarantineRouter.use(authenticate);

quarantineRouter.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { search, released } = req.query;
    const where = {};
    if (released === 'true') where.quarantineReleased = true;
    if (released === 'false') where.quarantineReleased = false;
    if (search) {
      where.OR = [
        { customer:           { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } },
        { lotNumber:          { contains: search, mode: 'insensitive' } },
      ];
    }
    const [records, total] = await Promise.all([
      prisma.quarantineRecord.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.quarantineRecord.count({ where }),
    ]);
    return paginated(res, records, total, page, limit);
  } catch (e) { next(e); }
});

quarantineRouter.get('/:id', async (req, res, next) => {
  try {
    return success(res, await prisma.quarantineRecord.findUnique({ where: { id: parseInt(req.params.id) } }));
  } catch (e) { next(e); }
});

quarantineRouter.post('/', async (req, res, next) => {
  try {
    const record = await prisma.quarantineRecord.create({ data: cleanQ(req.body) });
    return created(res, record, 'Quarantine record created');
  } catch (e) { next(e); }
});

quarantineRouter.put('/:id', async (req, res, next) => {
  try {
    const record = await prisma.quarantineRecord.update({ where: { id: parseInt(req.params.id) }, data: cleanQ(req.body) });
    return success(res, record, 'Quarantine updated');
  } catch (e) { next(e); }
});

quarantineRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.quarantineRecord.delete({ where: { id: parseInt(req.params.id) } });
    return success(res, null, 'Quarantine record deleted');
  } catch (e) { next(e); }
});

function cleanQ(body) {
  const clean = { ...body };
  ['cleaningStartDate','quarantineReleaseDate'].forEach(f => {
    if (clean[f] === '' || clean[f] === null) clean[f] = null; else if (clean[f]) clean[f] = new Date(clean[f]);
  });
  if (clean.quarantineReleased !== undefined) clean.quarantineReleased = clean.quarantineReleased === true || clean.quarantineReleased === 'true';
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  return clean;
}

module.exports = { ncrRouter, quarantineRouter };

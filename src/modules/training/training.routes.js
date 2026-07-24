'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { paginated } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { employeeId, status } = req.query;
    const where = {};
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (status)     where.status = status;

    const [records, total] = await Promise.all([
      prisma.trainingRecord.findMany({
        where, skip, take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          employee:    { include:{ department:true } },
          processType: true,
          trainedBy:   { select:{ id:true, username:true } },
        },
      }),
      prisma.trainingRecord.count({ where }),
    ]);
    return paginated(res, records, total, page, limit);
  } catch(e){ next(e); }
});

module.exports = router;
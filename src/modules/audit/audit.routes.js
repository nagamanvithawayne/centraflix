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
    const { module: mod, userId } = req.query;
    const where = {};
    if (mod)    where.module = mod;
    if (userId) where.userId = parseInt(userId);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select:{ id:true, username:true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return paginated(res, logs, total, page, limit);
  } catch(e){ next(e); }
});

module.exports = router;
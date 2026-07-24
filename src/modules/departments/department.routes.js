'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success } = require('../../utils/response');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const depts = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return success(res, depts);
  } catch(e){ next(e); }
});

module.exports = router;
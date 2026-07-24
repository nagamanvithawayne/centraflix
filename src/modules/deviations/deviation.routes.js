'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success, created, paginated } = require('../../utils/response');
const { getPagination } = require('../../utils/pagination');
const { auditLog } = require('../../utils/audit');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { status, departmentId, severity } = req.query;
    const where = {};
    if (status)       where.status = status;
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (severity)     where.severity = severity;

    const [devs, total] = await Promise.all([
      prisma.deviation.findMany({
        where, skip, take: limit,
        orderBy: { reportedAt: 'desc' },
        include: {
          department:  { select:{ id:true, name:true } },
          processType: { select:{ id:true, name:true } },
          reportedBy:  { select:{ id:true, username:true } },
          reviewedBy:  { select:{ id:true, username:true } },
          machine:     { select:{ id:true, code:true, name:true } },
        },
      }),
      prisma.deviation.count({ where }),
    ]);
    return paginated(res, devs, total, page, limit);
  } catch(e){ next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const dev = await prisma.deviation.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        department:    true,
        processType:   true,
        processSubType:true,
        trayBatch:     true,
        machine:       true,
        reportedBy:    { select:{ id:true, username:true } },
        reviewedBy:    { select:{ id:true, username:true } },
        media:         true,
        comments:      { include:{ user:{ select:{ id:true, username:true } } }, orderBy:{ createdAt:'desc' } },
      },
    });
    return success(res, dev);
  } catch(e){ next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { departmentId, processTypeId, processSubTypeId, trayBatchId,
            machineId, issueCategory, severity, description, immediateAction } = req.body;

    const count = await prisma.deviation.count();
    const deviationCode = `DEV-${String(count+1).padStart(4,'0')}`;

    const dev = await prisma.deviation.create({
      data: {
        deviationCode,
        departmentId:    parseInt(departmentId),
        processTypeId:   processTypeId    ? parseInt(processTypeId)    : null,
        processSubTypeId:processSubTypeId ? parseInt(processSubTypeId) : null,
        trayBatchId:     trayBatchId      ? parseInt(trayBatchId)      : null,
        machineId:       machineId        ? parseInt(machineId)        : null,
        reportedById:    req.user.id,
        issueCategory, severity, description, immediateAction,
        status: 'OPEN',
      },
      include: {
        department:  true,
        processType: true,
        reportedBy:  { select:{ id:true, username:true } },
      },
    });

    await auditLog({ userId:req.user.id, action:'DEVIATION_CREATED', module:'Deviations', recordId:dev.id, newValue:{ deviationCode, severity, departmentId }, req });
    return created(res, dev, `Deviation ${deviationCode} logged`);
  } catch(e){ next(e); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, qaComment, ncrNumber } = req.body;
    const old = await prisma.deviation.findUnique({ where:{ id } });

    const updated = await prisma.deviation.update({
      where: { id },
      data: {
        status,
        qaComment:   qaComment  || old.qaComment,
        ncrNumber:   ncrNumber  || old.ncrNumber,
        reviewedById:req.user.id,
        reviewedAt:  new Date(),
        closedAt:    status === 'CLOSED' ? new Date() : old.closedAt,
      },
      include: {
        department:  true,
        processType: true,
        reportedBy:  { select:{ id:true, username:true } },
      },
    });

    await auditLog({ userId:req.user.id, action:'DEVIATION_STATUS_CHANGED', module:'Deviations', recordId:id, oldValue:{ status:old.status }, newValue:{ status }, req });
    return success(res, updated, 'Deviation updated');
  } catch(e){ next(e); }
});

module.exports = router;
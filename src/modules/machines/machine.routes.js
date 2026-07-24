'use strict';
const router = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success } = require('../../utils/response');
const { auditLog } = require('../../utils/audit');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const machines = await prisma.machine.findMany({
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    return success(res, machines);
  } catch(e){ next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        department: true,
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { updatedBy: { select:{ username:true } } },
        },
      },
    });
    return success(res, machine);
  } catch(e){ next(e); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status, remarks } = req.body;
    const old = await prisma.machine.findUnique({ where:{ id } });

    await prisma.machineStatusLog.create({
      data: {
        machineId:   id,
        oldStatus:   old.status,
        newStatus:   status,
        updatedById: req.user.id,
        remarks,
        isDowntime:  status === 'OFFLINE' || status === 'MAINTENANCE',
      },
    });

    const updated = await prisma.machine.update({
      where: { id },
      data:  { status, notes: remarks || old.notes },
      include: { department: true },
    });

    await auditLog({ userId:req.user.id, action:'MACHINE_STATUS_UPDATED', module:'Machines', recordId:id, oldValue:{ status:old.status }, newValue:{ status }, req });
    return success(res, updated, 'Machine status updated');
  } catch(e){ next(e); }
});

module.exports = router;
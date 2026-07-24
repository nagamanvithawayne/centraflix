'use strict';
const router  = require('express').Router();
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { success } = require('../../utils/response');
const { auditLog } = require('../../utils/audit');

router.use(authenticate);

router.get('/types', async (req, res, next) => {
  try {
    const types = await prisma.processType.findMany({
      where: { isActive: true },
      orderBy: { sequence: 'asc' },
      include: { subTypes: true },
    });
    return success(res, types);
  } catch(e){ next(e); }
});

router.post('/entry', async (req, res, next) => {
  try {
    const { trayBatchId, processTypeId, processSubTypeId, machineId,
            departmentId, assignedEmpId, status, temperature,
            pressure, humidity, cycleNumber, comments, parameters } = req.body;

    const entry = await prisma.processEntry.create({
      data: {
        trayBatchId:      parseInt(trayBatchId),
        processTypeId:    parseInt(processTypeId),
        processSubTypeId: processSubTypeId ? parseInt(processSubTypeId) : null,
        machineId:        machineId        ? parseInt(machineId)        : null,
        departmentId:     departmentId     ? parseInt(departmentId)     : null,
        assignedEmpId:    assignedEmpId    ? parseInt(assignedEmpId)    : null,
        performedById:    req.user.id,
        status:           status || 'COMPLETED',
        temperature:      temperature ? parseFloat(temperature) : null,
        pressure:         pressure    ? parseFloat(pressure)    : null,
        humidity:         humidity    ? parseFloat(humidity)    : null,
        cycleNumber:      cycleNumber || null,
        comments:         comments    || null,
        parameters:       parameters  || null,
        completedAt:      status === 'COMPLETED' ? new Date() : null,
      },
      include: {
        processType: true,
        machine: true,
        performedBy: { select: { id:true, username:true } },
      },
    });

    await auditLog({ userId:req.user.id, action:'PROCESS_ENTRY_LOGGED', module:'Process', recordId:entry.id, newValue:{ trayBatchId, processTypeId, status }, req });
    return success(res, entry, 'Process entry logged successfully');
  } catch(e){ next(e); }
});

router.get('/entries/:trayId', async (req, res, next) => {
  try {
    const entries = await prisma.processEntry.findMany({
      where: { trayBatchId: parseInt(req.params.trayId) },
      orderBy: { createdAt: 'asc' },
      include: {
        processType: true,
        processSubType: true,
        machine: true,
        performedBy: { select: { id:true, username:true } },
      },
    });
    return success(res, entries);
  } catch(e){ next(e); }
});

module.exports = router;
'use strict';
require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const app    = express();
const PORT   = process.env.PORT || 5000;
const BASE   = '/api/v1';

// ── SECURITY & MIDDLEWARE ────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy:{ policy:'cross-origin' } }));
app.use(cors({ origin:'*', credentials:true }));
app.use(compression());
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));
app.use(morgan('dev'));

// ── STATIC FILES ─────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads/deviations';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive:true });
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── FILE UPLOAD ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits:{ fileSize: 50 * 1024 * 1024 } });

// ── AUTH HELPERS ──────────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'No token provided' });
    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await prisma.session.findUnique({ where:{ token },
      include:{ user:{ include:{ role:true } } } });
    if (!session || session.isRevoked || new Date() > session.expiresAt)
      return res.status(401).json({ success:false, message:'Session expired. Please login again.' });
    req.user  = session.user;
    req.token = token;
    next();
  } catch(e) {
    return res.status(401).json({ success:false, message:'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role?.name))
      return res.status(403).json({ success:false, message:'Access denied' });
    next();
  };
}

async function auditLog(userId, action, module, recordId='', detail={}) {
  try {
    await prisma.auditLog.create({ data:{ userId, action, module, recordId:String(recordId), newValue:detail } });
  } catch(e) {}
}

// ── HEALTH ────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ success:true, service:'Centtralix API', status:'running', version:'1.0.0' }));

// ══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════
app.post(`${BASE}/auth/login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success:false, message:'Username and password required' });

    const user = await prisma.user.findFirst({
      where:{ OR:[{ username:username.toLowerCase() },{ email:username.toLowerCase() }], isActive:true },
      include:{ role:{ include:{ permissions:true } }, employee:{ include:{ department:true } } },
    });
    if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success:false, message:'Invalid credentials' });

    const token = jwt.sign({ userId:user.id, role:user.role.name }, process.env.JWT_SECRET, { expiresIn:'8h' });
    const expiresAt = new Date(Date.now() + 8*60*60*1000);

    await prisma.session.create({ data:{ userId:user.id, token, ipAddress:req.ip, expiresAt } });
    await prisma.user.update({ where:{ id:user.id }, data:{ lastLoginAt:new Date() } });
    await auditLog(user.id, 'LOGIN', 'Auth', user.id);

    const { passwordHash, ...safeUser } = user;
    return res.json({ success:true, message:'Login successful', data:{ token, expiresAt, user:safeUser } });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.post(`${BASE}/auth/logout`, authenticate, async (req, res) => {
  await prisma.session.update({ where:{ token:req.token }, data:{ isRevoked:true } });
  await auditLog(req.user.id, 'LOGOUT', 'Auth', req.user.id);
  return res.json({ success:true, message:'Logged out' });
});

app.get(`${BASE}/auth/me`, authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where:{ id:req.user.id },
    include:{ role:{ include:{ permissions:true } }, employee:{ include:{ department:true } } } });
  const { passwordHash, ...safe } = user;
  return res.json({ success:true, data:safe });
});

// ══════════════════════════════════════════════════════════════
// EMPLOYEES
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/employees`, authenticate, async (req, res) => {
  try {
    const { search, departmentId, isActive } = req.query;
    const where = {};
    if (search) where.OR = [{ fullName:{ contains:search, mode:'insensitive' } },{ employeeCode:{ contains:search, mode:'insensitive' } }];
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const employees = await prisma.employee.findMany({ where, orderBy:{ fullName:'asc' },
      include:{ department:{ select:{ id:true, name:true } },
        user:{ select:{ id:true, username:true, role:{ select:{ name:true, label:true } } } } } });
    return res.json({ success:true, data:employees });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.get(`${BASE}/employees/:id`, authenticate, async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({ where:{ id:parseInt(req.params.id) },
      include:{ department:true, user:{ select:{ id:true, username:true, role:true } },
        trainingRecords:{ include:{ processType:true } } } });
    if (!emp) return res.status(404).json({ success:false, message:'Employee not found' });
    return res.json({ success:true, data:emp });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.post(`${BASE}/employees`, authenticate, async (req, res) => {
  try {
    const { employeeCode, fullName, email, phone, departmentId, joiningDate, shift, notes } = req.body;
    const emp = await prisma.employee.create({ data:{
      employeeCode, fullName, email:email.toLowerCase(), phone,
      departmentId:parseInt(departmentId), joiningDate:new Date(joiningDate), shift:shift||'Day', notes,
    }, include:{ department:true } });
    await auditLog(req.user.id, 'EMPLOYEE_CREATED', 'Employees', emp.id);
    return res.status(201).json({ success:true, message:'Employee created', data:emp });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.put(`${BASE}/employees/:id`, authenticate, async (req, res) => {
  try {
    const { fullName, phone, shift, notes, isActive } = req.body;
    const emp = await prisma.employee.update({ where:{ id:parseInt(req.params.id) },
      data:{ fullName, phone, shift, notes, ...(isActive !== undefined && { isActive }) } });
    await auditLog(req.user.id, 'EMPLOYEE_UPDATED', 'Employees', emp.id);
    return res.json({ success:true, data:emp });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// DEPARTMENTS
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/departments`, authenticate, async (req, res) => {
  try {
    const depts = await prisma.department.findMany({ orderBy:{ name:'asc' },
      include:{ _count:{ select:{ employees:true, machines:true } } } });
    return res.json({ success:true, data:depts });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// TRAYS / BATCHES
// ══════════════════════════════════════════════════════════════
const STAGES = [
  { seq:1,  name:'Loading Ware',              dept:'Warehouse'         },
  { seq:2,  name:'Cleanroom Routing',         dept:'Warehouse'         },
  { seq:3,  name:'Washing',                   dept:'Cleanroom A'       },
  { seq:4,  name:'DI Water',                  dept:'Cleanroom A'       },
  { seq:5,  name:'Ultrasonic',                dept:'Cleanroom A'       },
  { seq:6,  name:'WFI',                       dept:'Cleanroom A'       },
  { seq:7,  name:'Drying',                    dept:'Cleanroom A'       },
  { seq:8,  name:'Depyrogenation',            dept:'Cleanroom B'       },
  { seq:9,  name:'Backwall Sealing',          dept:'Cleanroom B'       },
  { seq:10, name:'Autoclave / Sterilization', dept:'Production'        },
  { seq:11, name:'Drying After Sterilization',dept:'Production'        },
  { seq:12, name:'Final Sealing',             dept:'Production'        },
  { seq:13, name:'Boxing',                    dept:'Packaging / Boxing'},
  { seq:14, name:'Testing',                   dept:'Quality Assurance' },
  { seq:15, name:'Certification',             dept:'Quality Assurance' },
  { seq:16, name:'Shipping',                  dept:'Shipping'          },
];

app.get(`${BASE}/trays`, authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) where.OR = [{ trayCode:{ contains:search, mode:'insensitive' } },{ batchNumber:{ contains:search, mode:'insensitive' } }];
    const trays = await prisma.trayBatch.findMany({ where, orderBy:{ updatedAt:'desc' } });
    return res.json({ success:true, data:trays.map(t=>({ ...t,
      currentStageName: STAGES[t.currentStage-1]?.name||'Complete',
      progressPct: Math.round((t.currentStage/16)*100) })) });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.get(`${BASE}/trays/live`, authenticate, async (req, res) => {
  try {
    const trays = await prisma.trayBatch.findMany({ where:{ status:{ in:['ACTIVE','ON_HOLD'] } }, orderBy:{ updatedAt:'desc' } });
    return res.json({ success:true, data:trays.map(t=>({ ...t,
      currentStageName: STAGES[t.currentStage-1]?.name,
      currentDept:      STAGES[t.currentStage-1]?.dept,
      progressPct:      Math.round((t.currentStage/16)*100) })) });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.get(`${BASE}/trays/:id`, authenticate, async (req, res) => {
  try {
    const tray = await prisma.trayBatch.findUnique({ where:{ id:parseInt(req.params.id) },
      include:{ processEntries:{ orderBy:{ createdAt:'asc' }, include:{ processType:true, machine:true } },
        deviations:true, comments:{ include:{ user:{ select:{ id:true, username:true } } } } } });
    if (!tray) return res.status(404).json({ success:false, message:'Tray not found' });
    return res.json({ success:true, data:{ ...tray,
      currentStageName: STAGES[tray.currentStage-1]?.name,
      progressPct: Math.round((tray.currentStage/16)*100), stageMap:STAGES } });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.post(`${BASE}/trays`, authenticate, async (req, res) => {
  try {
    const { productName, quantity, batchNumber, unitOfMeasure, notes } = req.body;
    const count    = await prisma.trayBatch.count();
    const trayCode = `TRY-${String(count+1).padStart(3,'0')}`;
    const tray = await prisma.trayBatch.create({ data:{
      trayCode, batchNumber, productName, quantity:parseInt(quantity),
      unitOfMeasure:unitOfMeasure||'units', notes, currentStage:1,
    } });
    await auditLog(req.user.id, 'TRAY_CREATED', 'Process', tray.id, { trayCode, batchNumber });
    return res.status(201).json({ success:true, message:`Tray ${trayCode} created`, data:tray });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.patch(`${BASE}/trays/:id/stage`, authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { stage, comments } = req.body;
    const tray = await prisma.trayBatch.findUnique({ where:{ id } });
    if (!tray) return res.status(404).json({ success:false, message:'Tray not found' });
    const newStage = parseInt(stage);
    const updated  = await prisma.trayBatch.update({ where:{ id }, data:{
      currentStage: newStage,
      status: newStage >= 16 ? 'COMPLETE' : tray.status,
      completedAt: newStage >= 16 ? new Date() : null,
    } });
    await auditLog(req.user.id, 'TRAY_STAGE_ADVANCED', 'Process', id, { from:tray.currentStage, to:newStage, comments });
    return res.json({ success:true, message:`Stage advanced to ${newStage}: ${STAGES[newStage-1]?.name}`,
      data:{ ...updated, currentStageName:STAGES[newStage-1]?.name, progressPct:Math.round((newStage/16)*100) } });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.patch(`${BASE}/trays/:id/status`, authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.trayBatch.update({ where:{ id }, data:{ status:req.body.status } });
    await auditLog(req.user.id, 'TRAY_STATUS_CHANGED', 'Process', id, { status:req.body.status });
    return res.json({ success:true, data:updated });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// MACHINES
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/machines`, authenticate, async (req, res) => {
  try {
    const { status, departmentId } = req.query;
    const where = {};
    if (status)       where.status = status;
    if (departmentId) where.departmentId = parseInt(departmentId);
    const machines = await prisma.machine.findMany({ where, orderBy:{ name:'asc' },
      include:{ department:{ select:{ id:true, name:true } },
        statusLogs:{ take:1, orderBy:{ createdAt:'desc' }, include:{ updatedBy:{ select:{ id:true, username:true } } } } } });
    return res.json({ success:true, data:machines });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.patch(`${BASE}/machines/:id/status`, authenticate, async (req, res) => {
  try {
    const id  = parseInt(req.params.id);
    const old = await prisma.machine.findUnique({ where:{ id } });
    if (!old) return res.status(404).json({ success:false, message:'Machine not found' });
    const { status, remarks } = req.body;
    const machine = await prisma.machine.update({ where:{ id }, data:{ status } });
    await prisma.machineStatusLog.create({ data:{
      machineId:id, oldStatus:old.status, newStatus:status, updatedById:req.user.id, remarks
    } });
    await auditLog(req.user.id, 'MACHINE_STATUS_UPDATED', 'Machines', id, { from:old.status, to:status });
    return res.json({ success:true, message:`Machine status → ${status}`, data:machine });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// DEVIATIONS
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/deviations`, authenticate, async (req, res) => {
  try {
    const { status, severity, departmentId } = req.query;
    const where = {};
    if (status)       where.status     = status;
    if (severity)     where.severity   = severity;
    if (departmentId) where.departmentId = parseInt(departmentId);
    const devs = await prisma.deviation.findMany({ where, orderBy:{ reportedAt:'desc' },
      include:{ department:{ select:{ id:true, name:true } }, processType:{ select:{ id:true, name:true } },
        reportedBy:{ select:{ id:true, username:true } }, media:true } });
    return res.json({ success:true, data:devs });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.get(`${BASE}/deviations/:id`, authenticate, async (req, res) => {
  try {
    const dev = await prisma.deviation.findUnique({ where:{ id:parseInt(req.params.id) },
      include:{ department:true, processType:true, reportedBy:{ select:{ id:true, username:true } },
        reviewedBy:{ select:{ id:true, username:true } }, media:true,
        comments:{ include:{ user:{ select:{ id:true, username:true } } } } } });
    if (!dev) return res.status(404).json({ success:false, message:'Deviation not found' });
    return res.json({ success:true, data:dev });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.post(`${BASE}/deviations`, authenticate, upload.array('media', 10), async (req, res) => {
  try {
    const { departmentId, processTypeId, trayBatchId, machineId, issueCategory, severity, description, immediateAction } = req.body;
    const count = await prisma.deviation.count();
    const deviationCode = `DEV-${String(count+1).padStart(3,'0')}`;
    const dev = await prisma.deviation.create({ data:{
      deviationCode, departmentId:parseInt(departmentId),
      processTypeId: processTypeId ? parseInt(processTypeId) : null,
      trayBatchId:   trayBatchId   ? parseInt(trayBatchId)   : null,
      machineId:     machineId     ? parseInt(machineId)     : null,
      reportedById:req.user.id, issueCategory, severity, description, immediateAction, status:'OPEN',
    } });
    if (req.files?.length > 0) {
      await prisma.deviationMedia.createMany({ data: req.files.map(f=>({
        deviationId:dev.id, fileType:f.mimetype.startsWith('video')?'video':'photo',
        fileName:f.originalname, filePath:f.path, fileSize:f.size, mimeType:f.mimetype,
      })) });
    }
    await auditLog(req.user.id, 'DEVIATION_CREATED', 'Deviations', dev.id, { code:deviationCode, severity });
    const full = await prisma.deviation.findUnique({ where:{ id:dev.id }, include:{ media:true, department:true } });
    return res.status(201).json({ success:true, message:`Deviation ${deviationCode} logged`, data:full });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.patch(`${BASE}/deviations/:id/status`, authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.deviation.update({ where:{ id }, data:{
      status:req.body.status, ...(req.body.status==='CLOSED' && { closedAt:new Date() })
    } });
    await auditLog(req.user.id, 'DEVIATION_STATUS_CHANGED', 'Deviations', id, { status:req.body.status });
    return res.json({ success:true, data:updated });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.patch(`${BASE}/deviations/:id/qa-review`, authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { ncrNumber, qaComment, rootCause, correctiveAction, status } = req.body;
    const updated = await prisma.deviation.update({ where:{ id }, data:{
      ncrNumber, qaComment, rootCause, correctiveAction,
      reviewedById:req.user.id, reviewedAt:new Date(),
      ...(status && { status }),
      ...(status==='CLOSED' && { closedAt:new Date() }),
    } });
    await auditLog(req.user.id, 'DEVIATION_QA_REVIEWED', 'Deviations', id, { ncrNumber, status });
    return res.json({ success:true, message:'QA review saved', data:updated });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// TRAINING MATRIX
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/training`, authenticate, async (req, res) => {
  try {
    const { employeeId, processTypeId, status } = req.query;
    const where = {};
    if (employeeId)    where.employeeId    = parseInt(employeeId);
    if (processTypeId) where.processTypeId = parseInt(processTypeId);
    if (status)        where.status        = status;
    const records = await prisma.trainingRecord.findMany({ where,
      include:{ employee:{ include:{ department:true } }, processType:true,
        trainedBy:{ select:{ id:true, username:true } } }, orderBy:{ updatedAt:'desc' } });
    return res.json({ success:true, data:records });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.get(`${BASE}/training/expiring`, authenticate, async (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 60;
    const cutoff = new Date(Date.now() + days*24*60*60*1000);
    const records = await prisma.trainingRecord.findMany({
      where:{ expiryDate:{ lte:cutoff }, status:'CERTIFIED' },
      include:{ employee:{ include:{ department:true } }, processType:true },
      orderBy:{ expiryDate:'asc' } });
    return res.json({ success:true, data:records });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

app.post(`${BASE}/training`, authenticate, async (req, res) => {
  try {
    const { employeeId, processTypeId, status, certifiedDate, expiryDate, score, notes } = req.body;
    const existing = await prisma.trainingRecord.findUnique({
      where:{ employeeId_processTypeId:{ employeeId:parseInt(employeeId), processTypeId:parseInt(processTypeId) } } });
    let record;
    if (existing) {
      record = await prisma.trainingRecord.update({ where:{ id:existing.id }, data:{
        status, trainedById:req.user.id, score:score?parseFloat(score):null, notes,
        ...(certifiedDate && { certifiedDate:new Date(certifiedDate) }),
        ...(expiryDate    && { expiryDate:   new Date(expiryDate)    }),
      } });
    } else {
      record = await prisma.trainingRecord.create({ data:{
        employeeId:parseInt(employeeId), processTypeId:parseInt(processTypeId),
        status, trainedById:req.user.id, score:score?parseFloat(score):null, notes,
        ...(certifiedDate && { certifiedDate:new Date(certifiedDate) }),
        ...(expiryDate    && { expiryDate:   new Date(expiryDate)    }),
      } });
    }
    await auditLog(req.user.id, 'TRAINING_UPDATED', 'Training', record.id, { status });
    return res.json({ success:true, data:record });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/audit`, authenticate, async (req, res) => {
  try {
    const { module, action, userId, dateFrom, dateTo } = req.query;
    const where = {};
    if (module) where.module = { contains:module, mode:'insensitive' };
    if (action) where.action = { contains:action, mode:'insensitive' };
    if (userId) where.userId = parseInt(userId);
    if (dateFrom||dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }
    const logs = await prisma.auditLog.findMany({ where, orderBy:{ createdAt:'desc' }, take:200,
      include:{ user:{ select:{ id:true, username:true, role:true } } } });
    return res.json({ success:true, data:logs });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/dashboard`, authenticate, async (req, res) => {
  try {
    const [totalEmployees, activeTrays, openDeviations, ncrMachines, recentAudit, recentDeviations] = await Promise.all([
      prisma.employee.count({ where:{ isActive:true } }),
      prisma.trayBatch.count({ where:{ status:'ACTIVE' } }),
      prisma.deviation.count({ where:{ status:'OPEN' } }),
      prisma.machine.count({ where:{ status:'NCR' } }),
      prisma.auditLog.findMany({ take:5, orderBy:{ createdAt:'desc' },
        include:{ user:{ select:{ id:true, username:true } } } }),
      prisma.deviation.findMany({ take:5, orderBy:{ reportedAt:'desc' },
        include:{ department:{ select:{ name:true } }, reportedBy:{ select:{ username:true } } } }),
    ]);
    return res.json({ success:true, data:{
      totalEmployees, activeTrays, openDeviations, ncrMachines, recentAudit, recentDeviations,
      onHoldTrays:    await prisma.trayBatch.count({ where:{ status:'ON_HOLD' } }),
      completedTrays: await prisma.trayBatch.count({ where:{ status:'COMPLETE' } }),
      totalMachines:  await prisma.machine.count(),
    } });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// PROCESS TYPES
// ══════════════════════════════════════════════════════════════
app.get(`${BASE}/process-types`, authenticate, async (req, res) => {
  try {
    const types = await prisma.processType.findMany({ where:{ isActive:true }, orderBy:{ sequence:'asc' } });
    return res.json({ success:true, data:types });
  } catch(e) { return res.status(500).json({ success:false, message:e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ERROR HANDLER
// ══════════════════════════════════════════════════════════════
app.use((req, res) => res.status(404).json({ success:false, message:`Route ${req.method} ${req.url} not found` }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code==='P2002') return res.status(409).json({ success:false, message:'A record with this value already exists' });
  if (err.code==='P2025') return res.status(404).json({ success:false, message:'Record not found' });
  return res.status(500).json({ success:false, message:err.message||'Internal server error' });
});

// ══════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════
async function start() {
  try {
    await prisma.$connect();
    console.log('✔ Database connected');
    app.listen(PORT, () => {
      console.log(`\n✅ Centtralix API running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API:    http://localhost:${PORT}${BASE}\n`);
    });
  } catch(e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
}
start();

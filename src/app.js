'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const logger      = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes         = require('./modules/auth/auth.routes');
const employeeRoutes     = require('./modules/employees/employee.routes');
const departmentRoutes   = require('./modules/departments/department.routes');
const trayRoutes         = require('./modules/trays/tray.routes');
const machineRoutes      = require('./modules/machines/machine.routes');
const deviationRoutes    = require('./modules/deviations/deviation.routes');
const trainingRoutes     = require('./modules/training/training.routes');
const auditRoutes        = require('./modules/audit/audit.routes');
const processRoutes      = require('./modules/process/process.routes');
const orderRoutes        = require('./modules/orders/orderrecords.routes');
const shippingRoutes     = require('./modules/orders/shippinglog.routes');
const { ncrRouter, quarantineRouter } = require('./modules/orders/ncr_quarantine.routes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Request-ID'] }));

const limiter = rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false });
app.use(limiter);
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50 });

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) }, skip: (req) => req.url === '/health' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'ACRON API', version: '2.0.0', status: 'running', timestamp: new Date().toISOString() });
});

const BASE = process.env.API_PREFIX || '/api/v1';
app.use(`${BASE}/auth`,        authLimiter, authRoutes);
app.use(`${BASE}/employees`,   employeeRoutes);
app.use(`${BASE}/departments`, departmentRoutes);
app.use(`${BASE}/trays`,       trayRoutes);
app.use(`${BASE}/machines`,    machineRoutes);
app.use(`${BASE}/deviations`,  deviationRoutes);
app.use(`${BASE}/training`,    trainingRoutes);
app.use(`${BASE}/audit`,       auditRoutes);
app.use(`${BASE}/process`,     processRoutes);
app.use(`${BASE}/orders`,      orderRoutes);
app.use(`${BASE}/shipping-log`,shippingRoutes);
app.use(`${BASE}/ncrs`,        ncrRouter);
app.use(`${BASE}/quarantine`,  quarantineRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── DEPARTMENTS ──────────────────────────────────────────
  const departments = [
    { name: 'Warehouse',          code: 'WH'  },
    { name: 'Cleanroom A',        code: 'CRA' },
    { name: 'Cleanroom B',        code: 'CRB' },
    { name: 'Production',         code: 'PRD' },
    { name: 'Quality Assurance',  code: 'QA'  },
    { name: 'Packaging / Boxing', code: 'PKG' },
    { name: 'Shipping',           code: 'SHP' },
    { name: 'Engineering',        code: 'ENG' },
    { name: 'Human Resources',    code: 'HR'  },
    { name: 'Executive',          code: 'EXC' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where:  { code: dept.code },
      update: { name: dept.name },
      create: dept,
    });
  }
  console.log('✔ Departments seeded');

  // ── ROLES ─────────────────────────────────────────────────
  const roles = [
    { name: 'president',   label: 'President'             },
    { name: 'vp',          label: 'Vice President'        },
    { name: 'director',    label: 'Director'              },
    { name: 'hr',          label: 'HR'                    },
    { name: 'manager',     label: 'Manager'               },
    { name: 'equip_mgr',   label: 'Equipment Manager'     },
    { name: 'prod_coord',  label: 'Production Coordinator'},
    { name: 'qa',          label: 'Quality Inspector'     },
    { name: 'team_lead',   label: 'Team Lead'             },
    { name: 'tech',        label: 'Tech'                  },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where:  { name: role.name },
      update: { label: role.label },
      create: role,
    });
  }
  console.log('✔ Roles seeded');

  // ── PERMISSIONS ───────────────────────────────────────────
  const allRoles = await prisma.role.findMany();

  const permMatrix = {
    president:  { dashboard:true,  employees:true,  training:true,  process:true,  machines:true,  deviations:true,  audit:true,  reports:true,  access_control:true,  admin:true  },
    vp:         { dashboard:true,  employees:true,  training:true,  process:true,  machines:true,  deviations:true,  audit:true,  reports:true,  access_control:true,  admin:true  },
    director:   { dashboard:true,  employees:true,  training:true,  process:true,  machines:true,  deviations:true,  audit:true,  reports:true,  access_control:false, admin:false },
    hr:         { dashboard:true,  employees:true,  training:true,  process:false, machines:false, deviations:false, audit:false, reports:true,  access_control:false, admin:false },
    manager:    { dashboard:true,  employees:true,  training:true,  process:true,  machines:true,  deviations:true,  audit:false, reports:true,  access_control:false, admin:false },
    equip_mgr:  { dashboard:true,  employees:false, training:false, process:false, machines:true,  deviations:true,  audit:false, reports:true,  access_control:false, admin:false },
    prod_coord: { dashboard:true,  employees:true,  training:true,  process:true,  machines:true,  deviations:true,  audit:false, reports:false, access_control:false, admin:false },
    qa:         { dashboard:true,  employees:false, training:false, process:true,  machines:true,  deviations:true,  audit:false, reports:true,  access_control:false, admin:false },
    team_lead:  { dashboard:true,  employees:true,  training:false, process:true,  machines:true,  deviations:true,  audit:false, reports:false, access_control:false, admin:false },
    tech:       { dashboard:true,  employees:false, training:false, process:false, machines:false, deviations:true,  audit:false, reports:false, access_control:false, admin:false },
  };

  const modules = ['dashboard','employees','training','process','machines','deviations','audit','reports','access_control','admin'];

  for (const role of allRoles) {
    const perms = permMatrix[role.name];
    if (!perms) continue;
    for (const module of modules) {
      const allowed = perms[module] || false;
      await prisma.permission.upsert({
        where:  { roleId_module: { roleId: role.id, module } },
        update: { canView: allowed, canCreate: allowed, canEdit: allowed, canDelete: allowed, canExport: allowed, canApprove: allowed },
        create: { roleId: role.id, module, canView: allowed, canCreate: allowed, canEdit: allowed, canDelete: allowed, canExport: allowed, canApprove: allowed },
      });
    }
  }
  console.log('✔ Permissions seeded');

  // ── PROCESS TYPES ─────────────────────────────────────────
  const processTypes = [
    { name: 'Loading Ware',                 code: 'LOAD',   sequence: 1,  departmentCode: 'WH'  },
    { name: 'Washing',                      code: 'WASH',   sequence: 2,  departmentCode: 'CRA' },
    { name: 'DI Water',                     code: 'DIW',    sequence: 3,  departmentCode: 'CRA' },
    { name: 'Ultrasonic',                   code: 'ULTRA',  sequence: 4,  departmentCode: 'CRA' },
    { name: 'WFI',                          code: 'WFI',    sequence: 5,  departmentCode: 'CRA' },
    { name: 'Drying',                       code: 'DRY',    sequence: 6,  departmentCode: 'CRA' },
    { name: 'Depyrogenation',               code: 'DEPYRO', sequence: 7,  departmentCode: 'CRB' },
    { name: 'Backwall Sealing',             code: 'BWS',    sequence: 8,  departmentCode: 'CRB' },
    { name: 'Autoclave / Sterilization',    code: 'AUTO',   sequence: 9,  departmentCode: 'PRD' },
    { name: 'Drying After Sterilization',   code: 'DRYAS',  sequence: 10, departmentCode: 'PRD' },
    { name: 'Final Sealing',                code: 'FSEAL',  sequence: 11, departmentCode: 'PRD' },
    { name: 'Boxing',                       code: 'BOX',    sequence: 12, departmentCode: 'PKG' },
    { name: 'Testing',                      code: 'TEST',   sequence: 13, departmentCode: 'QA'  },
    { name: 'Certification',                code: 'CERT',   sequence: 14, departmentCode: 'QA'  },
    { name: 'Shipping',                     code: 'SHIP',   sequence: 15, departmentCode: 'SHP' },
    { name: 'Printing Labels',              code: 'PRINT',  sequence: 16, departmentCode: 'PRD' },
  ];

  for (const pt of processTypes) {
    await prisma.processType.upsert({
      where:  { code: pt.code },
      update: { name: pt.name, sequence: pt.sequence },
      create: pt,
    });
  }
  console.log('✔ Process types seeded');

  // ── LABEL SUB TYPES ───────────────────────────────────────
  const printType = await prisma.processType.findUnique({ where: { code: 'PRINT' } });
  if (printType) {
    const labelSubTypes = [
      { name: 'Return Ware Labels',             code: 'LBL-RW'   },
      { name: 'Backwall Tray Labels',           code: 'LBL-BWT'  },
      { name: 'White Labels / Product Identity',code: 'LBL-WH'   },
      { name: 'Steam Indicator Stickers',       code: 'LBL-SIS'  },
      { name: 'Autoclave Print Labels',         code: 'LBL-AUTO' },
      { name: 'Packaging Labels',               code: 'LBL-PKG'  },
      { name: 'Boxing Labels',                  code: 'LBL-BOX'  },
      { name: 'Loading Labels / Rework',        code: 'LBL-LOAD' },
    ];
    for (const sub of labelSubTypes) {
      await prisma.processSubType.upsert({
        where:  { processTypeId_code: { processTypeId: printType.id, code: sub.code } },
        update: { name: sub.name },
        create: { ...sub, processTypeId: printType.id },
      });
    }
  }
  console.log('✔ Label sub-types seeded');

  // ── EMPLOYEES & USERS ─────────────────────────────────────
  const allDepts = await prisma.department.findMany();
  const allRolesMap = {};
  for (const r of allRoles) allRolesMap[r.name] = r.id;

  const deptMap = {};
  for (const d of allDepts) deptMap[d.code] = d.id;

  const password = await bcrypt.hash('Admin1234', 12);

  const seedUsers = [
    { empCode:'EMP-001', fullName:'Robert Haines',   username:'rhaines',  email:'rhaines@centtralix.com',   role:'president',  deptCode:'EXC', shift:'Day'   },
    { empCode:'EMP-002', fullName:'Linda Carver',    username:'lcarver',  email:'lcarver@centtralix.com',   role:'vp',         deptCode:'EXC', shift:'Day'   },
    { empCode:'EMP-003', fullName:'Marcus Webb',     username:'mwebb',    email:'mwebb@centtralix.com',     role:'director',   deptCode:'EXC', shift:'Day'   },
    { empCode:'EMP-004', fullName:'Sarah Okafor',    username:'sokafor',  email:'sokafor@centtralix.com',   role:'hr',         deptCode:'HR',  shift:'Day'   },
    { empCode:'EMP-005', fullName:'James Thornton',  username:'jthorn',   email:'jthorn@centtralix.com',    role:'manager',    deptCode:'PRD', shift:'Day'   },
    { empCode:'EMP-006', fullName:'Priya Nair',      username:'pnair',    email:'pnair@centtralix.com',     role:'equip_mgr',  deptCode:'ENG', shift:'Day'   },
    { empCode:'EMP-007', fullName:'Felix Okonkwo',   username:'fokonkwo', email:'fokonkwo@centtralix.com',  role:'prod_coord', deptCode:'WH',  shift:'Day'   },
    { empCode:'EMP-008', fullName:'Dana Reyes',      username:'dreyes',   email:'dreyes@centtralix.com',    role:'qa',         deptCode:'QA',  shift:'Day'   },
    { empCode:'EMP-009', fullName:'Kevin Marsh',     username:'kmarsh',   email:'kmarsh@centtralix.com',    role:'team_lead',  deptCode:'CRA', shift:'Day'   },
    { empCode:'EMP-010', fullName:'Tobi Adeola',     username:'tadeola',  email:'tadeola@centtralix.com',   role:'tech',       deptCode:'CRB', shift:'Night' },
    { empCode:'EMP-011', fullName:'Carmen Torres',   username:'ctorres',  email:'ctorres@centtralix.com',   role:'tech',       deptCode:'WH',  shift:'Day'   },
  ];

  for (const u of seedUsers) {
    const deptId = deptMap[u.deptCode];
    const roleId = allRolesMap[u.role];
    if (!deptId || !roleId) {
      console.log(`Skipping ${u.username} — dept or role not found`);
      continue;
    }

    // Create or update employee
    const emp = await prisma.employee.upsert({
      where:  { employeeCode: u.empCode },
      update: { fullName: u.fullName, shift: u.shift },
      create: {
        employeeCode: u.empCode,
        fullName:     u.fullName,
        email:        u.email,
        departmentId: deptId,
        shift:        u.shift,
        joiningDate:  new Date('2024-01-01'),
      },
    });

    // Create or update user
    await prisma.user.upsert({
      where:  { username: u.username },
      update: { roleId, isActive: true },
      create: {
        username:     u.username,
        email:        u.email,
        passwordHash: password,
        roleId,
        employeeId:   emp.id,
        isActive:     true,
      },
    });
  }
  console.log('✔ Users seeded');

  // ── MACHINES ──────────────────────────────────────────────
  const machines = [
    { machineCode:'MCH-001', code:'UC-200',  name:'Ultrasonic Cleaner UC-200',    deptCode:'CRA', notes:'Primary ultrasonic unit'     },
    { machineCode:'MCH-002', code:'ST-1500', name:'Autoclave ST-1500',            deptCode:'PRD', notes:'Main sterilization unit'     },
    { machineCode:'MCH-003', code:'DPO-3',   name:'Depyrogenation Oven DPO-3',    deptCode:'CRB', notes:'High-temp depyro oven'       },
    { machineCode:'MCH-004', code:'WF-500',  name:'WFI System WF-500',            deptCode:'CRA', notes:'Water for injection system'  },
    { machineCode:'MCH-005', code:'DI-100',  name:'DI Water Station DI-100',      deptCode:'CRA', notes:'Deionized water station'     },
    { machineCode:'MCH-006', code:'BW-22',   name:'Backwall Sealer BW-22',        deptCode:'CRB', notes:'Backwall sealing unit'       },
    { machineCode:'MCH-007', code:'BXL-4',   name:'Boxing Line BXL-4',            deptCode:'PKG', notes:'Automated boxing line'       },
    { machineCode:'MCH-008', code:'FS-10',   name:'Final Sealer FS-10',           deptCode:'PRD', notes:'Final sealing machine'       },
  ];

  for (const m of machines) {
    const deptId = deptMap[m.deptCode];
    if (!deptId) continue;
    await prisma.machine.upsert({
      where:  { code: m.code },
      update: { name: m.name, notes: m.notes },
      create: {
        machineCode:  m.machineCode,
        code:         m.code,
        name:         m.name,
        departmentId: deptId,
        notes:        m.notes,
        status:       'NORMAL',
      },
    });
  }
  console.log('✔ Machines seeded');

  console.log('\n✔ Database seeding complete!');
  console.log('\nTest login credentials (all roles):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Username        | Role');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  seedUsers.forEach(u => {
    console.log(`${u.username.padEnd(16)}| ${u.role}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Password for ALL users: Admin1234');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

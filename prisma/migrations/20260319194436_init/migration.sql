-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CERTIFIED', 'EXPIRED', 'WAIVED');

-- CreateEnum
CREATE TYPE "TrayStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'REWORK', 'REJECTED', 'COMPLETE', 'SHIPPED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'ON_HOLD', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('NORMAL', 'NCR', 'SPECIAL_PURPOSE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DevSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DevStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'QA_REVIEW_PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "departmentId" INTEGER NOT NULL,
    "badgeNumber" TEXT,
    "reportingManagerId" INTEGER,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'Day',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "departmentCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_sub_types" (
    "id" SERIAL NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "process_sub_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_records" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'PENDING',
    "certifiedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "trainedById" INTEGER,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stages" (
    "id" SERIAL NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "canSkip" BOOLEAN NOT NULL DEFAULT false,
    "skipRoles" TEXT,
    "description" TEXT,

    CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trays_batches" (
    "id" SERIAL NOT NULL,
    "trayCode" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'units',
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "status" "TrayStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedUserId" INTEGER,
    "cleanroomRoute" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trays_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_entries" (
    "id" SERIAL NOT NULL,
    "trayBatchId" INTEGER NOT NULL,
    "workflowStageId" INTEGER,
    "processTypeId" INTEGER NOT NULL,
    "processSubTypeId" INTEGER,
    "departmentId" INTEGER,
    "machineId" INTEGER,
    "performedById" INTEGER NOT NULL,
    "assignedEmpId" INTEGER,
    "status" "EntryStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "comments" TEXT,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" SERIAL NOT NULL,
    "machineCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'NORMAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serialNumber" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_status_logs" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "oldStatus" "MachineStatus" NOT NULL,
    "newStatus" "MachineStatus" NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "remarks" TEXT,
    "isDowntime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviations" (
    "id" SERIAL NOT NULL,
    "deviationCode" TEXT NOT NULL,
    "ncrNumber" TEXT,
    "departmentId" INTEGER NOT NULL,
    "processTypeId" INTEGER,
    "processSubTypeId" INTEGER,
    "trayBatchId" INTEGER,
    "machineId" INTEGER,
    "reportedById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "issueCategory" TEXT NOT NULL,
    "severity" "DevSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "immediateAction" TEXT,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "status" "DevStatus" NOT NULL DEFAULT 'OPEN',
    "qaComment" TEXT,
    "shareableRef" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deviations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviation_media" (
    "id" SERIAL NOT NULL,
    "deviationId" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deviation_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "trayBatchId" INTEGER,
    "deviationId" INTEGER,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports_metadata" (
    "id" SERIAL NOT NULL,
    "generatedById" INTEGER NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB,
    "format" TEXT NOT NULL,
    "filePath" TEXT,
    "rowCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_roleId_module_key" ON "permissions"("roleId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_badgeNumber_key" ON "employees"("badgeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "process_types_name_key" ON "process_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "process_types_code_key" ON "process_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "process_sub_types_processTypeId_code_key" ON "process_sub_types"("processTypeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "training_records_employeeId_processTypeId_key" ON "training_records"("employeeId", "processTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_stages_processTypeId_sequence_key" ON "workflow_stages"("processTypeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trays_batches_trayCode_key" ON "trays_batches"("trayCode");

-- CreateIndex
CREATE UNIQUE INDEX "trays_batches_batchNumber_key" ON "trays_batches"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "machines_machineCode_key" ON "machines"("machineCode");

-- CreateIndex
CREATE UNIQUE INDEX "machines_code_key" ON "machines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "deviations_deviationCode_key" ON "deviations"("deviationCode");

-- CreateIndex
CREATE UNIQUE INDEX "deviations_shareableRef_key" ON "deviations"("shareableRef");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_sub_types" ADD CONSTRAINT "process_sub_types_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_trainedById_fkey" FOREIGN KEY ("trainedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_trayBatchId_fkey" FOREIGN KEY ("trayBatchId") REFERENCES "trays_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_workflowStageId_fkey" FOREIGN KEY ("workflowStageId") REFERENCES "workflow_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_processSubTypeId_fkey" FOREIGN KEY ("processSubTypeId") REFERENCES "process_sub_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_entries" ADD CONSTRAINT "process_entries_assignedEmpId_fkey" FOREIGN KEY ("assignedEmpId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_status_logs" ADD CONSTRAINT "machine_status_logs_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_status_logs" ADD CONSTRAINT "machine_status_logs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "process_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_processSubTypeId_fkey" FOREIGN KEY ("processSubTypeId") REFERENCES "process_sub_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_trayBatchId_fkey" FOREIGN KEY ("trayBatchId") REFERENCES "trays_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_media" ADD CONSTRAINT "deviation_media_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "deviations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_trayBatchId_fkey" FOREIGN KEY ("trayBatchId") REFERENCES "trays_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "deviations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approval_dev_fk" FOREIGN KEY ("recordId") REFERENCES "deviations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

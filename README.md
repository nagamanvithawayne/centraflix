# Centtralix

A full-stack manufacturing process control system (MES/ERP) built for **Acron Industries**, replacing spreadsheet-based operations with a centralized, auditable platform for tracking product batches as they move through machines, processes, and departments on the shop floor.

## Overview

Centtralix models a cleanroom manufacturing flow end-to-end: a batch of product ("tray") is created, routed through a sequence of workflow stages, and processed on specific machines by specific employees — with every step, status change, deviation, and approval logged for traceability and audit.

## Tech Stack

- **Frontend:** React 18, TypeScript, Electron (desktop packaging for shop-floor terminals)
- **Backend:** Node.js, Express
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT-based authentication with role-based, per-module permissions (view/create/edit/delete/export/approve)

## How Machine & Process Tracking Works

The data model is built around a few core entities:

- **`TrayBatch`** — a physical batch/lot of product moving through the plant (tray code, batch number, quantity, current stage, cleanroom route). Status: `ACTIVE`, `ON_HOLD`, `REWORK`, `REJECTED`, `COMPLETE`, `SHIPPED`.
- **`ProcessType` / `ProcessSubType`** — the catalog of manufacturing processes (e.g. cleaning, coating, packaging) and their sub-variants, each tied to a department and an ordered sequence.
- **`WorkflowStage`** — the defined sequence of stages a given process type must go through, including which stages are required vs. skippable (and by which roles).
- **`ProcessEntry`** — the actual event log: each row records that a specific tray batch was processed at a specific workflow stage, on a specific **machine**, by a specific employee, with a status (`IN_PROGRESS`, `COMPLETED`, `FAILED`, `ON_HOLD`, `SKIPPED`), timestamps, and arbitrary JSON `parameters` for process-specific readings (e.g. temperature, pressure, cycle time).
- **`Machine`** — each piece of equipment (code, name, department, serial number, model, manufacturer) with a live `status` (`NORMAL`, `NCR`, `SPECIAL_PURPOSE`, `OFFLINE`, `MAINTENANCE`).
- **`MachineStatusLog`** — every machine status change is logged with old/new status, who made the change, remarks, and whether it counts as downtime — giving a full uptime/downtime history per machine.
- **`Deviation`** (NCR) — non-conformances can be linked back to the specific tray batch, process, and machine involved, with severity, root cause, corrective action, and a review/approval workflow.
- **`TrainingRecord`** — employees must be certified per process type before working on it (status, certification/expiry dates, score), so the system can enforce "who's qualified to run this process."
- **`AuditLog`** — a global, queryable log of every create/update action across modules (user, module, old value, new value, IP, timestamp).

In short: **machines** are tracked as stateful assets with a full status/downtime history, **processes** are tracked as a defined stage sequence executed against those machines, and every execution (`ProcessEntry`) ties a batch, a machine, a process stage, and a person together — which is what makes deviations and audits traceable back to a root cause.

## Modules

- **Process Management** — process types, sub-types, and workflow stage configuration
- **Order Records** — customer orders, POs, agreements, and work order lifecycle tracking
- **Shipping Log** — outbound shipment records
- **NCR / Quarantine** — non-conformance reports and quarantined material handling
- **Machines** — equipment tracking, status, and downtime history
- **Departments** — organizational structure
- **Training** — employee certification per process type
- **Audit Log** — full audit trail of system actions

## Project Structure

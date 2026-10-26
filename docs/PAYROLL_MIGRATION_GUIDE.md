# Corporate HRMS & Payroll Engine: Database Migration & Data Safety Guide

## 1. Migration Safety Principles

1. **Forward-Only Migrations**: All schema updates use additive, forward-only SQL migration scripts or versioned Prisma migrations.
2. **Idempotent Data Backfills**: Backfill scripts (e.g. `backend/prisma/migrate_payroll_v2.ts`) check for existing records before inserting defaults.
3. **Zero Data Loss Guarantee**: Never use `npx prisma db push --accept-data-loss` in staging or production.
4. **Pre-Migration Backup Requirement**: A physical or logical dump of PostgreSQL is mandatory before executing migrations in any shared environment.

---

## 2. Backup Procedures

### 2.1 Logical Database Backup (pg_dump)
```bash
# Set PostgreSQL environment variables
export PGPASSWORD="your_secure_password"

# Logical backup with table definitions, data, and constraints
pg_dump -h localhost -p 5432 -U postgres -d payroll_db -F c -b -v -f "./backups/payroll_db_pre_migration_$(date +%Y%m%d_%H%M%S).dump"

# Plaintext SQL schema backup for audit review
pg_dump -h localhost -p 5432 -U postgres -d payroll_db --schema-only -f "./backups/payroll_schema_$(date +%Y%m%d).sql"
```

### 2.2 Verifying Backup Integrity
```bash
# Verify dump file contents without restoring
pg_restore -l "./backups/payroll_db_pre_migration_20261014.dump" | head -n 30
```

---

## 3. Schema Architecture & Active Models

The database models introduced and preserved across migrations include:
- `SalaryComponent`: Master component table with unique `[companyId, code]`.
- `SalaryTemplate` & `SalaryTemplateLine`: Grade structures linked by foreign keys.
- `EmployeeSalaryStructure` & `EmployeeSalaryLine`: Active assigned structures.
- `EmployeeSalaryRevision`: Historical snapshots preserved across compensation changes.
- `EmployeePayrollPolicy`: Statutory flags, PF UAN, ESIC number, and state PT rules.
- `CorporatePayrollRun`: 7-stage cycle tracker with status, period, and lock flags.
- `CorporatePayrollSlip`: Itemized calculation results with JSON trace snapshots.
- `CorporatePayrollItem`: Breakdown rows with code, name, type, and decimal amount.
- `CorporatePayrollTransition`: Audit log of all state machine events.

---

## 4. Migration Execution Protocol

### Step 1: Validate Environment Variables
Ensure `backend/.env` points to the target database:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payroll_db?schema=public"
```

### Step 2: Generate and Apply Prisma Schema
```powershell
cd backend

# Validate schema syntax
npx prisma validate

# Deploy pending migrations
npx prisma migrate deploy

# Generate latest TypeScript Prisma Client
npx prisma generate
```

### Step 3: Run Idempotent Payroll V2 Data Backfill
If upgrading historical databases with older un-configured salary or policy records, execute the verified backfill script:
```powershell
npx tsx prisma/migrate_payroll_v2.ts
```
The backfill script safely:
- Creates standard components (`BASIC`, `HRA`, `SPECIAL_ALLOWANCE`, `CONVEYANCE`, `MEDICAL`, `EPF_EMPLOYEE`, `ESIC_EMPLOYEE`, `PROF_TAX`, `TDS`, `LOAN_EMI`, `EPF_EMPLOYER`) if missing.
- Sets up standard corporate templates.
- Configures default `EmployeePayrollPolicy` for employees without existing policies.
- Preserves all historical attendance, leaves, and payroll records.

---

## 5. Rollback and Disaster Recovery Strategy

If an unexpected error occurs during migration:

### 5.1 Immediate Forward Recovery (Preferred)
1. Inspect the Prisma migration log: `SELECT * FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;`
2. Apply targeted corrective forward migration scripts rather than tearing down populated tables.

### 5.2 Full Database Restoration
If data corruption occurs:
```bash
# Disconnect active application connections
psql -h localhost -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'payroll_db';"

# Drop and recreate clean target database
dropdb -h localhost -U postgres payroll_db
createdb -h localhost -U postgres payroll_db

# Restore from pre-migration dump
pg_restore -h localhost -U postgres -d payroll_db -v "./backups/payroll_db_pre_migration_20261014.dump"
```

---

## 6. Post-Migration Verification Checklist

Execute the automated test suite to confirm data integrity:
```powershell
cd backend
npx vitest run
```
Confirm all 88 test scenarios pass.

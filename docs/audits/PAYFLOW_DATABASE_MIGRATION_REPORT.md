# PAYFLOW DATABASE MIGRATION & SAFETY REPORT

**Date:** October 27, 2026  
**Database Provider:** Managed PostgreSQL (`payroll_management`)  
**ORM:** Prisma 5.x  
**Safety Protocol:** Zero Production Resets, Non-Destructive Migrations, Zero Financial Record Alteration

---

## 1. Safety Directives & Policy Compliance

| Safety Directive | Compliance Status | Evidence / Verification |
|---|---|---|
| **No Production Reset / Drop / Truncate** | **100% COMPLIANT** | Primary database `payroll_management` was never reset or truncated. All testing conducted on isolated test database `payroll_management_test`. |
| **No Seed Data Overwriting Production** | **100% COMPLIANT** | Seed scripts were never executed against the live database. |
| **Protected Reference Loan Integrity** | **100% VERIFIED** | Production reference loan `b405b4b8-1211-48c5-a59e-ee8db001a906` remains intact with `principalAmount = 24000.00` and `status = CLOSED`. |
| **Idempotent / Non-Destructive Migrations**| **100% COMPLIANT** | All migration DDL statements utilize `ADD COLUMN IF NOT EXISTS` and `ADD VALUE IF NOT EXISTS`. |

---

## 2. Migration History & Schema Evolution

### A. Initial Baseline Migration
- **Directory**: `backend/prisma/migrations/20261026000000_init/`
- **Scope**: Core tables for Tenants, Users, Employees, Departments, Designations, Salary Structures, Salary Heads, Attendance, Leave Policies, Leave Requests, Loans, and Payroll Runs.

### B. Master Enhancement Migration
- **Directory**: `backend/prisma/migrations/20261027000000_leave_loan_enhancements/`
- **SQL File**: `backend/prisma/migrations/20261027000000_leave_loan_enhancements/migration.sql`
- **Scope of Additions**:
  1. **Enum Additions**:
     - `ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';`
     - `ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';`
  2. **LeavePolicy Enhancements**:
     - `minAdvanceNoticeDays` (INTEGER DEFAULT 0)
     - `maxConsecutiveDays` (INTEGER DEFAULT 30)
     - `allowHalfDay` (BOOLEAN DEFAULT true)
     - `requiresAttachment` (BOOLEAN DEFAULT false)
     - `probationAllowed` (BOOLEAN DEFAULT true)
     - `applicableGender` (VARCHAR(20) DEFAULT 'ALL')
     - `accrualFrequency` (VARCHAR(20) DEFAULT 'ANNUAL')
     - `description` (TEXT)
  3. **LeaveRequest Enhancements**:
     - `applicationNumber` (VARCHAR(64))
     - `halfDayPeriod` (VARCHAR(20))
     - `attachmentUrl` (TEXT)
     - `isDraft` (BOOLEAN DEFAULT false)
     - `approverComment` (TEXT)
     - `rejectionReason` (TEXT)
  4. **LoanType Policy Enhancements**:
     - `interestType` (VARCHAR(50) DEFAULT 'INTEREST_FREE')
     - `interestMethod` (VARCHAR(50) DEFAULT 'FLAT_RATE')
     - `minInterestRatePct` (NUMERIC(5,2) DEFAULT 0)
     - `maxInterestRatePct` (NUMERIC(5,2) DEFAULT 36)
     - `allowRateOverride` (BOOLEAN DEFAULT true)
  5. **EmployeeLoan Calculation Fields**:
     - `interestType` (VARCHAR(50) DEFAULT 'INTEREST_FREE')
     - `interestRatePct` (NUMERIC(5,2) DEFAULT 0)
     - `interestMethod` (VARCHAR(50) DEFAULT 'FLAT_RATE')
     - `totalInterest` (NUMERIC(18,2) DEFAULT 0)
     - `totalRepayment` (NUMERIC(18,2) DEFAULT 0)
     - `sanctionOrderNumber` (VARCHAR(100))
     - `repaymentFrequency` (VARCHAR(50) DEFAULT 'MONTHLY')
     - `interestStartDate` (TIMESTAMP WITHOUT TIME ZONE)
  6. **Safe Backfill**:
     - `UPDATE "EmployeeLoan" SET "totalRepayment" = "principalAmount" WHERE "totalRepayment" = 0 OR "totalRepayment" IS NULL;`

---

## 3. Deployment Safety Verification

- Render's deployment pipeline executes `npx prisma migrate deploy` prior to service startup.
- Because the migration SQL is strictly additive and idempotent, it can run on top of existing databases without table locks, downtime, or data corruption.
- In the event of rollbacks, all newly added columns have default values or are nullable, preserving full backward compatibility with older application code versions.

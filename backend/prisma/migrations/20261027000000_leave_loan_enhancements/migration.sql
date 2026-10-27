-- Migration: 20261027000000_leave_loan_enhancements
-- Description: Non-destructive additions for Leave and Loan enhancements

-- 1. Enum additions for RequestStatus (Leave workflow)
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- 2. LeavePolicy enhancements
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "minAdvanceNoticeDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "allowHalfDay" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "requiresAttachment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "probationAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "applicableGender" VARCHAR(20) NOT NULL DEFAULT 'ALL';
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "accrualFrequency" VARCHAR(20) NOT NULL DEFAULT 'ANNUAL';
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- 3. LeaveRequest enhancements
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "applicationNumber" VARCHAR(64);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "halfDayPeriod" VARCHAR(20);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "approverComment" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- 4. LoanType enhancements
ALTER TABLE "LoanType" ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) NOT NULL DEFAULT 'INTEREST_FREE';
ALTER TABLE "LoanType" ADD COLUMN IF NOT EXISTS "interestMethod" VARCHAR(50) NOT NULL DEFAULT 'FLAT_RATE';
ALTER TABLE "LoanType" ADD COLUMN IF NOT EXISTS "minInterestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE "LoanType" ADD COLUMN IF NOT EXISTS "maxInterestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 36;
ALTER TABLE "LoanType" ADD COLUMN IF NOT EXISTS "allowRateOverride" BOOLEAN NOT NULL DEFAULT true;

-- 5. EmployeeLoan enhancements
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "interestType" VARCHAR(50) NOT NULL DEFAULT 'INTEREST_FREE';
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "interestRatePct" NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "interestMethod" VARCHAR(50) NOT NULL DEFAULT 'FLAT_RATE';
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "totalInterest" NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "totalRepayment" NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "sanctionOrderNumber" VARCHAR(100);
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "repaymentFrequency" VARCHAR(50) NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "interestStartDate" TIMESTAMP WITHOUT TIME ZONE;

-- 6. Backfill existing loans default totalRepayment
UPDATE "EmployeeLoan" 
SET "totalRepayment" = "principalAmount" 
WHERE "totalRepayment" = 0 OR "totalRepayment" IS NULL;

-- CreateEnum
CREATE TYPE "CadreType" AS ENUM ('TEACHING', 'NON_TEACHING', 'ADMINISTRATIVE', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACTUAL', 'ADHOC', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "OuType" AS ENUM ('CAMPUS', 'FACULTY', 'DIRECTORATE', 'REGIONAL_CENTRE', 'COLLEGE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('GENERATED', 'VERIFIED', 'FINALIZED', 'APPROVED', 'RETURNED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "SalaryHeadType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FIXED', 'PERCENTAGE_OF_HEAD', 'FORMULA');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('NEFT', 'RTGS', 'PFMS', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'EXPORTED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "GpfTransactionType" AS ENUM ('MONTHLY_SUBSCRIPTION', 'ADDITIONAL_SUBSCRIPTION', 'ADVANCE_TAKEN', 'ADVANCE_RECOVERY', 'WITHDRAWAL', 'REFUND', 'ARREAR_DEPOSIT', 'INTEREST_CREDIT');

-- CreateEnum
CREATE TYPE "GpfAccountStatus" AS ENUM ('ACTIVE', 'TEMPORARILY_CLOSED', 'FINALLY_CLOSED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'VALIDATED', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('SALARY_CONFIG', 'PROGRESSION_DATES', 'RECURRING_DATA', 'ONE_TIME_DATA', 'CITY_CATEGORIES', 'ARREARS', 'PAY_MATRIX', 'PF_GPF', 'RUNNING_ADVANCES');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationalUnit" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OuType" NOT NULL DEFAULT 'FACULTY',
    "parentOuId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "ouId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadre" "CadreType" NOT NULL DEFAULT 'NON_TEACHING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeGroup" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedPayrollGroup" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedPayrollGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "employeeId" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "ouId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSetting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialYear" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayBand" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimumAmount" DECIMAL(18,2) NOT NULL,
    "maximumAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradePayScale" (
    "id" TEXT NOT NULL,
    "payBandId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradePayAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradePayScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayLevel" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayMatrixCell" (
    "id" TEXT NOT NULL,
    "payLevelId" TEXT NOT NULL,
    "indexNumber" INTEGER NOT NULL,
    "basicAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayMatrixCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHead" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalaryHeadType" NOT NULL,
    "calculationType" "CalculationType" NOT NULL DEFAULT 'FIXED',
    "formulaConfig" JSONB,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isLeaveImpacted" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureLine" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "salaryHeadId" TEXT NOT NULL,
    "calculationType" "CalculationType" NOT NULL DEFAULT 'FIXED',
    "baseHeadCode" TEXT,
    "percentage" DECIMAL(8,4),
    "fixedAmount" DECIMAL(18,2),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalaryStructureLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "ouId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "employeeGroupId" TEXT NOT NULL,
    "managedPayrollGroupId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "dateOfRetirement" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "email" TEXT,
    "phone" TEXT,
    "pan" TEXT,
    "maskedPan" TEXT,
    "aadhaarLast4" TEXT,
    "cityCategory" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBankAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountNumber" TEXT NOT NULL,
    "maskedAccount" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "paymentMode" "PaymentMethod" NOT NULL DEFAULT 'NEFT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "payLevelId" TEXT,
    "payMatrixCellId" TEXT,
    "basicPay" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTaxProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL DEFAULT 'NEW',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "ouId" TEXT,
    "financialYearId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionsTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "finalizedBy" TEXT,
    "approvedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workingDays" INTEGER NOT NULL DEFAULT 30,
    "payableDays" INTEGER NOT NULL DEFAULT 30,
    "leaveLossOfPayDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "basicPay" DECIMAL(18,2) NOT NULL,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "deductionAmount" DECIMAL(18,2) NOT NULL,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "calculationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "salaryHeadId" TEXT NOT NULL,
    "headCode" TEXT NOT NULL,
    "headName" TEXT NOT NULL,
    "headType" "SalaryHeadType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "ruleVersion" TEXT,
    "formulaNote" TEXT,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollTransition" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "fromStatus" "PayrollStatus" NOT NULL,
    "toStatus" "PayrollStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSection" (
    "id" TEXT NOT NULL,
    "sectionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxLimit" DECIMAL(18,2) NOT NULL,
    "regimeAllowed" "TaxRegime" NOT NULL DEFAULT 'OLD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDeclaration" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "declaredAmount" DECIMAL(18,2) NOT NULL,
    "verifiedAmount" DECIMAL(18,2),
    "status" "DeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "documentUrls" JSONB,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanType" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxAmount" DECIMAL(18,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "maxInstallments" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "loanTypeId" TEXT NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "interestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "monthlyInstallment" DECIMAL(18,2) NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "recoveredInstallments" INTEGER NOT NULL DEFAULT 0,
    "recoveredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "sanctionOrderNumber" TEXT,
    "sanctionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRecovery" (
    "id" TEXT NOT NULL,
    "employeeLoanId" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL,
    "remainingBalance" DECIMAL(18,2) NOT NULL,
    "recoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "deductionRatio" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeaveRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "daysCount" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeLeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrearBatch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrearBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrearRecord" (
    "id" TEXT NOT NULL,
    "arrearBatchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "oldBasic" DECIMAL(18,2) NOT NULL,
    "newBasic" DECIMAL(18,2) NOT NULL,
    "basicDiff" DECIMAL(18,2) NOT NULL,
    "daDiff" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hraDiff" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taDiff" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalArrear" DECIMAL(18,2) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArrearRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayFixation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousPayLevel" TEXT NOT NULL,
    "previousBasic" DECIMAL(18,2) NOT NULL,
    "revisedPayLevel" TEXT NOT NULL,
    "revisedBasic" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayFixation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncrementBatch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncrementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeIncrement" (
    "id" TEXT NOT NULL,
    "incrementBatchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currentCellId" TEXT,
    "currentBasic" DECIMAL(18,2) NOT NULL,
    "nextCellId" TEXT,
    "nextBasic" DECIMAL(18,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "nextIncrementDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeIncrement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherPaymentType" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherPaymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherPayment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentTypeId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "periodId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtherPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpfInterestRate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "ratePercentage" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpfInterestRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpfAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openingBalanceDate" TIMESTAMP(3) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "GpfAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closureRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpfTransaction" (
    "id" TEXT NOT NULL,
    "gpfAccountId" TEXT NOT NULL,
    "periodId" TEXT,
    "transactionType" "GpfTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GpfTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpfStatement" (
    "id" TEXT NOT NULL,
    "gpfAccountId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "totalSubscriptions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalInterest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalWithdrawals" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "verifiedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpfStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRowError" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "fieldName" TEXT,
    "errorReason" TEXT NOT NULL,
    "rawData" JSONB,

    CONSTRAINT "ImportRowError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'NEFT',
    "totalEmployees" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "PaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "adviceFileName" TEXT,
    "exportedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "OrganizationalUnit_institutionId_active_idx" ON "OrganizationalUnit"("institutionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationalUnit_institutionId_code_key" ON "OrganizationalUnit"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_ouId_code_key" ON "Department"("ouId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_institutionId_code_key" ON "Designation"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeGroup_institutionId_code_key" ON "EmployeeGroup"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedPayrollGroup_institutionId_code_key" ON "ManagedPayrollGroup"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_ouId_key" ON "UserRole"("userId", "roleId", "ouId");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_createdAt_idx" ON "AuditLog"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_entityType_idx" ON "AuditLog"("action", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSetting_institutionId_key_key" ON "InstitutionSetting"("institutionId", "key");

-- CreateIndex
CREATE INDEX "FinancialYear_institutionId_active_idx" ON "FinancialYear"("institutionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYear_institutionId_name_key" ON "FinancialYear"("institutionId", "name");

-- CreateIndex
CREATE INDEX "PayrollPeriod_financialYearId_status_idx" ON "PayrollPeriod"("financialYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_financialYearId_periodNumber_key" ON "PayrollPeriod"("financialYearId", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayBand_institutionId_code_key" ON "PayBand"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GradePayScale_payBandId_code_key" ON "GradePayScale"("payBandId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PayLevel_institutionId_levelNumber_key" ON "PayLevel"("institutionId", "levelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayMatrixCell_payLevelId_indexNumber_key" ON "PayMatrixCell"("payLevelId", "indexNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryHead_institutionId_code_key" ON "SalaryHead"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_institutionId_code_key" ON "SalaryStructure"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureLine_structureId_salaryHeadId_key" ON "SalaryStructureLine"("structureId", "salaryHeadId");

-- CreateIndex
CREATE INDEX "Employee_institutionId_ouId_active_idx" ON "Employee"("institutionId", "ouId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_institutionId_employeeCode_key" ON "Employee"("institutionId", "employeeCode");

-- CreateIndex
CREATE INDEX "EmployeeBankAccount_employeeId_isPrimary_idx" ON "EmployeeBankAccount"("employeeId", "isPrimary");

-- CreateIndex
CREATE INDEX "EmployeeSalaryAssignment_employeeId_active_idx" ON "EmployeeSalaryAssignment"("employeeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTaxProfile_employeeId_financialYearId_key" ON "EmployeeTaxProfile"("employeeId", "financialYearId");

-- CreateIndex
CREATE INDEX "PayrollRun_institutionId_periodId_status_idx" ON "PayrollRun"("institutionId", "periodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_institutionId_periodId_version_key" ON "PayrollRun"("institutionId", "periodId", "version");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_createdAt_idx" ON "PayrollRecord"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_payrollRunId_employeeId_key" ON "PayrollRecord"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollLine_payrollRecordId_headType_idx" ON "PayrollLine"("payrollRecordId", "headType");

-- CreateIndex
CREATE INDEX "PayrollTransition_payrollRunId_createdAt_idx" ON "PayrollTransition"("payrollRunId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxSection_sectionCode_key" ON "TaxSection"("sectionCode");

-- CreateIndex
CREATE INDEX "TaxDeclaration_employeeId_financialYearId_idx" ON "TaxDeclaration"("employeeId", "financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDeclaration_employeeId_financialYearId_sectionId_key" ON "TaxDeclaration"("employeeId", "financialYearId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanType_institutionId_code_key" ON "LoanType"("institutionId", "code");

-- CreateIndex
CREATE INDEX "EmployeeLoan_employeeId_status_idx" ON "EmployeeLoan"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LoanRecovery_employeeLoanId_idx" ON "LoanRecovery"("employeeLoanId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_institutionId_code_key" ON "LeaveType"("institutionId", "code");

-- CreateIndex
CREATE INDEX "EmployeeLeaveRecord_employeeId_fromDate_toDate_idx" ON "EmployeeLeaveRecord"("employeeId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "ArrearBatch_institutionId_status_idx" ON "ArrearBatch"("institutionId", "status");

-- CreateIndex
CREATE INDEX "ArrearRecord_arrearBatchId_employeeId_idx" ON "ArrearRecord"("arrearBatchId", "employeeId");

-- CreateIndex
CREATE INDEX "PayFixation_employeeId_idx" ON "PayFixation"("employeeId");

-- CreateIndex
CREATE INDEX "IncrementBatch_institutionId_effectiveDate_idx" ON "IncrementBatch"("institutionId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeIncrement_incrementBatchId_employeeId_key" ON "EmployeeIncrement"("incrementBatchId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OtherPaymentType_institutionId_code_key" ON "OtherPaymentType"("institutionId", "code");

-- CreateIndex
CREATE INDEX "OtherPayment_employeeId_financialYearId_idx" ON "OtherPayment"("employeeId", "financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "GpfInterestRate_institutionId_financialYearId_effectiveFrom_key" ON "GpfInterestRate"("institutionId", "financialYearId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "GpfAccount_employeeId_key" ON "GpfAccount"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "GpfAccount_accountNumber_key" ON "GpfAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "GpfTransaction_gpfAccountId_transactionDate_idx" ON "GpfTransaction"("gpfAccountId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "GpfStatement_gpfAccountId_financialYearId_key" ON "GpfStatement"("gpfAccountId", "financialYearId");

-- CreateIndex
CREATE INDEX "ImportJob_institutionId_importType_idx" ON "ImportJob"("institutionId", "importType");

-- CreateIndex
CREATE INDEX "ImportRowError_importJobId_idx" ON "ImportRowError"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_batchNumber_key" ON "PaymentBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PaymentBatch_institutionId_status_idx" ON "PaymentBatch"("institutionId", "status");

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_parentOuId_fkey" FOREIGN KEY ("parentOuId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganizationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeGroup" ADD CONSTRAINT "EmployeeGroup_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedPayrollGroup" ADD CONSTRAINT "ManagedPayrollGroup_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSetting" ADD CONSTRAINT "InstitutionSetting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayBand" ADD CONSTRAINT "PayBand_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradePayScale" ADD CONSTRAINT "GradePayScale_payBandId_fkey" FOREIGN KEY ("payBandId") REFERENCES "PayBand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayLevel" ADD CONSTRAINT "PayLevel_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayMatrixCell" ADD CONSTRAINT "PayMatrixCell_payLevelId_fkey" FOREIGN KEY ("payLevelId") REFERENCES "PayLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryHead" ADD CONSTRAINT "SalaryHead_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_salaryHeadId_fkey" FOREIGN KEY ("salaryHeadId") REFERENCES "SalaryHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganizationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employeeGroupId_fkey" FOREIGN KEY ("employeeGroupId") REFERENCES "EmployeeGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managedPayrollGroupId_fkey" FOREIGN KEY ("managedPayrollGroupId") REFERENCES "ManagedPayrollGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBankAccount" ADD CONSTRAINT "EmployeeBankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryAssignment" ADD CONSTRAINT "EmployeeSalaryAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryAssignment" ADD CONSTRAINT "EmployeeSalaryAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryAssignment" ADD CONSTRAINT "EmployeeSalaryAssignment_payLevelId_fkey" FOREIGN KEY ("payLevelId") REFERENCES "PayLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryAssignment" ADD CONSTRAINT "EmployeeSalaryAssignment_payMatrixCellId_fkey" FOREIGN KEY ("payMatrixCellId") REFERENCES "PayMatrixCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaxProfile" ADD CONSTRAINT "EmployeeTaxProfile_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_salaryHeadId_fkey" FOREIGN KEY ("salaryHeadId") REFERENCES "SalaryHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollTransition" ADD CONSTRAINT "PayrollTransition_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeclaration" ADD CONSTRAINT "TaxDeclaration_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TaxSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanType" ADD CONSTRAINT "LoanType_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRecovery" ADD CONSTRAINT "LoanRecovery_employeeLoanId_fkey" FOREIGN KEY ("employeeLoanId") REFERENCES "EmployeeLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRecovery" ADD CONSTRAINT "LoanRecovery_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveRecord" ADD CONSTRAINT "EmployeeLeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveRecord" ADD CONSTRAINT "EmployeeLeaveRecord_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrearBatch" ADD CONSTRAINT "ArrearBatch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrearRecord" ADD CONSTRAINT "ArrearRecord_arrearBatchId_fkey" FOREIGN KEY ("arrearBatchId") REFERENCES "ArrearBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrearRecord" ADD CONSTRAINT "ArrearRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayFixation" ADD CONSTRAINT "PayFixation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementBatch" ADD CONSTRAINT "IncrementBatch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementBatch" ADD CONSTRAINT "IncrementBatch_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeIncrement" ADD CONSTRAINT "EmployeeIncrement_incrementBatchId_fkey" FOREIGN KEY ("incrementBatchId") REFERENCES "IncrementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeIncrement" ADD CONSTRAINT "EmployeeIncrement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeIncrement" ADD CONSTRAINT "EmployeeIncrement_currentCellId_fkey" FOREIGN KEY ("currentCellId") REFERENCES "PayMatrixCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeIncrement" ADD CONSTRAINT "EmployeeIncrement_nextCellId_fkey" FOREIGN KEY ("nextCellId") REFERENCES "PayMatrixCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPaymentType" ADD CONSTRAINT "OtherPaymentType_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPayment" ADD CONSTRAINT "OtherPayment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPayment" ADD CONSTRAINT "OtherPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPayment" ADD CONSTRAINT "OtherPayment_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "OtherPaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPayment" ADD CONSTRAINT "OtherPayment_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherPayment" ADD CONSTRAINT "OtherPayment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfInterestRate" ADD CONSTRAINT "GpfInterestRate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfInterestRate" ADD CONSTRAINT "GpfInterestRate_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfAccount" ADD CONSTRAINT "GpfAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfTransaction" ADD CONSTRAINT "GpfTransaction_gpfAccountId_fkey" FOREIGN KEY ("gpfAccountId") REFERENCES "GpfAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfTransaction" ADD CONSTRAINT "GpfTransaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfStatement" ADD CONSTRAINT "GpfStatement_gpfAccountId_fkey" FOREIGN KEY ("gpfAccountId") REFERENCES "GpfAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpfStatement" ADD CONSTRAINT "GpfStatement_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRowError" ADD CONSTRAINT "ImportRowError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

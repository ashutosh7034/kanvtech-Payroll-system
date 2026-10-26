-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'PROBATIONARY', 'CONTRACTUAL', 'CONSULTANT', 'INTERN', 'PART_TIME');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'CONFIRMED', 'NOTICE_PERIOD', 'SUSPENDED', 'EXITED');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('OFFICE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_STATUTORY');

-- CreateEnum
CREATE TYPE "CalculationMode" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE_OF_COMPONENT', 'FORMULA_EXPRESSION');

-- CreateEnum
CREATE TYPE "PunchSource" AS ENUM ('WEB', 'BIOMETRIC', 'MOBILE', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveDurationType" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CORRECTION_REQUESTED', 'PAID');

-- CreateEnum
CREATE TYPE "CorporatePayrollStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAYMENT_READY', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'UPI');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'MOBILE', 'MONITOR', 'ACCESS_CARD', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('APPLIED', 'SHORTLISTED', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'OFFER_EXTENDED', 'HIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('UNSATISFACTORY', 'NEEDS_IMPROVEMENT', 'MEETS_EXPECTATIONS', 'EXCEEDS_EXPECTATIONS', 'OUTSTANDING');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "legalName" TEXT NOT NULL,
    "cinNumber" TEXT,
    "gstin" TEXT,
    "panNumber" TEXT,
    "tanNumber" TEXT,
    "pfEstablishmentCode" TEXT,
    "esicCode" TEXT,
    "ptrcNumber" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "pinCode" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
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
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobBand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minCtc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxCtc" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activeSessionId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "jobBandId" TEXT,
    "costCenterId" TEXT,
    "managerId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "personalEmail" TEXT,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "maritalStatus" TEXT,
    "bloodGroup" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
    "workMode" "WorkMode" NOT NULL DEFAULT 'OFFICE',
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "probationDays" INTEGER NOT NULL DEFAULT 90,
    "confirmationDate" TIMESTAMP(3),
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 60,
    "exitDate" TIMESTAMP(3),
    "panNumber" TEXT,
    "uanNumber" TEXT,
    "pfNumber" TEXT,
    "esicNumber" TEXT,
    "aadhaarMasked" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "ifscCode" TEXT,
    "bankBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentTimeline" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "openingsCount" INTEGER NOT NULL DEFAULT 1,
    "minExperience" INTEGER NOT NULL DEFAULT 0,
    "budgetMin" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "budgetMax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentCompany" TEXT,
    "currentCtc" DECIMAL(18,2),
    "expectedCtc" DECIMAL(18,2),
    "noticePeriodDays" INTEGER,
    "resumeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" "CandidateStage" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "roundName" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "interviewerName" TEXT NOT NULL,
    "interviewerEmail" TEXT,
    "score" INTEGER,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "offeredCtc" DECIMAL(18,2) NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "offerStatus" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "offerLetterUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultDueDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboardingTask" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FIXED_EARNING',
    "calculationMode" "CalculationMode" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "formulaExpression" TEXT,
    "baseComponentCode" TEXT,
    "percentageValue" DECIMAL(7,4),
    "fixedAmount" DECIMAL(18,2),
    "minLimit" DECIMAL(18,2),
    "maxLimit" DECIMAL(18,2),
    "roundPolicy" TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isPfGross" BOOLEAN NOT NULL DEFAULT false,
    "isEsicGross" BOOLEAN NOT NULL DEFAULT false,
    "isPtGross" BOOLEAN NOT NULL DEFAULT false,
    "affectsGross" BOOLEAN NOT NULL DEFAULT true,
    "affectsNet" BOOLEAN NOT NULL DEFAULT true,
    "affectsCtc" BOOLEAN NOT NULL DEFAULT true,
    "payslipVisibility" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "calculationMode" "CalculationMode" NOT NULL,
    "percentageOfBasic" DECIMAL(7,4),
    "percentageValue" DECIMAL(7,4),
    "fixedAmount" DECIMAL(18,2),
    "formulaExpression" TEXT,
    "baseComponentCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalaryTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryStructure" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "annualCtc" DECIMAL(18,2) NOT NULL,
    "monthlyGross" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "revisionReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryLine" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(18,2) NOT NULL,
    "annualAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "EmployeeSalaryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryRevision" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "annualCtc" DECIMAL(18,2) NOT NULL,
    "monthlyGross" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "revisionReason" TEXT,
    "approvedBy" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayrollPolicy" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "pfStatus" TEXT NOT NULL DEFAULT 'APPLICABLE',
    "pfWageBasis" TEXT NOT NULL DEFAULT 'CEILING_15000',
    "pfNumber" TEXT,
    "uanNumber" TEXT,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "esiStatus" TEXT NOT NULL DEFAULT 'EXEMPT_OVER_CEILING',
    "esiNumber" TEXT,
    "ptApplicable" BOOLEAN NOT NULL DEFAULT true,
    "ptState" TEXT NOT NULL DEFAULT 'Maharashtra',
    "taxRegime" TEXT NOT NULL DEFAULT 'NEW',
    "tdsMonthlyOverride" DECIMAL(18,2),
    "paymentMode" "PaymentMethod" NOT NULL DEFAULT 'NEFT',
    "payrollFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "exceptionRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayMinutes" INTEGER NOT NULL DEFAULT 240,
    "fullDayMinutes" INTEGER NOT NULL DEFAULT 480,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRoster" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftPolicyId" TEXT NOT NULL,
    "rosterDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "punchType" TEXT NOT NULL,
    "source" "PunchSource" NOT NULL DEFAULT 'WEB',
    "ipAddress" TEXT,
    "deviceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "shiftPolicyId" TEXT,
    "firstIn" TIMESTAMP(3),
    "lastOut" TIMESTAMP(3),
    "workingHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRegularization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonNotes" TEXT NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "actionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRegularization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualQuota" DECIMAL(5,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "maxCarryForward" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "encashable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "credited" DECIMAL(5,2) NOT NULL,
    "used" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "durationType" "LeaveDurationType" NOT NULL DEFAULT 'FULL_DAY',
    "totalDays" DECIMAL(4,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "actionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporatePayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "status" "CorporatePayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEmployerCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "validationNotes" JSONB,
    "varianceNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporatePayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporatePayrollSlip" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workingDays" INTEGER NOT NULL DEFAULT 30,
    "payableDays" DECIMAL(5,2) NOT NULL,
    "lopDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unpaidDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "arrearsAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reimbursementAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "variableEarnings" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pfWageBasis" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "esiWageBasis" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ptWageBasis" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(18,2) NOT NULL,
    "deductionsPay" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "employerCost" DECIMAL(18,2) NOT NULL,
    "calculationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporatePayrollSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporatePayrollItem" (
    "id" TEXT NOT NULL,
    "payrollSlipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CorporatePayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporatePayrollTransition" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "fromStatus" "CorporatePayrollStatus" NOT NULL,
    "toStatus" "CorporatePayrollStatus" NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "remarks" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporatePayrollTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipDispatchRecord" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollSlipId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "errorDetails" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'smtp',

    CONSTRAINT "PayslipDispatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pfWageCeiling" DECIMAL(18,2) NOT NULL DEFAULT 15000,
    "pfEmployeePct" DECIMAL(5,2) NOT NULL DEFAULT 12.0,
    "pfEmployerEpfsPct" DECIMAL(5,2) NOT NULL DEFAULT 3.67,
    "pfEmployerEpsPct" DECIMAL(5,2) NOT NULL DEFAULT 8.33,
    "esicWageCeiling" DECIMAL(18,2) NOT NULL DEFAULT 21000,
    "esicEmployeePct" DECIMAL(5,2) NOT NULL DEFAULT 0.75,
    "esicEmployerPct" DECIMAL(5,2) NOT NULL DEFAULT 3.25,
    "gratuityPct" DECIMAL(5,2) NOT NULL DEFAULT 4.81,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalTaxSlab" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "minSalary" DECIMAL(18,2) NOT NULL,
    "maxSalary" DECIMAL(18,2),
    "monthlyAmount" DECIMAL(18,2) NOT NULL,
    "februaryAmount" DECIMAL(18,2),

    CONSTRAINT "ProfessionalTaxSlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTaxDeclaration" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'NEW',
    "section80C" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "section80D" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "section24b" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hraRentPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxLimit" DECIMAL(18,2),
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT,
    "employeeId" TEXT NOT NULL,
    "claimType" TEXT DEFAULT 'EXPENSE',
    "title" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "actionedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "resubmittedAt" TIMESTAMP(3),
    "correctionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseClaimId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receiptUrl" TEXT,
    "description" TEXT,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "estimatedBudget" DECIMAL(18,2) NOT NULL,
    "advanceAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAllocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "allocatedHours" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "ProjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceCycle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeGoal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weightage" INTEGER NOT NULL DEFAULT 20,
    "targetMetric" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "selfScore" INTEGER,
    "selfComments" TEXT,
    "managerScore" INTEGER,
    "managerComments" TEXT,
    "rating" "ReviewRating",
    "promotionRecommended" BOOLEAN NOT NULL DEFAULT false,
    "incrementPct" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trainerName" TEXT,
    "durationHours" INTEGER NOT NULL DEFAULT 8,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingNomination" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOMINATED',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxAmount" DECIMAL(18,2) NOT NULL,
    "interestRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maxTenureMonths" INTEGER NOT NULL DEFAULT 12,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "loanTypeId" TEXT NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "monthlyEmi" DECIMAL(18,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "recoveredAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "serialNumber" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAllocation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',

    CONSTRAINT "AssetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpDeskCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slaHours" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "HelpDeskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpDeskTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpDeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resignation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedLwd" TIMESTAMP(3) NOT NULL,
    "agreedLwd" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "actionedAt" TIMESTAMP(3),

    CONSTRAINT "Resignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FnfSettlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "resignationId" TEXT NOT NULL,
    "lastWorkingDay" TIMESTAMP(3) NOT NULL,
    "noticeShortfallDays" INTEGER NOT NULL DEFAULT 0,
    "noticeRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leaveEncashment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gratuityAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "salaryDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanRecoveryDues" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netSettlementPay" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FnfSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorPass" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "passNumber" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "optionsJson" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCustomFieldValue" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "fieldValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "type" TEXT NOT NULL DEFAULT 'EXPENSE_CLAIM',
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_companyId_code_key" ON "Designation"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JobBand_companyId_code_key" ON "JobBand"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_idx" ON "AuditLog"("companyId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE INDEX "Employee_companyId_status_idx" ON "Employee"("companyId", "status");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobOpeningId_candidateId_key" ON "JobApplication"("jobOpeningId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_jobApplicationId_key" ON "JobOffer"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_companyId_code_key" ON "SalaryComponent"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryTemplate_companyId_code_key" ON "SalaryTemplate"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalaryStructure_employeeId_key" ON "EmployeeSalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryRevision_employeeId_effectiveFrom_idx" ON "EmployeeSalaryRevision"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollPolicy_employeeId_key" ON "EmployeePayrollPolicy"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPolicy_companyId_code_key" ON "ShiftPolicy"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRoster_employeeId_rosterDate_key" ON "ShiftRoster"("employeeId", "rosterDate");

-- CreateIndex
CREATE INDEX "AttendancePunch_employeeId_punchTime_idx" ON "AttendancePunch"("employeeId", "punchTime");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_employeeId_date_key" ON "DailyAttendance"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_companyId_code_key" ON "LeavePolicy"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLeaveBalance_employeeId_leavePolicyId_calendarYear_key" ON "EmployeeLeaveBalance"("employeeId", "leavePolicyId", "calendarYear");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_month_year_key" ON "PayrollPeriod"("companyId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "CorporatePayrollRun_runNumber_key" ON "CorporatePayrollRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CorporatePayrollSlip_payrollRunId_employeeId_key" ON "CorporatePayrollSlip"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayslipDispatchRecord_payrollRunId_status_idx" ON "PayslipDispatchRecord"("payrollRunId", "status");

-- CreateIndex
CREATE INDEX "PayslipDispatchRecord_payrollSlipId_idx" ON "PayslipDispatchRecord"("payrollSlipId");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipDispatchRecord_payrollRunId_employeeId_key" ON "PayslipDispatchRecord"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StatutoryConfig_companyId_key" ON "StatutoryConfig"("companyId");

-- CreateIndex
CREATE INDEX "ProfessionalTaxSlab_state_idx" ON "ProfessionalTaxSlab"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_companyId_code_key" ON "ExpenseCategory"("companyId", "code");

-- CreateIndex
CREATE INDEX "ExpenseClaim_claimNumber_idx" ON "ExpenseClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "ExpenseClaim_employeeId_status_idx" ON "ExpenseClaim"("employeeId", "status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_claimType_idx" ON "ExpenseClaim"("claimType");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAllocation_projectId_employeeId_key" ON "ProjectAllocation"("projectId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_employeeId_cycleId_key" ON "PerformanceReview"("employeeId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCourse_companyId_code_key" ON "TrainingCourse"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingNomination_courseId_employeeId_key" ON "TrainingNomination"("courseId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanType_companyId_code_key" ON "LoanType"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAsset_assetTag_key" ON "CompanyAsset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "HelpDeskCategory_companyId_name_key" ON "HelpDeskCategory"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HelpDeskTicket_ticketNumber_key" ON "HelpDeskTicket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Resignation_employeeId_key" ON "Resignation"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "FnfSettlement_employeeId_key" ON "FnfSettlement"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "FnfSettlement_resignationId_key" ON "FnfSettlement"("resignationId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorPass_passNumber_key" ON "VisitorPass"("passNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_companyId_module_fieldKey_key" ON "CustomFieldDefinition"("companyId", "module", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCustomFieldValue_employeeId_fieldDefinitionId_key" ON "EmployeeCustomFieldValue"("employeeId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_isRead_idx" ON "InAppNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "InAppNotification_companyId_type_idx" ON "InAppNotification"("companyId", "type");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBand" ADD CONSTRAINT "JobBand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobBandId_fkey" FOREIGN KEY ("jobBandId") REFERENCES "JobBand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentTimeline" ADD CONSTRAINT "EmploymentTimeline_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTask" ADD CONSTRAINT "EmployeeOnboardingTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTemplate" ADD CONSTRAINT "SalaryTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTemplateLine" ADD CONSTRAINT "SalaryTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SalaryTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTemplateLine" ADD CONSTRAINT "SalaryTemplateLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryStructure" ADD CONSTRAINT "EmployeeSalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryStructure" ADD CONSTRAINT "EmployeeSalaryStructure_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SalaryTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryLine" ADD CONSTRAINT "EmployeeSalaryLine_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "EmployeeSalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryLine" ADD CONSTRAINT "EmployeeSalaryLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryRevision" ADD CONSTRAINT "EmployeeSalaryRevision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollPolicy" ADD CONSTRAINT "EmployeePayrollPolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPolicy" ADD CONSTRAINT "ShiftPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRoster" ADD CONSTRAINT "ShiftRoster_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRoster" ADD CONSTRAINT "ShiftRoster_shiftPolicyId_fkey" FOREIGN KEY ("shiftPolicyId") REFERENCES "ShiftPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_shiftPolicyId_fkey" FOREIGN KEY ("shiftPolicyId") REFERENCES "ShiftPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegularization" ADD CONSTRAINT "AttendanceRegularization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollRun" ADD CONSTRAINT "CorporatePayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollRun" ADD CONSTRAINT "CorporatePayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollSlip" ADD CONSTRAINT "CorporatePayrollSlip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "CorporatePayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollSlip" ADD CONSTRAINT "CorporatePayrollSlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollItem" ADD CONSTRAINT "CorporatePayrollItem_payrollSlipId_fkey" FOREIGN KEY ("payrollSlipId") REFERENCES "CorporatePayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePayrollTransition" ADD CONSTRAINT "CorporatePayrollTransition_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "CorporatePayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipDispatchRecord" ADD CONSTRAINT "PayslipDispatchRecord_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "CorporatePayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipDispatchRecord" ADD CONSTRAINT "PayslipDispatchRecord_payrollSlipId_fkey" FOREIGN KEY ("payrollSlipId") REFERENCES "CorporatePayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryConfig" ADD CONSTRAINT "StatutoryConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTaxDeclaration" ADD CONSTRAINT "EmployeeTaxDeclaration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseClaimId_fkey" FOREIGN KEY ("expenseClaimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeGoal" ADD CONSTRAINT "EmployeeGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeGoal" ADD CONSTRAINT "EmployeeGoal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNomination" ADD CONSTRAINT "TrainingNomination_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingNomination" ADD CONSTRAINT "TrainingNomination_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanType" ADD CONSTRAINT "LoanType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "EmployeeLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAllocation" ADD CONSTRAINT "AssetAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpDeskCategory" ADD CONSTRAINT "HelpDeskCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpDeskTicket" ADD CONSTRAINT "HelpDeskTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpDeskTicket" ADD CONSTRAINT "HelpDeskTicket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HelpDeskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpDeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resignation" ADD CONSTRAINT "Resignation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FnfSettlement" ADD CONSTRAINT "FnfSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FnfSettlement" ADD CONSTRAINT "FnfSettlement_resignationId_fkey" FOREIGN KEY ("resignationId") REFERENCES "Resignation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorPass" ADD CONSTRAINT "VisitorPass_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


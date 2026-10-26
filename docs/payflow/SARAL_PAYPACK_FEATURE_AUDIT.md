# PayFlow HRMS & Payroll ERP — Reference Feature Audit & Implementation Blueprint

**Document ID:** `SARAL_PAYPACK_FEATURE_AUDIT`  
**Date:** October 22, 2026  
**Auditor:** Antigravity AI Engineering  
**Application Target:** PayFlow HRMS & Payroll ERP (`http://localhost:5173` & `http://localhost:4000`)  
**Reference Video:** `saral demo.mp4`

---

## 1. Executive Summary & Codebase Audit

PayFlow HRMS & Payroll ERP was audited against the complete set of features identified in the Saral PayPack demonstration video.

PayFlow already possesses an enterprise-grade backend architecture:
- **Prisma ORM & PostgreSQL** with strict tenant isolation, multi-tenant schemas, and immutable audit logs.
- **Pure Decimal Calculation Engine** (`calculationEngine.ts`) with Indian statutory compliance (EPF, ESIC, Professional Tax slabs, Gratuity, Loan Recoveries, and Old vs New Tax Regime TDS).
- **7-Stage Corporate Payroll Workflow** (`corporatePayroll.routes.ts`: `DRAFT` → `VALIDATED` → `CALCULATED` → `REVIEWED` → `APPROVED` → `PAYMENT_READY` → `PAID`).
- **Payslip PDF Generator** (`pdfGenerator.ts` via PDFKit) and multi-provider Email Dispatcher (`emailService.ts`).

However, four key operational workflows observed in Saral PayPack were either partially missing or disconnected from the frontend:
1. **New Month Creation Dialog & Period Roll-Forward:** Lack of an explicit creation endpoint (`POST /payroll/periods`) and modal allowing administrators to initialize a new calendar month (e.g., February 2026, March 2026) with duplicate protection and leave tracking setup.
2. **Monthly Attendance Matrix:** Lack of an aggregated monthly view (`GET /attendance/monthly-matrix`) summarizing Working Days, Present Days, Overtime (OT), Loss of Pay (LOP), and Paid Leaves (CL, SL, PL) to calculate Payable Days before running payroll.
3. **Monthly Salary Editor:** Lack of an interactive spreadsheet view in `PayrollProcessingView` allowing payroll officers to review employee component breakdowns, adjust variables (Overtime earnings, Incentives, Bonus, Manual LOP), and enforce the Saral PayPack statutory rule: *"Flag Net Take-Home less than 25% of Gross Earnings"*.
4. **TDS Process & "Post Computed TDS to Salary":** While the calculation engine projects annual tax, the system lacked a dedicated TDS workbench allowing administrators to inspect tax computations across all employees and execute the Saral PayPack one-click action: *"Post computed TDS to salary"*.

---

## 2. Implementation Blueprint

### 2.1 Feature A: New Month Creation (`POST /payroll/periods`)
* **Backend Implementation:**
  * Add `POST /payroll/periods` in `corporatePayroll.routes.ts`.
  * Validate inputs: `name` (e.g. "January 2026"), `year` (2026), `month` (1), `startDate`, `endDate`.
  * Enforce uniqueness: Check `companyId_year_month` or existing period name in the same company.
  * Initialize the period and immediately make it available for Drafting.
* **Frontend Implementation:**
  * Add `"Create New Month"` button and modal in `PayrollProcessingView.tsx`.
  * Allows selecting Year, Month, auto-populates start/end dates and period number.
  * Automatically refreshes periods dropdown and selects the newly created month.

### 2.2 Feature B: Monthly Attendance Details Matrix (`GET /attendance/monthly-matrix`)
* **Backend Implementation:**
  * Add `GET /attendance/monthly-matrix` in `attendance.routes.ts`.
  * Accepts `periodId` or `month` and `year`.
  * Aggregates active employees, daily attendance records (`PRESENT`, `HALF_DAY`, `ABSENT`), approved leave requests (`isPaid: true` vs `isPaid: false`), and computes:
    * `calendarDays`
    * `workingDays`
    * `presentDays`
    * `overtimeHours`
    * `lopDays`
    * `paidLeaves`
    * `payableDays` = `calendarDays - lopDays` (or `presentDays + paidLeaves`)
* **Frontend Implementation:**
  * Add a tab in `AttendanceView.tsx` or a drill-down in `PayrollProcessingView.tsx` titled **"Monthly Attendance Matrix"**.
  * Renders a spreadsheet table matching Saral PayPack: Emp ID, Name, Calendar Days, Present Days, OT, LOP, CL, SL, PL, and Payable Days.

### 2.3 Feature C: Monthly Salary Editor & Adjustments
* **Backend Implementation:**
  * Add `GET /payroll/runs/:id/editor` in `corporatePayroll.routes.ts` returning all employee slips with component items.
  * Add `PATCH /payroll/runs/:id/adjustments` allowing authorized payroll admins to update specific one-time adjustments for an employee slip (e.g., overtime earnings, incentive amount, bonus, or manual LOP) with automatic recalculation of Gross, Deductions, and Net Pay.
* **Frontend Implementation:**
  * Add **"Salary Editor"** tab inside `PayrollProcessingView.tsx`.
  * Display spreadsheet view with inline editing for authorized variables.
  * Implement the Saral PayPack compliance safeguard: **Highlight in blue/badge any employee whose Net Pay is less than 25% of Gross Pay**.

### 2.4 Feature D: TDS Process & Porting to Active Payroll
* **Backend Implementation:**
  * Add `GET /payroll/tds/summary?periodId=` in `corporatePayroll.routes.ts`.
  * Iterates across active employees, retrieves their tax declarations (80C, 80D, 24b) and regime (Old vs New), projects annual gross earnings, applies standard deduction (₹75,000 for New Regime), evaluates progressive tax slabs, adds 4% Health & Education Cess, and divides by 12 to determine the monthly installment.
  * Add `POST /payroll/tds/port-to-salary`: Posts the calculated monthly TDS into the employee's active draft/calculated payroll slip under deduction code `TDS`.
* **Frontend Implementation:**
  * Add **"TDS Process & Tax Assessment"** tab inside `PayrollProcessingView.tsx`.
  * Displays employee tax grid with button **"Post Computed TDS to Salary"**.

---

## 3. Database & Payroll Safety Constraints
- **Zero Destructive Actions:** No existing tables, employees, runs, or finalized payslips will be deleted or reset.
- **Tenant Isolation:** All newly introduced queries and endpoints strictly filter on `req.user!.companyId`.
- **Role-Based Access Control:**
  * New Month Creation: `company_admin`, `payroll_admin`.
  * Monthly Salary Editor: `company_admin`, `payroll_admin`, `payroll_processor`.
  * TDS Porting: `company_admin`, `payroll_admin`, `finance_admin`.

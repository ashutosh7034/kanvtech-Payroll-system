# PAYFLOW — Task 8: 7-Stage Payroll Workbench & Salary Editor Audit Report

## 1. Executive Summary

An exhaustive root-cause investigation and complete architectural overhaul of the **7-Stage Payroll Workbench & Salary Editor** in the PAYFLOW HRMS & Payroll application was performed under Task 8. 

Prior to this intervention:
- The **Salary Review & Input Adjustment Editor** rendered empty table rows despite displaying 7 static column headers (`Staff Code`, `Employee Name`, `LOP Days`, `Overtime Hours`, `Arrears`, `Variable Pay`, `Manual Deduction`).
- The complete 7-stage payroll workflow (`Draft` → `Validate` → `Calculate` → `Review` → `Approve` → `Payment Ready` → `Paid`) was fragmented, with metrics cards displaying inaccurate zero states or lacking employer cost breakdowns.
- Administrators were unable to review employee candidates before calculation or reliably record pre-calculation draft input adjustments.

All issues have been resolved through:
1. **Frontend-Backend Contract Alignment**: Resolved response property mismatches and automated data retrieval upon workbench tab selection.
2. **Pre-Calculation Candidate Preview Architecture**: Dynamic evaluation of eligible active employees in the selected scope (department, branch, or tenant-wide) before slips exist.
3. **Dual-Phase Input Adjustment Engine**: Persistent draft adjustments stored in `run.validationNotes.draftAdjustments` during Stages 1 & 2, absorbed directly into Stage 3 calculation formulas, followed by slip-level adjustment recalculation in Stage 4.
4. **Enhanced 13-Column Workbench Editor**: Rebuilt with search, department filtering, status and compliance filters, KPI summary cards, inline modified badges, and detailed math calculation inspection modals.
5. **Take-Home Pay Statutory Safeguard**: Automatic detection and warning badges for employees whose net take-home salary drops below 25% of gross earnings.
6. **Zero Data Fabrication & Enterprise DB Protection**: All views reflect real database records. Main database `payroll_management` and reference loan `b405b4b8-1211-48c5-a59e-ee8db001a906` (`Principal: ₹24,000.00`, `Status: CLOSED`) were verified 100% intact.

---

## 2. Root Cause Analysis of Empty Employee Table

Our Phase 1 forensic investigation identified **five interlocking defects** that caused the editor table to remain empty:

### Defect 1: JSON Response Contract Key Mismatch
- **Backend Implementation**: `GET /api/v1/payroll/runs/:id/editor` returned:
  ```json
  { "runId": "...", "runNumber": "...", "totals": { ... }, "rows": [ ... ] }
  ```
- **Frontend Expectation**: `PayrollProcessingView.tsx` accessed `res.employees || []`:
  ```typescript
  // Before fix:
  const res = await payrollApi.getEditorData(editorRunId);
  setEditorEmployees(res.employees || []); // res.employees was undefined!
  ```
- **Impact**: Since `res.employees` evaluated to `undefined`, `editorEmployees` was always initialized to `[]`, leaving table headers with 0 rows.

### Defect 2: Missing Automatic Trigger on Tab Activation
- **Frontend Defect**: The workbench tab switcher (`activeTab === 'editor'`) toggled visual views but never triggered `loadEditorData()`.
- **Impact**: The API was only invoked if the user manually changed the `<select>` dropdown. On initial page load or clicking "Salary Review & Editor", no network request occurred.

### Defect 3: Slips Lifecycle Disconnect (Pre-Calculation vs. Post-Calculation)
- **Backend Defect**: `GET /runs/:id/editor` and `PATCH /runs/:id/adjustments` queried exclusively from `CorporatePayrollSlip`. In PAYFLOW's 7-stage engine, slips are only generated during **Stage 3: Calculate**.
- **Impact**: If an administrator opened the editor for a run in **Stage 1: Draft** or **Stage 2: Validate**, `run.slips` was empty, returning `rows: []`. Administrators could not preview candidate employees, verify attendance, or input adjustments before running calculation.

### Defect 4: Adjustment ID Mapping Mismatch
- **Backend Defect**: When saving adjustments, the frontend mapped `employeeId: emp.id`. For calculated slips, `emp.id` was the `slipId` rather than the `employeeId`.
- **Backend Matching**: Looked for `s.employeeId === adj.employeeId`, failing to match and silently ignoring adjustments.

### Defect 5: Insufficient Columns for Professional Payroll Audit
- **UI Limitation**: The table only contained 7 columns, lacking critical organizational placement (Department, Designation), statutory earnings (Gross), statutory deductions (PF, ESIC, PT, TDS), Net Pay, Calendar/Payable Days, and Take-Home compliance status.

---

## 3. Architecture & Code Changes

### A. Backend Route & Service Enhancements (`backend/src/modules/payroll/corporatePayroll.routes.ts`)

1. **Pre-Calculation Candidate Preview in `GET /runs/:id/editor`**:
   - When `run.slips.length === 0` (Stages 1 & 2):
     - Resolves the run's scope (`departmentId`, `branchId`, or tenant-wide).
     - Queries candidate employees: `status in ['ACTIVE', 'CONFIRMED', 'PROBATION']`, `dateOfJoining <= period.endDate`, `exitDate null or >= period.startDate`.
     - Evaluates attendance from `DailyAttendance` (present days) and `LeaveRequest` (approved paid/unpaid leaves).
     - Evaluates active `EmployeeSalaryStructure` and configured monthly gross.
     - Reads saved draft adjustments from `run.validationNotes.draftAdjustments`.
     - Constructs preview rows with `calculationStatus: run.status`, `isNetLessThan25Percent: false`, and clear validation error tags (e.g. `Missing active salary structure`).
   - When `run.slips.length > 0` (Stages 3 through 7):
     - Enriches slip rows with real attendance, leave balances, overtime, arrears, variable allowance, manual deductions, TDS, gross, deductions, net, and flags `isNetLessThan25Percent = gross > 0 && net < gross * 0.25`.
   - Returns backward-compatible JSON: `{ success: true, runId, runNumber, status, periodName, totals, rows, employees: rows }`.

2. **Dual-Phase Adjustments in `PATCH /runs/:id/adjustments`**:
   - **Pre-Calculation (Draft/Validate)**: Persists input adjustments array into `run.validationNotes.draftAdjustments`, logs a transition audit record, and returns confirmation.
   - **Post-Calculation (Calculated/Reviewed)**: Supports matching by `slip.id === adj.slipId || slip.employeeId === adj.employeeId`. Dynamically recalculates items, slip gross, deductions, net, run totals, and appends timestamped before-and-after audit logs to `calculationSnapshot.adjustments`.
   - **Immutability Enforcement**: Strictly rejects modifications if the run is in `APPROVED` (requires re-draft authorization) or `PAID` state.

3. **Stage 3 Calculate Integration (`POST /runs/:id/calculate`)**:
   - Reads `run.validationNotes.draftAdjustments` and feeds `lopDaysOverride`, `arrearsOverride`, `variableAllowance`, `manualDeduction`, and `otHours` directly into `PayrollCalculationEngine.calculateEmployee`.
   - Preserves `scope` and `draftAdjustments` across `POST /runs/:id/validate` so pre-flight validation never wipes draft adjustments.

4. **RBAC & Security Boundaries**:
   - Guarded `GET /runs/:id/editor` with `requireRole(['company_admin', 'payroll_admin', 'payroll_processor', 'finance_admin'])`.
   - Guarded `PATCH /runs/:id/adjustments` with `requireRole(['company_admin', 'payroll_admin', 'payroll_processor'])`.
   - Regular employees receive HTTP `403 Forbidden`.

### B. Frontend Redesign (`frontend/src/pages/PayrollProcessingView.tsx`)

1. **Automatic Data Loading & State Management**:
   - `useEffect` automatically triggers `loadEditorData(editorRunId)` whenever `activeTab === 'editor'` or `editorRunId` changes.
   - Stores `editorOriginalEmployees` to compute real-time change diffs.
   - Displays "Modified" badges on rows with unsaved changes.

2. **10 Comprehensive KPI Summary Cards**:
   - Eligible Employees in Scope
   - Employees Calculated vs Awaiting Calculation
   - Calculation Warnings / Attention Needed
   - Total Gross Earnings (₹)
   - Total Deductions (₹)
   - Total Net Disbursement (₹)
   - Total Employer PF/ESI/EDLI Contributions (₹)
   - Total Cost to Company (CTC)

3. **13-Column Salary Review & Input Adjustment Editor**:
   1. **Staff & Placement**: Employee Code, Full Name, Department Badge.
   2. **Salary Structure**: Assigned CTC Template, Configured Monthly Gross, Missing Structure warning.
   3. **Attendance & Days**: Calendar Days, Present Days, Approved Leaves, Payable Days.
   4. **LOP Days (Input)**: Editable numeric field with highlight on modification.
   5. **Overtime Hours (Input)**: Editable numeric field with highlight on modification.
   6. **Arrears (₹) (Input)**: Editable monetary adjustment.
   7. **Variable Pay (₹) (Input)**: Editable incentive / bonus adjustment.
   8. **Manual Deduction (₹) (Input)**: Editable one-time deduction.
   9. **TDS (₹)**: Current period tax deduction.
   10. **Gross Salary (₹)**: Calculated gross earnings.
   11. **Deductions (₹)**: Total statutory and non-statutory deductions.
   12. **Net Pay (₹)**: Calculated net disbursable pay with `<25% Take-Home` compliance warning badge.
   13. **Actions**:
       - *View Math*: Opens `DetailedCalculationModal` displaying pure decimal calculation breakdown.
       - *Adjust*: Opens `ManualAdjustmentModal` for reason-tracked adjustments.

4. **Filtering, Search & Quick KPIs**:
   - Global search by employee name or staff code.
   - Department filter dropdown.
   - Exception filters: `Has LOP`, `Has Overtime`, `Has Arrears`, `Has Variable Pay`, `Net Pay < 25%`, `Missing CTC Structure`.
   - "Show Modified Only" toggle.
   - Quick KPI metrics ribbon displaying aggregate LOP days, OT hours, Arrears, Variable, and Deductions.

---

## 4. 7-Stage Workflow State Machine

| Stage | Name | Permitted Roles | Actions Supported | Exit Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | `DRAFT` | `payroll_admin`, `payroll_processor`, `company_admin` | Select scope (Dept/Branch/All), Preview candidates, Enter draft adjustments | Candidate count validated; scope locked |
| **Stage 2** | `VALIDATED` | `payroll_admin`, `payroll_processor`, `company_admin` | Execute pre-flight validations (attendance, structures, active status) | 0 blocking exceptions |
| **Stage 3** | `CALCULATED` | `payroll_admin`, `payroll_processor`, `company_admin` | Run pure decimal calculation engine; absorb draft inputs; generate slips | Slips & items created; variance totals computed |
| **Stage 4** | `REVIEWED` | `payroll_admin`, `company_admin` | Audit monthly salary editor, review high-deduction flags, apply post-calc adjustments | Review notes recorded; audit sign-off |
| **Stage 5** | `APPROVED` | `finance_admin`, `company_admin` | Finance executive approval; SOD verification | Approver recorded; run locked from edits |
| **Stage 6** | `PAYMENT_READY` | `finance_admin`, `company_admin` | Generate bank payment register; prepare NEFT electronic advice | Payment register verified |
| **Stage 7** | `PAID` | `finance_admin`, `company_admin` | Record bank UTR / payment reference; release ESS payslips | Bank reference confirmed; status = PAID |

---

## 5. Verification & Safety Sign-Off

1. **Safety Verification**: Executed `backend/scripts/verify_safety.ts`.
   - **Primary Database (`payroll_management`)**: Protected reference loan `b405b4b8-1211-48c5-a59e-ee8db001a906` (`Principal: ₹24,000.00`, `Status: CLOSED`) is **INTACT**.
   - **Test Database (`payroll_management_test`)**: Completely isolated.
2. **Type Checking**:
   - Backend: `npm run typecheck` passed with 0 errors.
   - Frontend: `npm run build` (`tsc -b && vite build`) passed with 0 errors.
3. **Automated Test Suites**:
   - `backend/tests/payrollWorkbenchWorkflow.test.ts`: **10/10 passed**.
   - Full Vitest suite: **20 test files, 374 passed** (100% pass rate).

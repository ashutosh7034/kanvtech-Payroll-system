# PayFlow HRMS & Payroll ERP — Attendance Matrix & Salary Editor Report

## 1. Overview
In Saral PayPack, monthly salary computation depends on two interrelated operational modules:
1. **Attendance Details / Monthly Ledger**: Tracking total calendar days, present days, paid leaves, loss of pay (LOP) days, and overtime to determine payable days.
2. **Monthly Salary Editor**: Providing an interactive spreadsheet interface for adjusting variable allowances, overtime, arrears, and LOP days with statutory take-home safeguards.

This report documents PayFlow's implementation and verified parity with these reference capabilities.

---

## 2. Monthly Attendance Matrix Implementation

### 2.1 API Endpoint & Schema
- **Route**: `GET /api/v1/attendance/monthly-matrix`
- **Query Parameters**: `month` (1–12), `year` (YYYY)
- **Controller Logic**:
  * Resolves organization boundary (`req.user.companyId`).
  * Fetches all active employees in the company.
  * Queries `DailyAttendance` records within the target month range.
  * Queries approved `LeaveRequest` records for the period.
  * Computes:
    - `calendarDays`: Number of calendar days in month (e.g. 31 in October).
    - `presentDays`: Days with valid check-in / check-out punches or `PRESENT` status.
    - `absentDays`: Days with unexcused absence (`ABSENT` status).
    - `paidLeaves`: Total days of approved Casual Leave (CL), Sick Leave (SL), and Privilege/Earned Leave (PL/EL).
    - `lopDays`: Total days with `UNPAID` leave or unauthorized absence.
    - `overtimeHours`: Total hours worked exceeding regular daily shifts.
    - `payableDays`: $\max(0, \text{calendarDays} - \text{lopDays})$.

### 2.2 User Interface & CSV Export
- Located in `AttendanceView.tsx` under the tab **"Monthly Attendance Matrix (Saral Ledger)"**.
- Provides instant month/year selection dropdowns.
- Includes one-click **"Export CSV"** generating `PayFlow_Attendance_Matrix_MM_YYYY.csv` with full audit fields.

---

## 3. Monthly Salary Editor Implementation

### 3.1 Architecture & Endpoints
- **Read Endpoint**: `GET /api/v1/payroll/runs/:id/editor`
- **Write Endpoint**: `PATCH /api/v1/payroll/runs/:id/adjustments`
- **Supported Fields**:
  * `payableDays`: Recalculated from LOP override.
  * `lopDays`: Loss of Pay days adjustment.
  * `variablePay`: Ad-hoc performance or project bonuses.
  * `arrears`: Prior-period salary reconciliations.
  * `isNetLessThan25Percent`: Automated compliance indicator.

### 3.2 Statutory Take-Home Safeguard (Saral Parity)
In Saral PayPack, a dedicated configuration option states:
> *"Show Net less than 25% of Gross in [Blue]"*

This safeguard prevents unlawful excessive deductions that violate statutory wage protection guidelines (such as the Payment of Wages Act, where total authorized deductions must not exceed specified thresholds).

**PayFlow Enforcement**:
1. The backend evaluates:
   ```ts
   const isNetLessThan25Percent = gross > 0 && net < (gross * 0.25);
   ```
2. The UI renders a prominent **Blue Tag** (`Net < 25% Gross`) with a tooltip explanation:
   > *"Saral PayPack Statutory Safeguard: Net pay is under 25% of gross earnings!"*
3. The payroll officer can review or adjust deductions prior to submitting the run to verification.

### 3.3 Salary Sheet / Register Export
- Users can export the entire monthly salary register directly to CSV via the **"Export Salary Sheet CSV"** button in `PayrollProcessingView.tsx`.
- Columns include: Employee Code, Name, Department, Designation, Payable Days, LOP Days, Basic Pay, HRA, Variable Pay, Arrears, Gross Pay, TDS, Total Deductions, Net Pay, and Take-Home Safeguard flag.

---

## 4. Verification & Testing
- Automated test coverage in `backend/tests/saralPayPackParity.test.ts`:
  * `GET /attendance/monthly-matrix`: Validates accurate ledger aggregation across present, leave, LOP, and payable days.
  * `GET /payroll/runs/:id/editor`: Validates structure, earnings, deductions, and net-take-home calculation.
  * `PATCH /payroll/runs/:id/adjustments`: Validates atomic updates to variable pay, arrears, and LOP days with automated net recalculation.
  * All tests passed with 100% pass rate.

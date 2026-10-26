# PAYFLOW — User Acceptance Testing (UAT) Master Plan

**Document Reference**: `docs/PAYFLOW_UAT_PLAN.md`  
**Execution Timestamp**: `2026-10-26T12:16:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Auditor**: QA Lead & Principal Payroll Product Architect  
**Status**: `READY FOR EXECUTION`

---

## 1. Objectives & Scope

This User Acceptance Testing (UAT) Plan defines the formal validation procedures for end-to-end payroll operations in PAYFLOW. The goal is to verify that all functional workflows derived from Spine HRNG and Saral PayPack operate accurately, securely, and seamlessly for corporate users.

### Key Validation Principles:
1. **Mathematical Exactness**: Monies calculated with `Decimal.js` to two decimal places; zero floating-point rounding errors.
2. **Segregation of Duties (SOD)**: Makers cannot approve their own payroll batches, salary revisions, or expense claims.
3. **Immutability of Finalized Runs**: Once marked `PAID`, payroll batches and payslips cannot be altered or recalculated.
4. **Tenant Isolation**: Users cannot view or modify data belonging to another tenant company.
5. **Dynamic UI Masking**: Unauthorized buttons, tabs, and fields are hidden from unauthorized users.

---

## 2. Test Personas & User Roles

| Persona ID | Role Name | System Role | Primary Responsibilities |
|:---|:---|:---|:---|
| **PER-01** | **Employee** | `employee` | Submit expense claims, view own payslips, apply for leave, submit tax declarations. |
| **PER-02** | **HR Specialist** | `hr_manager` | Manage employee directory, configure salary structures, draft monthly payroll runs. |
| **PER-03** | **Finance Lead** | `finance_lead` | Review payroll calculations, approve batches (Checker), generate bank advice. |
| **PER-04** | **Payroll Admin** | `company_admin` | Configure pay codes, configure RBAC permissions, record bank UTR payments. |
| **PER-05** | **Statutory Auditor**| `auditor` | Read-only access to audit registers, tax sheets, and reconciliation reports. |

---

## 3. Comprehensive UAT Test Scenarios

### Scenario 1: Salary Component & Formula Builder
- **Persona**: Payroll Admin (`company_admin`)
- **Preconditions**: Logged into Admin console, navigating to [`ColumnMasterView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ColumnMasterView.tsx).
- **Steps**:
  1. Click "Add Component".
  2. Enter Component Code: `HRA`, Name: `House Rent Allowance`, Type: `EARNING`.
  3. Set Calculation Type to `FORMULA` and enter formula: `BASIC * 0.50`.
  4. Click "Validate Formula".
  5. Save Component.
- **Expected Results**:
  - AST Formula Parser verifies syntax and returns green checkmark.
  - Component persists in `SalaryComponent` database table.
  - Circular formulas (e.g. `BASIC = HRA * 2` where `HRA = BASIC * 0.50`) are rejected with clear error message.

---

### Scenario 2: Monthly Salary Editor (Saral Dual-Mode Usability)
- **Persona**: HR Specialist (`hr_manager`)
- **Preconditions**: A monthly payroll run is initialized in `VALIDATED` or `CALCULATED` status.
- **Steps**:
  1. Open [`MonthlySalaryEditorModal.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/components/MonthlySalaryEditorModal.tsx).
  2. Switch to **Entry Mode**: Select an employee and update `Overtime Hours` to `10` and `Incentive` to `5000`.
  3. Switch to **Calculation Mode**: Observe the live calculation card on the right-hand split screen.
  4. Enter an excessive deduction that reduces take-home pay below 25% of gross.
- **Expected Results**:
  - Live preview updates Gross Earnings and Net Pay instantly without saving corrupt records.
  - Minimum take-home warning banner displays: *"Warning: Take-home pay is less than 25% of gross earnings"*.
  - Clicking "Save Adjustments" successfully commits changes and recalculates active payroll slip.

---

### Scenario 3: TDS Tax Studio & Automated Porting
- **Persona**: HR Specialist / Finance Lead
- **Preconditions**: Active payroll run in `CALCULATED` status; employee with tax declarations.
- **Steps**:
  1. Open [`TdsTaxStudioModal.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/components/TdsTaxStudioModal.tsx).
  2. Select an employee and view side-by-side Old Regime vs New Regime (Section 115BAC) tax projection.
  3. Test an employee without a valid PAN card recorded.
  4. Click "Port Computed TDS to Salary".
- **Expected Results**:
  - Employee without PAN automatically incurs 20% flat penalty deduction under Section 206AA.
  - Monthly TDS deduction ports seamlessly into the active payroll batch under component `TDS`.
  - Net Pay updates immediately with exact decimal accuracy.

---

### Scenario 4: 7-Stage Payroll Engine & Segregation of Duties (SOD)
- **Persona**: HR Specialist (Maker) & Finance Lead (Checker)
- **Preconditions**: Test period initialized in `DRAFT`.
- **Steps**:
  1. **HR Specialist** clicks "Validate Inputs" (transitions to `VALIDATED`).
  2. **HR Specialist** clicks "Calculate Payroll" (transitions to `CALCULATED`).
  3. **HR Specialist** clicks "Submit for Review" (transitions to `REVIEWED`).
  4. **HR Specialist** attempts to click "Approve Payroll".
  5. Log out and log in as **Finance Lead**.
  6. **Finance Lead** reviews variance report and clicks "Approve Payroll".
  7. **Finance Lead** clicks "Prepare Bank Advice" (transitions to `PAYMENT_READY`).
  8. Log in as **Payroll Admin** and record bank UTR number `HDFC9876543210` (transitions to `PAID`).
  9. Attempt to recalculate the paid batch.
- **Expected Results**:
  - Step 4 fails with error: *"Segregation of Duties: Maker cannot approve their own payroll run"*.
  - Step 6 succeeds; batch transitions to `APPROVED`.
  - Step 8 transitions batch to `PAID` and locks all records.
  - Step 9 is strictly blocked: *"Cannot modify a finalized/paid payroll run"*.

---

### Scenario 5: Electronic Bank Advice (NEFT/RTGS) Export
- **Persona**: Finance Lead (`finance_lead`)
- **Preconditions**: Batch in `PAYMENT_READY` status.
- **Steps**:
  1. Navigate to [`ReportsView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ReportsView.tsx).
  2. Select active period and click "Download Bank Advice CSV".
  3. Open exported CSV and verify headers and values.
- **Expected Results**:
  - CSV contains: Beneficiary Name, Account Number, IFSC Code, Net Pay Amount, Remarks.
  - Sum of CSV amounts equals exactly the Total Net Pay of the batch.
  - Employees with missing bank accounts are flagged prior to export.

---

### Scenario 6: Expenses & Reimbursements Segregated Workflow
- **Persona**: Employee (`employee`) & HR Manager (`hr_manager`)
- **Preconditions**: Employee has active session.
- **Steps**:
  1. Employee navigates to [`ExpensesView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ExpensesView.tsx).
  2. Click "Submit Reimbursement". Enter Category: `Travel`, Amount: `1500`, attach receipt image.
  3. Submit claim.
  4. Log in as HR Manager and view consolidated claims table.
  5. Reject claim with reason: *"Please provide GST invoice"*.
  6. Employee logs in, views rejection justification, updates receipt, and resubmits.
  7. HR Manager reviews and clicks "Approve".
- **Expected Results**:
  - Receipt stored securely as base64 asset.
  - In-app notification received by HR Manager upon submission and Employee upon rejection/approval.
  - Segregation of Duties: Employee cannot approve their own claim.

---

### Scenario 7: Dynamic RBAC UI Visibility & Security Verification
- **Persona**: Regular Employee (`employee`)
- **Preconditions**: Logged in with employee credentials.
- **Steps**:
  1. Observe navigation sidebar.
  2. Inspect DOM for hidden administrative elements.
  3. Attempt direct API request: `PATCH /api/v1/rbac/roles/admin/permissions`.
- **Expected Results**:
  - Administrative items (Payroll Processing, Column Master, RBAC Permissions) are completely omitted from sidebar.
  - No access-denied flash or broken buttons in the UI.
  - Direct API request rejected with HTTP 403 Forbidden.

---

## 4. Acceptance Signoff Criteria

A capability is certified as **UAT PASSED** only when:
- 100% of defined scenarios execute without unhandled exceptions or error popups.
- Financial figures match exact spreadsheet reconciliation.
- Audit trail correctly logs user IDs, timestamps, and previous values for all mutating operations.
- Test database isolation is preserved throughout test execution.

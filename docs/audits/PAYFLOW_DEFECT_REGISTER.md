# PAYFLOW — Authoritative Defect Register & Resolution Log

**Document Reference**: `docs/audits/PAYFLOW_DEFECT_REGISTER.md`  
**Execution Timestamp**: `2026-10-26T12:35:00+05:30`  
**Lead Auditor**: Senior QA Engineer & Application Security Tester  
**Status**: `ALL DEFECTS RESOLVED & VERIFIED`

---

## 1. Defect Summary Table

| Defect ID | Module | Severity | Classification | Status | Files Modified | Regression Test |
|:---:|:---|:---:|:---|:---:|:---|:---|
| **`DEF-01`** | Timesheets | **P1** | Security / IDOR | `RESOLVED` | `backend/src/modules/timesheets/timesheet.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 1) |
| **`DEF-02`** | Performance | **P1** | Security / Data Leakage | `RESOLVED` | `backend/src/modules/performance/performance.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 2) |
| **`DEF-03`** | Offboarding | **P1** | Security / Data Leakage | `RESOLVED` | `backend/src/modules/offboarding/offboarding.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 3) |
| **`DEF-04`** | Helpdesk | **P2** | Security / Access Boundary | `RESOLVED` | `backend/src/modules/helpdesk/helpdesk.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 4) |
| **`DEF-05`** | Attendance | **P2** | Security / Access Boundary | `RESOLVED` | `backend/src/modules/attendance/attendance.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 5) |
| **`DEF-06`** | Leave | **P1** | Security / IDOR | `RESOLVED` | `backend/src/modules/leave/leave.routes.ts` | `securityDefectsRegression.test.ts` (Scenario 6) |
| **`DEF-07`** | Self-Service | **P2** | Functional / Unlinked Admin Handling | `RESOLVED` | `backend/src/modules/self-service/corporateSelfService.routes.ts` | Graceful fallback on dashboard, slips, loans, declarations |
| **`DEF-08`** | Expenses & Payroll UI | **P2** | UI / Modal Rendering & Backdrop | `RESOLVED` | `frontend/src/styles.css`, `ExpensesView.tsx`, `PayrollProcessingView.tsx` | Visual verification & Vite production build |

---

## 2. Detailed Defect Investigations & Resolutions

### Defect `DEF-01`: Timesheets Insecure Direct Object Reference (IDOR)
- **Module**: Weekly Timesheets ([`timesheet.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/timesheets/timesheet.routes.ts))
- **Severity**: `P1 - High Security Risk`
- **Reproduction Steps**:
  1. Authenticate as regular employee Bob (`bob.user`, role: `employee`).
  2. Send HTTP request: `GET /api/v1/timesheets/entries?employeeId=<alice-uuid>`.
  3. Observe response.
- **Expected Result**: Backend rejects the request with HTTP 403 Forbidden because Bob does not have managerial oversight over Alice.
- **Actual Result**: Backend returned HTTP 200 OK containing all of Alice's logged projects, hours, and task descriptions.
- **Root Cause**: Line 26 used ternary fallback: `const employeeId = req.query.employeeId ? String(req.query.employeeId) : req.user!.employeeId;` without checking if the requesting user possessed a managerial or admin role.
- **Fix Description**: Validated that if `req.query.employeeId` is supplied and does not match `req.user!.employeeId`, the user must possess one of `['company_admin', 'hr_manager', 'department_manager', 'platform_admin']`. Otherwise, an `AppError('Access denied...', 403, 'FORBIDDEN')` is thrown.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Tests 1, 2, and 3).
- **Retest Outcome**: **PASS**. Non-managerial query returns 403; self query returns 200; manager query returns 200.

---

### Defect `DEF-02`: Performance Goals IDOR & Unassociated User Review Leakage
- **Module**: Performance Management ([`performance.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/performance/performance.routes.ts))
- **Severity**: `P1 - High Security Risk`
- **Reproduction Steps**:
  1. Authenticate as regular employee Bob. Send `GET /api/v1/performance/goals?employeeId=<alice-uuid>`.
  2. Authenticate as an unassociated user (e.g. external consultant with no employee record). Send `GET /api/v1/performance/reviews`.
- **Expected Result**: Step 1 returns 403 Forbidden. Step 2 returns an empty list (`reviews: []`).
- **Actual Result**: Step 1 returned Alice's confidential targets. Step 2 returned all performance reviews across the entire company because Prisma omitted the `where.employeeId` clause when `req.user!.employeeId` was `undefined`.
- **Root Cause**:
  1. `GET /goals` lacked role check on `req.query.employeeId`.
  2. In `GET /reviews`, when `!isManager`, `where.employeeId = req.user!.employeeId`. In Prisma, `where: { employeeId: undefined }` ignores the filter.
- **Fix Description**:
  1. Enforced manager check on `GET /goals` query parameter.
  2. Set safe fallback: `where.employeeId = req.user!.employeeId || 'unassigned'` in `GET /reviews`.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Tests 4, 5, 6, and 7).
- **Retest Outcome**: **PASS**. 403 enforced on peer snooping; unassociated users receive empty array with 0 leaks.

---

### Defect `DEF-03`: Offboarding Resignations Unassociated User Leakage
- **Module**: Offboarding & F&F ([`offboarding.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/offboarding/offboarding.routes.ts))
- **Severity**: `P1 - High Security Risk`
- **Reproduction Steps**:
  1. Authenticate as a user who has no linked employee profile (e.g. auditor or external advisor).
  2. Send HTTP request: `GET /api/v1/offboarding/resignations`.
- **Expected Result**: Request returns only records owned by the user (or empty list if unassociated).
- **Actual Result**: Request returned all company resignations, last working days, and full-and-final settlement calculations because `where.employeeId = undefined` was ignored by Prisma.
- **Root Cause**: `if (!isHr) { where.employeeId = req.user!.employeeId; }` produced `{ employeeId: undefined }`.
- **Fix Description**: Changed to: `where.employeeId = req.user!.employeeId || 'unassigned'`.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Test 8).
- **Retest Outcome**: **PASS**. Unassociated user receives `resignations: []` with 0 leakage.

---

### Defect `DEF-04`: Helpdesk Tickets Boundary Protection
- **Module**: Assets & Helpdesk ([`helpdesk.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/helpdesk/helpdesk.routes.ts))
- **Severity**: `P2 - Medium Security Risk`
- **Reproduction Steps**:
  1. Authenticate as an unlinked user with role `employee`.
  2. Send `GET /api/v1/helpdesk/tickets`.
- **Expected Result**: Return empty list of tickets.
- **Actual Result**: Returned all internal IT tickets across the company.
- **Root Cause**: Non-staff where clause set `where.employeeId = req.user!.employeeId`, which evaluated to `undefined`.
- **Fix Description**: Updated to: `where.employeeId = req.user!.employeeId || 'unassigned'`.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Test 9).
- **Retest Outcome**: **PASS**. Returns `tickets: []` with 0 leakage.

---

### Defect `DEF-05`: Attendance Regularizations Boundary Protection
- **Module**: Time & Attendance ([`attendance.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/attendance/attendance.routes.ts))
- **Severity**: `P2 - Medium Security Risk`
- **Reproduction Steps**:
  1. Authenticate as an unlinked user with role `employee`.
  2. Send `GET /api/v1/attendance/regularizations`.
- **Expected Result**: Return empty list.
- **Actual Result**: Returned all employee attendance regularizations in the tenant.
- **Root Cause**: `where.employeeId = req.user!.employeeId` evaluated to `undefined`.
- **Fix Description**: Updated to: `where.employeeId = req.user!.employeeId || 'unassigned'`.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Test 10).
- **Retest Outcome**: **PASS**. Returns `regularizations: []` with 0 leakage.

---

### Defect `DEF-06`: Leave Balances Cross-Employee IDOR
- **Module**: Leave Management ([`leave.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/leave/leave.routes.ts))
- **Severity**: `P1 - High Security Risk`
- **Reproduction Steps**:
  1. Authenticate as regular employee Bob (`bob.user`).
  2. Send `GET /api/v1/leave/balances?employeeId=<alice-uuid>`.
- **Expected Result**: Backend returns HTTP 403 Forbidden.
- **Actual Result**: Backend returned Alice's personal leave balances, privilege leave quota, and casual leave utilization.
- **Root Cause**: `const employeeId = req.query.employeeId ? String(req.query.employeeId) : req.user!.employeeId;` lacked authorization validation.
- **Fix Description**: Enforced manager/admin role check before querying `targetEmployeeId`. Returns 403 Forbidden for unauthorized requests.
- **Regression Test**: `tests/securityDefectsRegression.test.ts` (Tests 11, 12, 13, and 14).
- **Retest Outcome**: **PASS**. Non-manager querying another employee receives 403; querying self receives 200; manager receives 200.

---

### Defect `DEF-07`: Self-Service Unlinked Administrator Profile Handling
- **Module**: Corporate Self-Service ([`corporateSelfService.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/self-service/corporateSelfService.routes.ts))
- **Severity**: `P2 - Medium Ergonomic & Stability Risk`
- **Reproduction Steps**:
  1. Authenticate as administrative user `admin` (a user with no associated `employeeId` in database).
  2. Navigate to "My Profile" or call `GET /api/v1/self-service/dashboard` or `GET /api/v1/self-service/payslips`.
- **Expected Result**: Clean administrative profile rendered; empty slips and zero loans returned without crashing.
- **Actual Result**: Server threw `AppError('Employee record required', 400)` and logged unhandled errors.
- **Root Cause**: Endpoints threw 400 exceptions when `!req.user.employeeId` instead of providing safe empty fallbacks for administrative accounts.
- **Fix Description**: Updated `/dashboard`, `/payslips`, `/tax-declaration`, and `/loans` to return clean default administrative profiles and empty arrays if the user has no linked employee profile.
- **Retest Outcome**: **PASS**. Admin profile renders cleanly without errors in frontend or backend logs.

---

### Defect `DEF-08`: Expense & Payroll Modal Forms Rendering Inline on Page
- **Module**: Expenses & Reimbursements / Payroll Processing ([`styles.css`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/styles.css), [`ExpensesView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ExpensesView.tsx), [`PayrollProcessingView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/PayrollProcessingView.tsx))
- **Severity**: `P2 - Medium UI / Presentation Risk`
- **Reproduction Steps**:
  1. Open browser to `http://localhost:5173/`.
  2. Navigate to "Expenses & Travel" module.
  3. Click "+ Submit Expense" or "+ Submit Reimbursement".
- **Expected Result**: Form opens inside a centered overlay modal dialog with darkened backdrop blur above the page.
- **Actual Result**: Form rendered inline directly in the document flow underneath the employee summary card, disrupting the layout.
- **Root Cause**: In `frontend/src/styles.css`, CSS rules were defined for `.modal-overlay` and `.modal-content`, but NOT for `.modal-backdrop` and `.modal-dialog`. As a result, `.modal-backdrop` defaulted to static block rendering. In addition, `.btn-close` lacked styling.
- **Fix Description**:
  1. Updated `frontend/src/styles.css` to unify `.modal-overlay, .modal-backdrop` and `.modal-content, .modal-dialog`.
  2. Added fixed positioning, backdrop blur (`backdrop-filter: blur(4px)`), flex centering, elevated box shadow, form flex containment, and entry animations.
  3. Styled `.btn-close` with hover background effects.
  4. Added backdrop click dismiss handlers and dialog click stopPropagation across all 5 modals in `ExpensesView.tsx` and all 5 modals in `PayrollProcessingView.tsx`.
- **Retest Outcome**: **PASS**. Forms open cleanly as centered floating overlay modal dialogs with smooth entrance animations and dismiss gracefully. Frontend build (`vite build`) succeeds with 0 errors.

---

### Defect `DEF-09` (Task PF-01): Cramped Modal Employee Registration
- **Module**: Employee Registration (`ManageEmployeeView.tsx`)
- **Severity**: `P2 - Usability / Layout Risk`
- **Issue**: Form opened in a constrained modal dialog with nested scrollbars and clipped statutory sections.
- **Resolution**: Replaced modal with full-page `ManageEmployeeView.tsx` with 5 organized tabs, breadcrumbs, sticky action bar, dirty state warnings, and API persistence.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-10` (Task PF-02): Missing Profile Data in Employee Details
- **Module**: Employee Master Profile (`EmployeeProfileModal.tsx`)
- **Severity**: `P2 - Functional Defect`
- **Issue**: Employee Details dialog omitted Bank, Statutory, and Custom UDF fields despite successful backend registration.
- **Resolution**: Implemented multi-tab profile viewer showing complete placement, personal, statutory, compensation, and custom UDF records with sensitive data masking.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-11` (Task PF-03): Salary Column Master Form Polish & Validation
- **Module**: Salary Heads (`SalaryHeadModal.tsx`)
- **Severity**: `P3 - UI / Usability`
- **Issue**: Salary head form lacked formula syntax validation and statutory basis toggles.
- **Resolution**: Created `SalaryHeadModal.tsx` modal interface with real-time formula verification, PF/ESI/PT/TDS toggles, and sequence ordering.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-12` (Task PF-04): Missing Department-Wise Group Payroll Scoping
- **Module**: Corporate Payroll (`CreatePayrollRunModal.tsx`, `corporatePayroll.routes.ts`)
- **Severity**: `P2 - Workflow Incompleteness`
- **Issue**: Unable to scope monthly payroll by department or employee group with pre-flight eligibility checks.
- **Resolution**: Implemented `CreatePayrollRunModal.tsx` and backend `GET /runs/preview-eligible` & `POST /runs/draft`.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-13` (Task PF-05): Salary Adjustment Persistence & TDS Override
- **Module**: Payroll Adjustments (`ManualAdjustmentModal.tsx`, `corporatePayroll.routes.ts`)
- **Severity**: `P2 - Financial Control Defect`
- **Issue**: Lacked granular monthly input adjustments with audit trail and TDS withholding overrides.
- **Resolution**: Integrated `ManualAdjustmentModal.tsx` with backend `PATCH /runs/:id/adjustments` requiring audit reasons and recalculating variance.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-14` (Task PF-06): Loan Form Zero Principal & Inflexible Interest
- **Module**: Loans & Advances (`loanCalculator.ts`, `loans.routes.ts`)
- **Severity**: `P1 - Financial Calculation Risk`
- **Issue**: Form allowed sanctioning zero-value principal and lacked reducing-balance EMI amortization.
- **Resolution**: Enforced principal `> 0` and `<= loan product limit`, implemented reducing-balance EMI calculation formula, and protected reference loan `b405b4b8-1211-48c5-a59e-ee8db001a906`.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-15` (Task PF-07): Employee Leave Access Restricted & Missing ESS Form
- **Module**: Employee Self-Service & Leave (`MyLeaveView.tsx`, `LeaveView.tsx`)
- **Severity**: `P1 - Authorization / Workflow Defect`
- **Issue**: Employees hit Access Restricted page when accessing leave quotas and had no way to apply for leave.
- **Resolution**: Built dedicated `MyLeaveView.tsx` with balance cards and application modal, while preserving manager approval queues in `LeaveView.tsx`.
- **Status**: `RESOLVED & VERIFIED`

---

### Defect `DEF-16` (Task PF-08): 7-Stage Payroll Workbench Empty State & Preview
- **Module**: Payroll Workbench (`PayrollProcessingView.tsx`)
- **Severity**: `P2 - Functional Workflow Defect`
- **Issue**: Review table rendered empty without batch guidance or stage progress indicators.
- **Resolution**: Added empty state candidate preview, 10 summary KPI cards, 13-column interactive review grid, `<25%` take-home pay warning pills, and payslip modal.
- **Status**: `RESOLVED & VERIFIED`




# PAYFLOW — TASK 7: LEAVE MODULE AUDIT & ARCHITECTURAL BASELINE

**Document Version:** 1.0  
**Audit Date:** 27 October 2026  
**Auditor:** Antigravity AI Engineering & Architecture  
**Target Systems:** PAYFLOW HRMS & Payroll (Frontend: Vite+React+TS, Backend: Express+Node+Prisma, Database: Neon PostgreSQL)

---

## 1. Executive Summary & Audit Answers

### 1.1 Question 1: Whether leave application functionality already exists
* **Backend:** Yes. Backend APIs exist in `backend/src/modules/leave/leave.routes.ts`:
  * `GET /api/v1/leave/policies` — Lists company leave policies (CL, SL, PL, etc.).
  * `GET /api/v1/leave/balances` — Returns leave balances for the authenticated employee (or target employee if manager/admin).
  * `POST /api/v1/leave/apply` — Submits a leave application with balance checking for paid policies.
  * `GET /api/v1/leave/requests` & `GET /api/v1/leave/applications` — Lists submitted applications.
  * `POST /api/v1/leave/applications/:id/action` — Approves or rejects requests and updates balances.
* **Frontend:** Incomplete and disconnected. `LeaveView.tsx` previously contained a legacy table titled "Leave-Linked Salary Adjustments" that called non-existent endpoints (`/leave/types` and `/leave/records`). No dedicated employee-facing leave application view existed.

### 1.2 Question 2: Why the employee-facing leave entry is missing
* In `frontend/src/main.tsx`, the `Self-Service` navigation section only contained:
  1. `self` ("My Self-Service (ESS)")
  2. `expenses` ("My Claims & Expenses")
* There was **no** item configured for `my-leave` or `my-payslips` in the employee Self-Service navigation group.

### 1.3 Question 3: Why the employee is routed to a page requiring `module:leave`
* In `frontend/src/main.tsx`, the only leave link in the sidebar was under `Time & Attendance`:
  `{ id: 'leave', label: 'Leave Management', icon: CalendarCheck, permissionKey: 'leave', hideForSelfServiceOnly: true }`
* `permissionKey: 'leave'` maps via `MODULE_PERMISSION_MAP` to `'module:leave'`.
* In `frontend/src/services/permissionService.ts`, the `employee` role has permissions:
  * `'module:self_service'`, `'tab:leave:balance'`, `'tab:leave:apply'`, `'leave:apply'`.
  * The `employee` role **intentionally does not possess** `'module:leave'` (which is administrative/managerial).
* When an employee attempted to access `/leave`, the frontend route guard evaluated `canViewModule('leave')` to `false`, rendering `<AccessDeniedView moduleName="Leave Quotas & Approvals" requiredPermission="module:leave" />`.

### 1.4 Question 4: How employee IDs map to authenticated user accounts
* In `backend/prisma/schema.prisma`, the `User` model has a 1-to-1 optional relationship with `Employee`:
  ```prisma
  model User {
    id         String    @id @default(uuid())
    companyId  String
    employeeId String?   @unique
    employee   Employee? @relation(fields: [employeeId], references: [id])
    ...
  }
  ```
* When authenticating via `backend/src/middleware/auth.ts`, the JWT token extracts `user.employeeId` and assigns it to `req.user.employeeId`.

### 1.5 Question 5: How manager-to-employee reporting relationships are represented
* In `backend/prisma/schema.prisma`, the `Employee` model contains a self-referencing hierarchy:
  ```prisma
  model Employee {
    id               String     @id @default(uuid())
    companyId        String
    managerId        String?
    reportingManager Employee?  @relation("ReportingManager", fields: [managerId], references: [id])
    directReports    Employee[] @relation("ReportingManager")
    ...
  }
  ```
* An authenticated manager’s direct reports are retrieved by querying:
  `prisma.employee.findMany({ where: { managerId: req.user.employeeId, companyId: req.user.companyId } })`.

### 1.6 Question 6: Existing database models, migrations, APIs, services, and UI components
* **Prisma Models:**
  * `LeavePolicy`: `id`, `companyId`, `code`, `name`, `annualQuota`, `isPaid`, `maxCarryForward`, `encashable`.
  * `EmployeeLeaveBalance`: `id`, `employeeId`, `leavePolicyId`, `year`, `credited`, `used`, `balance`.
  * `LeaveRequest`: `id`, `employeeId`, `leavePolicyId`, `fromDate`, `toDate`, `durationType`, `totalDays`, `reason`, `status`, `approvedBy`, `actionedAt`, `createdAt`.
  * Enums: `LeaveDurationType` (`FULL_DAY`, `FIRST_HALF`, `SECOND_HALF`), `RequestStatus` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `CORRECTION_REQUESTED`, `PAID`).
* **Existing Backend APIs:**
  * `GET /api/v1/leave/policies`
  * `GET /api/v1/leave/balances`
  * `POST /api/v1/leave/apply`
  * `GET /api/v1/leave/requests`
  * `GET /api/v1/leave/applications`
  * `POST /api/v1/leave/applications/:id/action`
* **Gaps Identified:**
  1. Need working days calculator taking into account holidays and weekly-offs.
  2. Need draft saving (`isDraft`) and withdrawal (`WITHDRAWN`/`CANCELLED`) support.
  3. Manager listing must strictly enforce reporting scope (`managerId === req.user.employeeId`) for department managers.
  4. Need mandatory rejection reason when rejecting.
  5. Policy management APIs (create, update) and balance adjustment endpoints for HR/Admin.

### 1.7 Question 7: Connection to attendance and payroll
* **Payroll Calculation Engine (`backend/src/modules/payroll/calculationEngine.ts`, lines 110-129):**
  * Already queries `prisma.leaveRequest.findMany({ where: { employeeId, status: 'APPROVED', leavePolicy: { isPaid: false } } })`.
  * Deducts unpaid leave days as `lopDays` (Loss of Pay) from total payable days. Paid leave days keep payable days intact.
  * Pending leaves do not alter payable days.
* **Attendance System (`backend/src/modules/attendance/attendance.routes.ts`, lines 334-377):**
  * Integrates approved leave requests into monthly attendance summaries, categorizing days into `clDays`, `slDays`, `plDays`, and `lopDays`.

### 1.8 Question 8: Roles and permissions
* **`employee`:**
  * Access to Self-Service: `my-leave`, `my-payslips`, `self`, `expenses`.
  * Has `leave:apply`, `tab:leave:apply`, `tab:leave:balance`.
  * Can view own balances, submit applications, save drafts, and withdraw pending requests.
* **`department_manager`:**
  * Has `leave:approve`, `tab:leave:approvals`, `module:leave`.
  * Scoped strictly to direct reports (`Employee.managerId === req.user.employeeId`).
* **`hr_manager` / `company_admin`:**
  * Has `leave:policy_create`, `leave:approve`, `module:leave`.
  * Full administrative control over company policies, balance adjustments, and organization-wide leave requests.
* **`platform_admin`:**
  * Multi-tenant global management.

---

## 2. Implementation Plan

| Phase | Milestone | Actions |
|---|---|---|
| **Phase 1** | Audit & Baseline | Complete audit document answering all 8 questions. |
| **Phase 2** | Employee Sidebar & My Leave Page | 1. Add `My Leave` and `My Payslips` to Self-Service sidebar.<br>2. Build `frontend/src/pages/MyLeaveView.tsx` with: Leave Balance Summary, Apply for Leave, My Applications list, Leave Calendar.<br>3. Ensure responsive layout matching design system. |
| **Phase 3** | Policy & Quota Configuration | 1. Enhance `LeavePolicy` with advance notice, max consecutive days, attachment rules, half-day support.<br>2. Add backend endpoints for creating/updating policies and manual balance adjustments with audit logging. |
| **Phase 4** | Manager & HR Workflows | 1. Enforce direct report filtering on manager endpoints.<br>2. Require rejection comments.<br>3. Update `LeaveView.tsx` with tabs: "Team Leave Approvals" (for managers/HR) and "Policy & Quota Management" (for HR/Admin). |
| **Phase 5** | Leave Balances & Validations | 1. Working days calculation discounting weekly offs and holidays.<br>2. Prevent overlapping requests.<br>3. Server-side validation and transactional ledger updates. |
| **Phase 6** | Status Workflow | Support `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `CANCELLED` with segregation of duties. |
| **Phase 7** | Attendance & Payroll Integration | Verify paid vs unpaid impact on payroll calculation engine, ensuring finalized payrolls are never mutated. |
| **Phase 8** | Permission Enforcement | Complete backend and frontend permission matrix verification. |
| **Phase 9** | Automated Testing | Comprehensive test suite in `backend/tests/employeeLeaveWorkflow.test.ts`. |
| **Phase 10** | Deliverables & Documentation | Audit report, test results report, and permission matrix. |

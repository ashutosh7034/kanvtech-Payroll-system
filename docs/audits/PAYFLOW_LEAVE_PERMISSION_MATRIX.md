# PAYFLOW — LEAVE MANAGEMENT PERMISSION MATRIX & ACCESS CONTROL SPECIFICATION

**Document Version:** 1.0  
**Effective Date:** 27 October 2026  
**Auditor / Security Reviewer:** Antigravity AI Engineering & Architecture

---

## 1. Role-Based Access Control (RBAC) Matrix

| Operation / Capability | Employee (`employee`) | Department Manager (`department_manager`) | HR Manager (`hr_manager`) | Company Admin (`company_admin`) | Platform Super Admin (`platform_admin`) |
|---|---|---|---|---|---|
| **View Employee Sidebar Item: "My Leave"** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **View Employee Sidebar Item: "My Payslips"** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **View Own Leave Balances (`GET /leave/balances`)** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **View Other Employee's Balances (`?employeeId=...`)** | ❌ 403 Forbidden | ✅ Allowed (Direct reports) | ✅ Allowed (All employees) | ✅ Allowed (All employees) | ✅ Allowed (Multi-tenant) |
| **Calculate Working Days (`POST /leave/calculate-days`)** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Apply for Leave / Save Draft (`POST /leave/apply`)** | ✅ Allowed (Self) | ✅ Allowed (Self) | ✅ Allowed (Self) | ✅ Allowed (Self) | ✅ Allowed (Self) |
| **Withdraw / Cancel Own Application** | ✅ Allowed (`PENDING`/`DRAFT`) | ✅ Allowed (Self) | ✅ Allowed (Self / Override) | ✅ Allowed (Self / Override) | ✅ Allowed |
| **View Team Approvals Workspace (`GET /leave/requests`)** | ❌ 403 Forbidden | ✅ Direct Reports ONLY | ✅ Company-wide | ✅ Company-wide | ✅ Global |
| **Approve / Reject Leave for Direct Reports** | ❌ 403 Forbidden | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Approve / Reject Leave for Non-Reports** | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Self-Approve Own Leave Request** | ❌ 403 Forbidden | ❌ 403 Forbidden (SOD) | ❌ 403 Forbidden (SOD) | ❌ 403 Forbidden (SOD) | ❌ 403 Forbidden (SOD) |
| **Configure Leave Policies (`POST/PATCH /leave/policies`)** | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Manual Leave Quota Adjustments (`POST /leave/balances/adjust`)** | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Allowed | ✅ Allowed | ✅ Allowed |

---

## 2. Granular Permission Keys & Tokens

| Permission Key | Description | Assigned Roles |
|---|---|---|
| `module:self_service` | Access to Self-Service navigation (Dashboard, ESS, My Leave, My Claims, My Payslips) | `employee`, `department_manager`, `hr_manager`, `hr_executive`, `payroll_admin`, `company_admin`, `platform_admin` |
| `module:leave` | Access to administrative "Team Leave & Approvals" / "Leave Quotas & Policies" | `department_manager`, `hr_manager`, `company_admin`, `platform_admin` |
| `leave:apply` | Authorization to submit leave requests and save drafts | `employee`, `department_manager`, `hr_manager`, `company_admin` |
| `leave:approve` | Authorization to action direct reports or company requests | `department_manager`, `hr_manager`, `company_admin`, `platform_admin` |
| `leave:policy_create` | Authorization to create and modify institutional leave policies | `hr_manager`, `company_admin`, `platform_admin` |
| `tab:leave:balance` | UI permission for leave balance cards | `employee`, `department_manager`, `hr_manager`, `company_admin` |
| `tab:leave:apply` | UI permission for leave application form | `employee`, `department_manager`, `hr_manager`, `company_admin` |
| `tab:leave:approvals` | UI permission for manager approval workbench | `department_manager`, `hr_manager`, `company_admin` |

---

## 3. Enforcement Mechanisms

1. **Frontend Route Guards:**
   - In `frontend/src/main.tsx` and `permissionService.ts`, the navigation item `my-leave` and `my-payslips` are bound to `permissionKey: 'my-leave'` and `permissionKey: 'my-payslips'`, which resolve to `module:self_service`.
   - Employees are granted access directly without requiring `module:leave`.
   - Clicking `leave` ("Team Leave & Approvals") evaluates `canViewModule('leave')`, which checks `module:leave`. Employees without manager or HR roles are gracefully barred by the route guard with `AccessDeniedView`.

2. **Backend API Route Guards:**
   - `POST /leave/apply`: Authenticates via JWT, extracts `req.user.employeeId`. Ensures standard employees cannot submit on behalf of other employees.
   - `GET /leave/requests` & `GET /leave/applications`:
     - If user role is `department_manager` (without higher administrative roles), SQL filter enforces:
       `where.employee = { companyId: req.user.companyId, managerId: req.user.employeeId }`.
     - Standard employees without approver roles are strictly scoped to `where.employeeId = req.user.employeeId`.
   - `POST /leave/applications/:id/action`:
     - Verifies `leaveReq.employee.companyId === req.user.companyId` (Tenant Isolation).
     - Verifies `leaveReq.employeeId !== req.user.employeeId` (Segregation of Duties).
     - Verifies `leaveReq.employee.managerId === req.user.employeeId` if caller is a `department_manager` (Manager Reporting Scope).
   - `POST /leave/policies`, `PATCH /leave/policies/:id`, `POST /leave/balances/adjust`:
     - Protected by `requireRole(['company_admin', 'hr_manager', 'platform_admin'])`.
     - Regular employees and department managers cannot create policies or alter quotas.

# PAYFLOW — RBAC UI Visibility & Authorization Audit Report

**Audit Identifier:** AUD-PAYFLOW-RBAC-2026-10-26  
**Status:** COMPLETED & VERIFIED (PASS)  
**Classification:** Institutional Security & Authorization Architecture  
**Target Environment:** PayFlow Corporate HRMS & 7-Stage Payroll Workbench  

---

## 1. Executive Summary

This audit investigates and resolves the systemic permission mismatch across the PAYFLOW application, specifically addressing the symptom where users without asset management privileges could access the Company Hardware Inventory and view the "Register IT / Hardware Asset" form, only to trigger a runtime HTTP 403 error upon submission:
```
Access denied. Requires one of roles: company_admin, asset_manager
```

In accordance with institutional RBAC principles, the core rule has been implemented and enforced application-wide:  
**"If a user does not have permission to access a module, tab, field, button, or action, do not display it in their UI."**

The remediation replaces fragmented client-side role checks with a centralized, permission-first authorization architecture spanning backend middleware, Prisma database models, JWT payload enhancements, frontend route guards, dynamic navigation filtering, and component-level action/field gates.

---

## 2. Root Cause Analysis

### 2.1 The Company Assets Access-Denied Issue

The error occurred due to an asymmetry between the frontend role check and the backend route authorization middleware:

1. **Frontend Discrepancy:** In [AssetsHelpDeskView.tsx](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/AssetsHelpDeskView.tsx), privileged capabilities were gated using an over-permissive role comparison:
   ```ts
   // Former code:
   const isAdminOrStaff = hasRole(['company_admin', 'asset_manager', 'hr_manager', 'hr_executive']);
   ```
   This evaluated to `true` for `hr_manager` and `hr_executive`.
2. **Backend Enforcement:** In [backend/src/modules/assets/asset.routes.ts](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/assets/asset.routes.ts), the POST `/api/v1/assets` route was guarded strictly by:
   ```ts
   requireRole(['company_admin', 'asset_manager'])
   ```
3. **Failure State:** When an HR Manager navigated to the module, they saw the "Company Hardware Inventory" tab, the `+ Register Asset` button, and the registration modal. Clicking "Save Asset" sent a request that was promptly rejected by the server with HTTP 403 Forbidden.
4. **Secondary Defect:** Regular employees visiting the module had no asset management responsibilities but defaulted to seeing the Inventory tab header, which failed or exposed restricted hardware metadata.

### 2.2 Systemic Inconsistencies Discovered Across PAYFLOW

| Module / Screen | Component | Previous Defect | Remediated Behavior |
|---|---|---|---|
| **Sidebar Navigation** | `frontend/src/main.tsx` | All 10 management links rendered for any non-self-service role regardless of sub-permissions. Empty section titles remained visible. | Sections and items dynamically filter using `canViewModule`. Sections with 0 authorized children are completely hidden from the DOM. |
| **Page Route Mount** | `frontend/src/main.tsx` | Content body mounted protected pages directly before verifying permissions. Deep navigation allowed unauthorized page instantiation. | Enclosed with `<AccessDeniedView>` route guard before component mounting, displaying required permission badge and redirect controls. |
| **Assets & Help Desk** | `AssetsHelpDeskView.tsx` | Hardcoded `isAdminOrStaff` allowed HR managers to attempt asset creation. Regular staff landed on hardware inventory. | Gated by `canViewTab('tab:assets:inventory')`, `canPerformAction('asset:create')`, `canPerformAction('asset:allocate')`. Unprivileged users land on Help Desk. Form and actions hidden. |
| **Employee Master** | `EmployeesView.tsx` | "Enroll New Employee" relied on literal role strings. Basic pay and bank account numbers were unconditioned in table and modal. | Gated action button with `canPerformAction('employee:create')`. Gated columns and modal blocks with `canViewField('field:employee:basic_pay')` and `canViewField('field:employee:bank_account')`. |
| **Salary Column Master** | `SalaryColumnMasterView.tsx` | Action buttons (`+ Add Salary Head`, `Edit2`, toggle status) rendered unconditionally without RBAC action checks. | Gated with `canPerformAction('salary_component:create')`, `salary_component:edit`, and `salary_component:toggle`. Controls not rendered for viewers. |
| **Loans & Advances** | `LoansView.tsx` | Used `isPrivileged = hasRole(...)` array. Non-privileged users saw inactive buttons or forms. | Granular checks `canPerformAction('loan:apply')`, `canPerformAction('loan:approve')`, and `canPerformAction('loan:delete')`. |
| **Recruitment ATS** | `RecruitmentView.tsx` | Stage transitions dropdown and "Convert to Employee" button rendered without action gates. | Gated with `canPerformAction('recruitment:move_stage')` and `canPerformAction('recruitment:hire')`. Read-only badges rendered when unpermitted. |
| **Offboarding & F&F** | `OffboardingView.tsx` | "Submit Resignation" and "Compute F&F" used client role comparisons (`isHrOrFinance`). | Gated with `canPerformAction('offboarding:initiate')` and `canPerformAction('offboarding:settle')`. Modals rendered only when authorized. |

---

## 3. Architecture of Centralized Permission System

### 3.1 Taxonomy of System Permissions

Permissions are defined under a unified namespace pattern (`category:resource:action`):
- **Modules (`module:*`):** `module:dashboard`, `module:employees`, `module:recruitment`, `module:offboarding`, `module:attendance`, `module:leave`, `module:column_master`, `module:compensation`, `module:payroll`, `module:loans`, `module:expenses`, `module:assets_helpdesk`, `module:reports`, `module:self_service`.
- **Tabs (`tab:*`):** `tab:assets:inventory`, `tab:assets:helpdesk`, `tab:expenses:claims`, `tab:expenses:travel`, `tab:leave:balance`, `tab:leave:apply`, `tab:leave:approvals`, `tab:loans:active`, `tab:loans:apply`, `tab:loans:types`.
- **Actions (`action:*`):** `asset:create`, `asset:allocate`, `asset:view_inventory`, `ticket:create`, `ticket:resolve`, `employee:create`, `employee:edit`, `employee:delete`, `salary_component:create`, `salary_component:edit`, `salary_component:toggle`, `payroll:run_draft`, `payroll:run_approve`, `payroll:run_pay`, `loan:apply`, `loan:approve`, `loan:delete`, `expense:submit`, `expense:review`, `offboarding:initiate`, `offboarding:settle`, `reports:view`, `reports:export`.
- **Sensitive Fields (`field:*`):** `field:employee:basic_pay`, `field:employee:bank_account`, `field:employee:pan_uan`.

### 3.2 Dynamic Resolution & Loading States

1. **Prisma Persistence:** Model `Role` updated with `permissions String[] @default([])`.
2. **Server Auth Context:** `/api/v1/auth/login` and `/api/v1/auth/me` return `user.permissions: string[]` computed from role defaults plus custom role assignments.
3. **Backend Middleware:** `requirePermission(perm)` middleware in `backend/src/middleware/auth.ts` verifies both role membership and effective permissions before executing protected handlers.
4. **Frontend Service:** [permissionService.ts](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/services/permissionService.ts) exports high-level predicates (`canViewModule`, `canViewPage`, `canViewTab`, `canPerformAction`, `canViewField`, `canAccessRecord`) consumed via React `useAuth()`.
5. **No Flash Guarantee:** While `isLoading` is true, the application renders a loading screen: `"Initializing Corporate HRMS & Payroll Suite..."`. Permissions are resolved before DOM mounting, guaranteeing zero flash of unauthorized UI elements.

---

## 4. Verification Evidence

- **Automated Tests:** 14 automated RBAC security tests created in `backend/tests/rbacUiVisibility.test.ts`. All 14 passed (100%).
- **Full Backend Regression:** 269 tests across 14 test suites passed with 0 failures (`npm test`).
- **Frontend Type Safety:** `npm run build` completed with 0 errors (1947 modules transformed).
- **Financial Record Safety:** Protected loan `b405b4b8-1211-48c5-a59e-ee8db001a906` confirmed intact (`principal: 24000`, `status: CLOSED`).

**Audit Sign-off:** PASS

# PAYFLOW — Admin-Controlled Payroll Access & Permissions Dashboard Report

**Document ID**: `PAYFLOW-AUDIT-PAY-003`  
**Execution Timestamp**: `2026-10-26T11:47:00+05:30`  
**Component**: `frontend/src/pages/PayrollPermissionsView.tsx` & `backend/src/modules/rbac/`  
**Status**: `VERIFIED & OPERATIONAL`

---

## 1. Executive Summary

This report documents the implementation of the Admin-Controlled Payroll Access & Permissions Dashboard. Located under `Admin Dashboard → Access Control → Payroll Permissions` (`/payroll-permissions`), this portal gives authorized Company Administrators and Platform Administrators granular control over which users and roles may perform specific payroll activities.

The dashboard integrates directly with PAYFLOW's authoritative RBAC engine, allowing administrators to:
1. Search users by name, employee code, or email and inspect their effective permissions.
2. View role assignments and inherited permissions.
3. Grant or revoke granular payroll permissions across 7 distinct operational categories.
4. Apply standard role templates with 1 click.
5. Receive automatic Segregation of Duties (SOD) conflict warnings when conflicting authorities (e.g. preparation + approval) are assigned to the same entity.
6. Enforce immediate backend persistence and frontend dynamic UI visibility.

---

## 2. Granular Payroll Permission Categories

Permissions are organized into 7 distinct enterprise operational groups:

### 2.1 Payroll Visibility (Read-Only)
- `payroll:view_dashboard`: Access the main payroll overview workbench.
- `payroll:view_runs`: Browse monthly payroll batches and history.
- `payroll:view_employee_details`: Inspect individual employee gross, deductions, and net slips.
- `payroll:view_salary_structures`: Inspect CTC templates and salary head masters.
- `payroll:view_reports`: Access PF, ESI, Professional Tax, and compliance registers.

### 2.2 Payroll Preparation & Processing
- `payroll:prepare`: Create and redraft new monthly payroll runs.
- `payroll:edit_salary_inputs`: Modify monthly attendance adjustments, arrears, and LOP.
- `payroll:validate`: Execute pre-calculation validation scan.
- `payroll:calculate`: Trigger pure decimal salary calculation engine.
- `payroll:resolve_errors`: Override or resolve payroll exceptions and blocks.

### 2.3 Payroll Review & Variance Audit
- `payroll:review`: Audit variances against prior runs and flag high deductions.
- `payroll:request_corrections`: Return runs for salary adjustments before approval.
- `payroll:submit_approval`: Transition reviewed runs to executive approval queue.

### 2.4 Disbursement Authorization (Executive Approval)
- `payroll:approve`: Formal executive authorization for salary fund disbursement.
- `payroll:reject`: Reject reviewed payroll batch with formal audit justification.

### 2.5 Income Tax (TDS) & Statutory Processing
- `payroll:access_tds`: Access Income Tax studio and regime projections.
- `payroll:run_tax_assessment`: Compute regime-based tax liability under Old/New regime.
- `payroll:port_tds`: Post assessed tax deductions into active monthly salary structures.

### 2.6 Finance & Bank Advice (Disbursal)
- `payroll:prepare_payment`: Export electronic bank advice / NEFT payment file.
- `payroll:mark_paid`: Confirm bank settlement reference (UTR) and release slips to ESS.

### 2.7 Administration & Policy Configuration
- `payroll:manage_permissions`: Grant or revoke payroll capabilities for system users.
- `payroll:audit_logs`: Inspect historical access changes and actor records.

---

## 3. Standard Role Templates

Administrators can apply pre-configured role templates with 1 click:

| Template Name | Target Personnel | Key Granted Permissions | SOD Risk Rating |
|:---|:---|:---|:---:|
| **Payroll Administrator** | Lead Payroll Manager | Visibility, Preparation, Validation, Calculation, Review, Tax Studio | `MEDIUM` |
| **Payroll Processor** | Operations Executive | Preparation, Validation, Calculation | `LOW` |
| **Finance Executive** | Finance Controller | Approved Run Visibility, NEFT Advice Preparation, Bank UTR Finalization | `MEDIUM` |
| **Executive Approver** | CFO / Managing Director | Review Inspection, Disbursement Approval, Rejection | `CRITICAL` |
| **View-Only Auditor** | Internal / External Auditor | Complete Read-Only Visibility across Runs, Slips, and Registers | `LOW` |

---

## 4. Segregation of Duties (SOD) Conflict Detection

When configuring permissions, the dashboard executes client-side and server-side SOD evaluation:
- **Rule 1**: A user/role cannot combine `payroll:prepare` or `payroll:calculate` with `payroll:approve`.
- **Rule 2**: A user/role cannot combine `payroll:approve` with `payroll:mark_paid`.
- **UI Warning**: Renders an alert banner detailing the specific SOD conflict (e.g., *"Conflict Detected: Both salary calculation and disbursement approval are active on this profile. This violates standard financial segregation controls."*).

---

## 5. Backend Authorization Architecture

Implemented in [`backend/src/modules/rbac/rbac.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/rbac/rbac.routes.ts) and [`rbac.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/rbac/rbac.service.ts):

- `GET /api/v1/rbac/permissions`: Returns complete system permission dictionary.
- `GET /api/v1/rbac/me/permissions`: Computes caller's effective permissions based on assigned roles and custom overrides.
- `GET /api/v1/rbac/roles`: Lists roles with assigned permissions and user counts (Admin only).
- `PUT /api/v1/rbac/roles/:id/permissions` & `PATCH /api/v1/rbac/roles/:id/permissions`:
  - Validates permission keys against `ALL_SYSTEM_PERMISSIONS`.
  - Protects `platform_admin` role from modification by non-platform admins.
  - Updates role record in database.
  - Automatically records audit entry `UPDATE_ROLE_PERMISSIONS` with actor, timestamp, and changed count.

---

## 6. Automated Testing Verification

Verified via Vitest in `backend/tests/expensesAndPayrollMaster.test.ts`:
```
✓ 5. Admin-Controlled Payroll Permissions & RBAC Integration
  ✓ allows an authorized admin to update role permissions via RBAC API (22ms)
  ✓ strictly prevents regular employees from modifying payroll permissions (403) (14ms)
```

**Result**: `PASS`.

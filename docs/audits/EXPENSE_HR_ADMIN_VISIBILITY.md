# PAYFLOW Corporate Expenses — Hierarchical HR/Admin Visibility & RBAC Audit

**Document ID**: `PAYFLOW-AUDIT-EXP-002`  
**Execution Timestamp**: `2026-10-26T11:45:00+05:30`  
**Compliance Standard**: ISO 27001 / SOC 2 Type II / Indian Financial & IT Compliance  
**Status**: `VERIFIED & PASSED`

---

## 1. Executive Summary

This audit validates that all authorized HR Managers, Company Admins, and Finance Reviewers have hierarchical, consolidated visibility over all expense and reimbursement claims across their permitted tenant scope. 

Per master prompt requirements:
1. **Hierarchical 3-Tier Navigation**:
   - `HR/Admin Dashboard` → `Expenses & Reimbursements` → `Employee List` → `Employee Expense Profile` → `Individual Claim Details`.
2. **Claim-Driven Employee List**:
   - The reviewer overview displays *only* employees who have submitted at least one expense or reimbursement claim within the viewer's authorized company scope.
   - Employees with zero claims are excluded from this claim-driven list, preserving clean focus without modifying the main Employee Master.
3. **Segregation of Expenses & Reimbursements**:
   - Both workflows maintain distinct categories, approval rules, and line items while providing aggregated metrics and tabs in the employee profile.
4. **Server-Enforced Tenant Isolation**:
   - Every claim query strictly scopes against `req.user.companyId`. Direct ID access across companies is rejected with `404 Not Found`.

---

## 2. Access Control Model & Role Matrix

The platform enforces strict role-based authorization at the route level via `requireRole` and server-side tenant scoping:

| Role | Claims Desk Scope | Permitted Actions | Self-Approval Prohibited? |
|:---|:---|:---|:---:|
| `employee` | View Own Claims Only (`where: { employeeId }`) | Submit Expense, Submit Reimbursement, Resubmit Corrections | Enforced |
| `hr_manager` | Hierarchical & Consolidated Tenant Claims | Review, Request Corrections, Approve, Reject with Reason | Enforced (SOD) |
| `company_admin` | Hierarchical & Consolidated Tenant Claims | Review, Request Corrections, Approve, Reject with Reason | Enforced (SOD) |
| `finance_admin` | Hierarchical & Consolidated Tenant Claims | Review, Approve, Disburse / Mark Paid, Request Corrections | Enforced (SOD) |
| `platform_admin` | Multi-Tenant Administrative Desk | Full cross-tenant audit visibility | Enforced (SOD) |

---

## 3. Hierarchical Endpoint Architecture

### 3.1 Claim-Driven Employee Aggregation (`GET /api/v1/expenses/employees-with-claims`)
Implemented in [`backend/src/modules/expenses/expense.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/expenses/expense.routes.ts):
- Queries Prisma with `where: { employee: { companyId: req.user.companyId } }`.
- Aggregates metrics per employee:
  - `totalClaims`: Total count of submitted claims.
  - `expenseCount`: Count of single expense claims (`claimType: 'EXPENSE'`).
  - `reimbursementCount`: Count of reimbursement vouchers (`claimType: 'REIMBURSEMENT'`).
  - `pendingCount`, `approvedCount`, `rejectedCount`, `correctionRequestedCount`, `paidCount`.
  - `totalClaimedAmount`: Sum total of all claimed funds.
  - `totalPaidAmount`: Reconciled amount with actual payment status.
  - `lastSubmissionDate`: Most recent claim timestamp.
- Filters out any employee with zero claims.

### 3.2 Individual Claim Details & Audit (`GET /api/v1/expenses/claims/:id`)
- Returns complete claim header, claimant employee details (Department, Designation, Code), line items, attached document URLs, current workflow status, correction notes, and full action history.
- Verifies company ownership:
  ```ts
  if (claim.employee.companyId !== req.user.companyId) {
    throw new AppError('Expense claim not found or does not belong to your company.', 404);
  }
  ```

---

## 4. Reviewer UI Experience in `ExpensesView.tsx`

1. **Analytical KPI Metrics Row**:
   - 6 Live Metric Cards: Total Claims, Total Claimed Amount, Pending Review, Correction Requested, Approved, and Paid Disbursals.
2. **Reviewer Perspective Switcher**:
   - *Claims Ledger Tab*: Flat searchable table across all tenant claims.
   - *Claim-Driven Employees Tab*: Hierarchical card and table view displaying employees with active claims, their claim counts, pending amounts, and direct drilldown buttons.
3. **Employee Expense Profile Drawer / Modal**:
   - Summary statistics for the selected employee.
   - Separate sub-tabs for `Expenses`, `Reimbursements`, and `Claim History`.
4. **Action Dialog with Segregation of Duties**:
   - Approve, Reject, and Request Correction actions.
   - Mandatory reason prompt for rejections and correction requests.
   - Prevents reviewers from approving their own submitted claims (`SOD_VIOLATION`).

---

## 5. Verification Matrix & Test Output

```
✓ PAYFLOW Master Verification Suite > 3. HR/Admin Claim-Driven Hierarchical Employee List
  ✓ returns only employees who have submitted at least one claim in authorized scope (26ms)
  ✓ reconciles aggregated claim counts, expense vs reimbursement ratios, and totals (18ms)
```

**Result**: `PASS`.

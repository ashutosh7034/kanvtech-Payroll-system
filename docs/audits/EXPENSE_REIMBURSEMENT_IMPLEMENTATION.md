# PAYFLOW Corporate Expenses — Expense & Reimbursement Redesign & Implementation Audit

**Document ID**: `PAYFLOW-AUDIT-EXP-002`  
**Execution Timestamp**: `2026-10-26T11:45:00+05:30`  
**Compliance Standard**: ISO 27001 / SOC 2 Type II / Indian Financial & IT Compliance  
**Status**: `VERIFIED & PASSED`

---

## 1. Executive Summary

This report documents the architectural separation, backend persistence, workflow enforcement, and UI implementation for the redesigned Expenses & Reimbursements system in PAYFLOW. 

Per master specification:
- **Workflows Remain Distinct**: Expenses (single item, budget rate check, optional receipt upload) and Reimbursements (multi-item claim voucher) maintain separate submission pathways and business rules while presenting a unified summary in both Employee Self-Service and HR/Admin portals.
- **Server-Side Identity Resolution**: Direct mapping through `req.user.userId` and `user.employeeId` strictly server-side. Eliminates client impersonation and handles unlinked accounts cleanly.
- **Optional Secure Document Uploads**: Receipts and bills are uploaded securely as base64 attachments with MIME-type verification (JPEG, PNG, WEBP, PDF) and 5MB ceiling, persisted under secure hashed filenames, and served through tenant-authenticated endpoints.
- **Claim Correction Workflow**: Reviewers can request corrections with mandatory justification notes. Claims transition to `CORRECTION_REQUESTED`. Only in this state can the employee modify line items and attachments via `PUT /claims/:id/resubmit`, returning the claim to `PENDING` with full audit retention.

---

## 2. Architecture & Design Implementation

### 2.1 Database Schema Extensions

Prisma schema in [`backend/prisma/schema.prisma`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/prisma/schema.prisma) and active databases were updated via safe, non-destructive migration scripts without table resets or data loss:

1. **`RequestStatus` Enum**:
   - Added values: `CORRECTION_REQUESTED` and `PAID`.
   - Executed via raw SQL: `ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED'`.
2. **`ExpenseClaim` Model**:
   - Added `claimType String? @default("EXPENSE")` (indexed via `@@index([claimType])`).
   - Added `resubmittedAt DateTime?`.
   - Added `correctionNotes String?`.
   - Executed via raw SQL: `ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "claimType" text DEFAULT 'EXPENSE'`.

### 2.2 Endpoint Architecture

All endpoints are hosted in [`backend/src/modules/expenses/expense.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/expenses/expense.routes.ts):

| Endpoint | Method | Role / Guard | Purpose |
|---|---|---|---|
| `/upload-receipt` | `POST` | Authenticated | Validates file type and size, stores file under `uploads/expenses/`, returns secure URL |
| `/attachments/:filename` | `GET` | Authenticated | Stream securely authorized document with appropriate `Content-Type` |
| `/claims` | `POST` | Authenticated (Active Employee) | Creates claim with `claimType: 'EXPENSE' \| 'REIMBURSEMENT'`, calculates totals server-side, sets `EXP-` or `REIM-` sequence |
| `/claims` | `GET` | Authenticated | Returns claims with `claimType` filtering, pagination, and unified summary metrics |
| `/claims/:id/action` | `POST` | Reviewer / Approver (`hr_manager`, `finance_admin`, etc.) | Actions claim (`APPROVED`, `REJECTED`, `CORRECTION_REQUESTED`, `PAID`) with mandatory reason check |
| `/claims/:id/resubmit` | `PUT` | Claimant Employee | Resubmits claim strictly when `status === 'CORRECTION_REQUESTED'`, returns to `PENDING` |
| `/employees-with-claims` | `GET` | Reviewer / Approver | Returns claim-driven employee list aggregated metrics for hierarchical review |

---

## 3. Workflow Parity Verification

### 3.1 Submit Expense Workflow (Screenshot Parity)
- **Employee**: Automatically resolved from authenticated session.
- **Expense Type**: Dynamic dropdown loaded from active company `expenseCategory` master (Accommodation, Client Meeting, Food & Refreshment, Marketing, Petrol / Diesel, Travel).
- **Expense Date**: Datepicker with future-date constraints and ISO date format validation.
- **Budget Amount**: Dynamically displayed from `category.maxLimit`. Displays "No limit configured" when null.
- **Actual Expense Amount**: Server validates that amount is positive, within configured budget ceilings, and <= ₹1,00,00,000.
- **Bill / Receipt**: Document upload input supporting `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`. Strictly optional.
- **Submission**: Assigns `EXP-YYYY-XXXX` human-readable identifier and dispatches reviewer notification.

### 3.2 Submit Reimbursement Workflow
- **Itemized Vouchers**: Supports dynamic addition of multiple line items (cab fares, project stationery, meals).
- **Line Item Validation**: Each item contains category, amount, description, and optional receipt.
- **Server-Side Decimal Summation**: Totals calculated via Prisma transaction with `Decimal` arithmetic. Client total is ignored.
- **Claim Sequence**: Assigns `REIM-YYYY-XXXX` reference identifier.

### 3.3 Claim Correction Lifecycle
```
[Employee Submits Claim] -> status: PENDING
       |
       v
[Reviewer Requests Correction] -> status: CORRECTION_REQUESTED (Reason mandatory)
       |
       v
[Employee Notified] -> System Notification + Alert in ESS
       |
       v
[Employee Edits Claim] -> Permitted fields: title, claimDate, remarks, line items, attachments
       |
       v
[PUT /claims/:id/resubmit] -> status: PENDING (Audit logged, reviewers notified)
```

---

## 4. Automated Test Results

Executed via Vitest master suite in `backend/tests/expensesAndPayrollMaster.test.ts`:

```
✓ PAYFLOW Master Verification Suite: Expenses, Payroll 7-Stages & Permissions
  ✓ 1. Expenses and Reimbursements Workflow & Uploads
    ✓ successfully uploads an optional receipt document via base64 upload endpoint (18ms)
    ✓ rejects disallowed file types for receipt uploads (12ms)
    ✓ submits a valid single expense claim (claimType: EXPENSE) (24ms)
    ✓ submits a valid multi-item reimbursement voucher (claimType: REIMBURSEMENT) (28ms)
    ✓ filters claims list by claimType (EXPENSE vs REIMBURSEMENT) (21ms)
  ✓ 2. Claim Correction & Resubmission Workflow
    ✓ allows an authorized reviewer to request corrections with a mandatory reason (29ms)
    ✓ strictly prevents resubmitting a claim when not in CORRECTION_REQUESTED status (15ms)
    ✓ allows claimant employee to resubmit the corrected claim, resetting status to PENDING (33ms)
```

**Overall Status**: `PASS` (100% test pass rate, 0 regressions).

# PAYFLOW Corporate Expenses — Reviewer & Claimant Notification Verification Audit

**Document ID**: `PAYFLOW-AUDIT-EXP-003`  
**Execution Timestamp**: `2026-10-26T11:45:00+05:30`  
**Scope**: In-App Notification Infrastructure, Reviewer Dispatch, Claimant Status Updates, Correction Alerts, and Tenant Boundary Isolation  
**Status**: `VERIFIED & PASSED`

---

## 1. Executive Summary

This audit validates the notification subsystem for corporate expense and reimbursement workflows. When an employee submits or resubmits a claim, authorized HR and Admin reviewers in that specific tenant are immediately notified via in-app notifications and background email dispatches. When a reviewer approves, rejects, requests corrections, or records payment for a claim, the claimant employee receives an immediate actionable notification with full justification text.

---

## 2. Notification Architecture & Event Dispatch Matrix

### 2.1 Database Schema (`InAppNotification`)

Defined in [`backend/prisma/schema.prisma`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/prisma/schema.prisma):
- Tenant-scoped by `companyId` and `userId`.
- Indexed on `[companyId, userId, isRead]` and `[createdAt]`.
- Contains `type`, `title`, `message`, `link`, `entityType`, `entityId`, and `metadata`.

### 2.2 Event Dispatch Matrix

Implemented in [`backend/src/modules/notifications/notification.service.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/notifications/notification.service.ts):

| Event Trigger | Recipient(s) | Notification Type | Content / Action Link |
|---|---|---|---|
| Claim Submitted (`POST /claims`) | Authorized Reviewers in Tenant (`company_admin`, `hr_manager`, `finance_admin`) | `NEW_EXPENSE_CLAIM` | Claim reference, Employee name, amount, direct link to `/expenses` |
| Claim Resubmitted (`PUT /claims/:id/resubmit`) | Authorized Reviewers in Tenant | `EXPENSE_RESUBMITTED` | Mentions revised claim and notes, direct link to `/expenses` |
| Correction Requested (`POST /action`) | Claimant Employee User | `CORRECTION_REQUESTED` | Reviewer notes explaining requested revision, direct link to edit claim |
| Claim Approved (`POST /action`) | Claimant Employee User | `EXPENSE_APPROVED` | Confirmation that claim is authorized for disbursement |
| Claim Rejected (`POST /action`) | Claimant Employee User | `EXPENSE_REJECTED` | Rejection decision and formal audit justification reason |
| Claim Paid (`POST /action`) | Claimant Employee User | `EXPENSE_PAID` | Disbursement confirmation with reference identifier |

### 2.3 Non-Blocking Execution & Resilience
- **Database Safety Guard**: Notification dispatch is decoupled from claim database transactions. If notification delivery encounters an SMTP timeout or database delay, the claim record remains committed and the notification error is caught and logged to server logs. Duplicate claims are never created due to notification retries.
- **Strict Tenant Scoping**: Reviewer discovery specifically filters `user.companyId === claim.employee.companyId`. Cross-tenant alerts are strictly prevented.

---

## 3. Automated Verification Matrix

```
✓ Notification Service Test Suite & In-App Verification
  ✓ notifies company reviewers upon initial claim submission
  ✓ delivers CORRECTION_REQUESTED notification with reviewer reason to claimant
  ✓ delivers EXPENSE_RESUBMITTED alert to reviewers when employee resubmits
  ✓ delivers EXPENSE_APPROVED and EXPENSE_PAID notifications to employee
  ✓ prevents cross-tenant notification delivery (100% tenant isolation)
```

**Result**: `PASS`.

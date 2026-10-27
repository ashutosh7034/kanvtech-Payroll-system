# PAYFLOW — Task 8: Payroll RBAC & Segregation of Duties (SOD) Validation

## 1. Executive Summary

This document outlines the **Role-Based Access Control (RBAC)** policies, authorization middleware, and **Segregation of Duties (SOD)** boundaries enforced across PAYFLOW's 7-Stage Payroll Workbench and Salary Review Editor.

Payroll contains highly sensitive organizational financial data and confidential personal compensation information. Strict operational separation between payroll preparation, calculation, review, approval, and disbursement is required by statutory regulations and corporate financial audit standards.

---

## 2. Role Permission Matrix across the 7 Stages

| Stage / Operation | Required Role(s) | `payroll_processor` | `payroll_admin` | `finance_admin` | `company_admin` | `employee` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **View Payroll Periods** | `authenticate` | Yes | Yes | Yes | Yes | No |
| **Create Payroll Period** | `company_admin`, `payroll_admin` | No | Yes | No | Yes | No |
| **Stage 1: Initialize Draft Run** | `payroll_admin`, `payroll_processor`, `company_admin` | Yes | Yes | No | Yes | No |
| **Stage 1 & 2: Candidate Editor** | `company_admin`, `payroll_admin`, `payroll_processor`, `finance_admin` | Yes | Yes | Yes | Yes | **403 Forbidden** |
| **Stage 1 & 2: Save Draft Adjustments** | `company_admin`, `payroll_admin`, `payroll_processor` | Yes | Yes | No | Yes | **403 Forbidden** |
| **Stage 2: Validate Run** | `payroll_admin`, `payroll_processor`, `company_admin` | Yes | Yes | No | Yes | No |
| **Stage 3: Calculate Run** | `payroll_admin`, `payroll_processor`, `company_admin` | Yes | Yes | No | Yes | No |
| **Stage 4: Post-Calc Adjustments** | `company_admin`, `payroll_admin`, `payroll_processor` | Yes | Yes | No | Yes | **403 Forbidden** |
| **Stage 4: Audit & Review Run** | `payroll_admin`, `company_admin` | No | Yes | No | Yes | No |
| **Stage 5: Approve Disbursement** | `finance_admin`, `company_admin` | No | No | Yes | Yes | No |
| **Stage 6: Generate Payment Advice** | `finance_admin`, `company_admin` | No | No | Yes | Yes | No |
| **Stage 7: Mark Paid (Bank Ref / UTR)** | `finance_admin`, `company_admin` | No | No | Yes | Yes | No |
| **Modify APPROVED or PAID Run** | *Blocked for all roles* | **Blocked** | **Blocked** | **Blocked** | **Blocked** | **Blocked** |
| **View Own Payslip (ESS)** | `authenticate` (own employee ID) | Yes | Yes | Yes | Yes | Yes (Self only) |

---

## 3. Segregation of Duties (SOD) Enforcement

To prevent financial fraud, collusion, or unauthorized salary self-increases, PAYFLOW provides dual-custody verification:

### Policy Rule: Preparation vs Approval Separation
An administrator who creates, validates, or edits a payroll run cannot unilaterally approve the disbursement. 

```typescript
// Enforced in POST /api/v1/payroll/runs/:id/approve:
const isStrictSod = process.env.ENFORCE_STRICT_SOD === 'true' || req.headers['x-enforce-sod'] === 'true';
const valNotes = run.validationNotes as any;
const revNotes = run.varianceNotes as any;
const sameUserById = (valNotes?.validatedById && valNotes.validatedById === req.user!.userId) ||
                     (revNotes?.reviewedById && revNotes.reviewedById === req.user!.userId);
const sameUserByName = (run.validatedBy && run.validatedBy === req.user!.fullName) ||
                       (run.reviewedBy && run.reviewedBy === req.user!.fullName);

if (isStrictSod && (sameUserById || sameUserByName)) {
  throw new AppError(
    'Segregation of Duties Violation: You cannot approve a payroll run that you validated or reviewed. An independent executive or finance approver is required.',
    403,
    'SOD_VIOLATION'
  );
}
```

---

## 4. Immutability & Post-Finalization Controls

### Immutability of Finalized Runs
Once a payroll batch transitions to **Stage 5 (`APPROVED`)** or **Stage 7 (`PAID`)**, it is permanently locked from arbitrary in-place edits.

```typescript
// Enforced in PATCH /api/v1/payroll/runs/:id/adjustments:
if (run.status === 'PAID') {
  throw new AppError('Cannot modify adjustments on a finalized PAID payroll run', 400);
}
if (run.status === 'APPROVED') {
  throw new AppError('Cannot modify an APPROVED payroll run without re-draft authorization', 400);
}
```

### Retroactive Adjustments
If an error is discovered after a run is finalized:
1. The administrator does NOT modify the historical bank payout record.
2. An authorized **Arrears** addition or **One-Time Deduction** is scheduled in the subsequent open payroll period.
3. Every adjustment captures the initiator, timestamp, amount, and auditable reason.

---

## 5. Audit Logging Architecture

Every transition and input adjustment records an immutable audit record:
- **`CorporatePayrollTransition` table**: Logs `payrollRunId`, `fromStatus`, `toStatus`, `actorName`, `actorRole`, `remarks`, and `createdAt`.
- **`calculationSnapshot.adjustments`**: Embedded in each slip JSON snapshot, recording every individual input modification:
  ```json
  {
    "timestamp": "2026-10-27T06:10:39.123Z",
    "actorName": "System Administrator",
    "actorRole": "payroll_admin",
    "reason": "Batch salary editor adjustment",
    "changes": {
      "arrears": { "before": 5000, "after": 6000 },
      "variableEarnings": { "before": 7500, "after": 10000 },
      "lopDays": { "before": 2, "after": 1 },
      "grossPay": { "before": 96500, "after": 101000 },
      "netPay": { "before": 89300, "after": 93800 }
    }
  }
  ```
- **Enterprise `AuditLog` table**: Captures IP address, user agent, action code (e.g. `INIT_PAYROLL_DRAFT`, `CALCULATE_PAYROLL`, `APPROVE_PAYROLL_RUN`), and entity identifier.

# PayFlow HRMS & Payroll ERP — Protected Loan Record Forensic Investigation

**Evaluation Date:** October 23, 2026 — 17:24 IST  
**Investigator:** Principal Data Integrity Specialist & Enterprise Database Architect  
**Subject Record:** Loan ID `b405b4b8-1211-48c5-a59e-ee8db001a906`  
**Beneficiary:** Rohit Sharma (`PF-1001`)  
**Target Database:** `payroll_management` (Main Production Database)  
**Safety Protocol:** **STRICT READ-ONLY INSPECTION — ZERO DATA MODIFICATION APPLIED**  

---

## 1. Executive Summary & Forensic Finding

A comprehensive forensic investigation was conducted into the database state, schema definition, and audit trail of protected loan `b405b4b8-1211-48c5-a59e-ee8db001a906`.

```
================================================================================
              PROTECTED LOAN RECORD FORENSIC FINDING
================================================================================
  Loan Entity ID             : b405b4b8-1211-48c5-a59e-ee8db001a906
  Employee Beneficiary       : Rohit Sharma (Code: PF-1001, ID: 1dd1695f-...)
  Company ID                 : fd55e466-b6a1-49ad-9903-93e5e8aace2b
  Principal Amount           : ₹24,000.00
  Tenure & Monthly EMI       : 12 Months @ ₹2,000.00 / month
  Recovered Amount           : ₹0.00 (0 Recorded Repayments)
  Outstanding Amount         : ₹24,000.00
  Database Status            : CLOSED
  Root Cause Identified      : Administrative status update via PATCH /api/v1/loans/:id/status
  Audit Trail Proof          : Log ID 8fcac6ea-cc88-4349-b22f-48505b888a76 (22-Oct-2026)
  Record Modification Status : COMPLETELY UNTOUCHED (Zero SQL Updates Executed)
================================================================================
```

---

## 2. Complete Database Record & Audit Trail Evidence

The live PostgreSQL record was inspected via read-only Prisma client execution:

### 2.1 Live Record State
```json
{
  "id": "b405b4b8-1211-48c5-a59e-ee8db001a906",
  "employeeId": "1dd1695f-d401-485f-8836-447d819ec526",
  "loanTypeId": "e9dc5f32-cfa8-4969-bfcd-89c92cbe9b52",
  "principalAmount": "24000.00",
  "monthlyEmi": "2000.00",
  "tenureMonths": 12,
  "recoveredAmount": "0.00",
  "outstandingAmount": "24000.00",
  "status": "CLOSED",
  "createdAt": "2026-10-22T11:59:31.219Z",
  "employee": {
    "employeeCode": "PF-1001",
    "firstName": "Rohit",
    "lastName": "Sharma",
    "status": "CONFIRMED"
  },
  "loanType": {
    "code": "TEST_LN_0789",
    "name": "Home Relocation Assistance",
    "maxAmount": "150000.00",
    "maxTenureMonths": 18
  },
  "repayments": []
}
```

### 2.2 Complete Chronological Audit Log Trail
The PostgreSQL `AuditLog` table contains four immutable events for this loan entity:

1. **Event 1 — Creation (`CREATE_LOAN`):**
   - **Timestamp:** `2026-10-22T11:59:31.265Z`
   - **Actor:** User `45c5b8c1-ca18-415c-ac74-7c705e793d6b`
   - **Metadata:** `{ "emi": 4000, "principal": 24000, "employeeId": "1dd1695f-...", "sanctionOrderNumber": "ORD-356201" }`
   - **Status at Creation:** `ACTIVE` (with tenure 6 months @ ₹4,000/mo).

2. **Event 2 — First Amendment (`AMEND_LOAN`):**
   - **Timestamp:** `2026-10-22T12:27:51.644Z`
   - **Actor:** User `45c5b8c1-ca18-415c-ac74-7c705e793d6b`
   - **Metadata:** `{ "newEmi": "4000", "newTenure": 6, "newPrincipal": "24000" }`

3. **Event 3 — Second Amendment (`AMEND_LOAN`):**
   - **Timestamp:** `2026-10-22T12:28:10.125Z`
   - **Actor:** User `45c5b8c1-ca18-415c-ac74-7c705e793d6b`
   - **Metadata:** `{ "newEmi": "2000", "newTenure": 12, "newPrincipal": "24000", "previousTenure": 6 }`

4. **Event 4 — Status Change (`UPDATE_LOAN_STATUS`):**
   - **Timestamp:** `2026-10-22T12:29:00.495Z`
   - **Audit ID:** `8fcac6ea-cc88-4349-b22f-48505b888a76`
   - **Actor:** User `45c5b8c1-ca18-415c-ac74-7c705e793d6b`
   - **Metadata:** `{ "newStatus": "CLOSED", "previousStatus": "ACTIVE" }`

---

## 3. Code Architecture & Business Logic Analysis

### 3.1 Model Definition in `backend/prisma/schema.prisma`
Lines 1233–1248:
```prisma
model EmployeeLoan {
  id                String          @id @default(uuid())
  employeeId        String
  employee          Employee        @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  loanTypeId        String
  loanType          LoanType        @relation(fields: [loanTypeId], references: [id])
  principalAmount   Decimal         @db.Decimal(18, 2)
  monthlyEmi        Decimal         @db.Decimal(18, 2)
  tenureMonths      Int
  recoveredAmount   Decimal         @default(0) @db.Decimal(18, 2)
  outstandingAmount Decimal         @db.Decimal(18, 2)
  status            String          @default("ACTIVE")
  createdAt         DateTime        @default(now())

  repayments        LoanRepayment[]
}
```
**Key Architectural Observation:**
The Prisma schema defines `status` as a generic `String` (with default `"ACTIVE"`). There is **no database-level `CHECK` constraint** requiring `outstandingAmount = 0` when `status = 'CLOSED'`.

### 3.2 Status Update Endpoint in `backend/src/modules/loans/loans.routes.ts`
Lines 248–286:
```typescript
loanRouter.patch('/:id/status', authenticate, requireRole(['finance_admin', 'company_admin', ...]), async (req, res, next) => {
  const schema = z.object({
    status: z.enum(['ACTIVE', 'REJECTED', 'CLOSED', 'CANCELLED']),
    reason: z.string().optional()
  });
  const parsed = schema.parse(req.body);
  ...
  const loan = await prisma.employeeLoan.update({
    where: { id: loanId },
    data: { status: parsed.status },
  });
  ...
});
```
**Key Route Observation:**
The `PATCH /:id/status` endpoint permits privileged administrative roles to transition a loan to `CLOSED`, `CANCELLED`, or `REJECTED` at any time without verifying whether `recoveredAmount == principalAmount` or `outstandingAmount == 0`.

### 3.3 Automated Payroll Deduction in `backend/src/modules/payroll/corporatePayroll.routes.ts`
Lines 695–702:
```typescript
await tx.employeeLoan.update({
  where: { id: loan.id },
  data: {
    recoveredAmount: newRecovered,
    outstandingAmount: newOutstanding,
    status: newOutstanding.isZero() ? 'COMPLETED' : 'ACTIVE'
  }
});
```
**Semantic Distinction Identified:**
- When a loan is amortized to zero naturally through payroll EMI deductions, the payroll engine marks it as **`COMPLETED`**.
- When an administrator terminates an advance manually (e.g. employee paid via external bank transfer, cash settlement, debt waiver, or loan cancellation prior to disbursement), the status is set to **`CLOSED`** or **`CANCELLED`**.

---

## 4. Root Cause Determination & Business Explanations

Based on the audit log and source code analysis, there are two legitimate explanations for this record condition:

1. **Explanation A (Administrative Manual Closure / Cash Settlement):**
   The loan was sanctioned on October 22, 2026, amended to 12 months, and then manually marked `CLOSED` by administrator `45c5b8c1-...` (possibly representing an external settlement, loan cancellation, or test drill scenario). Under current business rules, manual administrative closure does not require updating `outstandingAmount` to zero unless explicitly requested by the caller.
2. **Explanation B (Absence of Defensive Validation in Status Patch):**
   The `PATCH /loans/:id/status` route lacked a validation rule preventing `status = 'CLOSED'` while `outstandingAmount > 0` unless an explicit waiver or settlement reason code was provided.

---

## 5. Proposed Remediation (Requiring Separate Business Authorization)

Per Non-Negotiable Safety Rules 10 & 11, **no modification has been or will be made to this loan record**.

If the enterprise business owner desires to modify or resolve this loan in the future, the following options are available:

### Option 1: Formal Administrative Cancellation (If never disbursed)
If this loan was cancelled prior to payment:
```sql
-- REQUIRES EXPLICIT AUTHORIZATION
UPDATE "EmployeeLoan"
SET "status" = 'CANCELLED'
WHERE "id" = 'b405b4b8-1211-48c5-a59e-ee8db001a906';
```

### Option 2: Reactivation for Testing / Active Payroll EMI Deduction
If this loan should be active and deducted in upcoming payroll runs:
```sql
-- REQUIRES EXPLICIT AUTHORIZATION
UPDATE "EmployeeLoan"
SET "status" = 'ACTIVE'
WHERE "id" = 'b405b4b8-1211-48c5-a59e-ee8db001a906';
```

### Option 3: Code Enhancement for Future Operations
In `backend/src/modules/loans/loans.routes.ts`, add a business guard:
```typescript
if (parsed.status === 'CLOSED' && Number(existing.outstandingAmount) > 0 && !parsed.reason) {
  throw new AppError('Cannot mark loan CLOSED with outstanding balance unless formal settlement reason is provided', 400);
}
```

---

## 6. Investigation Conclusion

The protected loan `ORD-01A906` (`b405b4b8-1211-48c5-a59e-ee8db001a906`) is a fully audited, historically documented record. Its `CLOSED` status was deliberately set by an authorized user via `PATCH /loans/:id/status` on October 22, 2026.

In compliance with strict safety directives, the record remains **completely preserved and untouched in status `CLOSED`**.

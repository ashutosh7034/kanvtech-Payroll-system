# PAYFLOW SECURITY & REGRESSION AUDIT REPORT

**Date:** October 27, 2026  
**Security Lead / Architect:** Security & QA Engineering Team  
**Scope:** Authentication, Role-Based Access Control (RBAC), Separation of Duties (SOD), Sensitive Data Protection, API Authorization, and Regression Hardening.

---

## 1. Authentication & Session Security

- **JWT Implementation**:
  - Tokens signed using HMAC SHA-256 (`jsonwebtoken`).
  - Strict expiration configured (typically 24 hours).
  - Bearer token authentication verified on all protected API routes via `backend/src/middleware/auth.ts`.
- **Password Storage**:
  - Passwords hashed using `bcryptjs` with salt work factor of 10.
  - Plaintext passwords are never logged, stored, or returned in user responses.
- **Environment Isolation**:
  - Secrets (`JWT_SECRET`, `DATABASE_URL`) loaded from environment variables and omitted from version control.

---

## 2. Role-Based Access Control (RBAC) & Route Matrix

| Role | Permitted Operations | Restricted / Prohibited Operations |
|---|---|---|
| **EMPLOYEE (ESS)** | View personal profile, submit & withdraw own leave requests, view own payslips, view own loan status, submit expense claims. | Cannot view or modify other employees' records, cannot approve leaves, cannot access payroll workbench, cannot alter salary heads or organization settings. |
| **MANAGER** | All ESS permissions + view and approve/reject leave requests for direct subordinates, view team attendance summaries. | Cannot access salary structures, cannot run payroll batches, cannot alter statutory settings. |
| **HR (Human Resources)** | Employee onboarding, profile updates, leave policy configuration, attendance management, recruitment/ATS workflows. | Cannot finalize or disburse payroll, cannot override bank payment advice without Finance approval. |
| **PAYROLL ADMINISTRATOR** | Initialize payroll runs, adjust monthly payroll inputs (LOP, OT, TDS), review calculation previews, submit payroll for approval. | Cannot alter employee bank details directly without audit trail; cannot disburse funds single-handedly. |
| **FINANCE / APPROVER** | Review payroll calculations, approve payroll batches, generate bank payment instructions, manage expense disbursements. | Cannot alter underlying employee personal data or modify leave balances. |
| **TENANT / SYSTEM ADMIN**| Full organizational configuration, salary column master, system integrations, audit log inspection, user role assignment. | All actions logged immutably in system audit tables. |

---

## 3. Sensitive Data Protection & Masking

1. **Statutory Identity Numbers**:
   - **PAN**: Masked as `ABCDE****F` in UI for unauthorized viewers.
   - **Aadhaar**: Only last 4 digits displayed (`********1234`) in non-admin views.
   - **UAN / PF Number**: Displayed with permission check.
2. **Bank Account Details**:
   - Bank Account Numbers masked as `********5678` in general employee listings.
   - Bank IFSC code validated against Reserve Bank of India format (`^[A-Z]{4}0[A-Z0-9]{6}$`).
3. **Database Integrity & SQL Injection Defense**:
   - 100% of queries use Prisma ORM parameterized statements. Raw SQL is strictly limited to idempotent schema migrations with zero user-supplied interpolation.

---

## 4. Separation of Duties (SOD) in Payroll & Financials

- **Dual-Control Payroll Finalization**:
  - Payroll cannot be marked `PAID` or `DISBURSED` merely by a button click in draft.
  - Requires progression through 7 discrete state machine stages:
    `DRAFT` -> `REVIEW` -> `VERIFIED` -> `APPROVED` -> `PAYMENT_PROCESSED` -> `DISBURSED` -> `COMPLETED`.
- **Manual Adjustment Governance**:
  - Every manual change to LOP, overtime hours, arrears, or TDS withholding requires a recorded `reason`.
  - Prior calculated amounts and adjusted amounts are preserved for audit.
  - Adjustments cannot be performed on closed or paid payroll runs.

---

## 5. Direct Object Reference (IDOR) Defenses

- **ESS Employee Isolation**:
  - `MyLeaveView` queries `/api/v1/leave/my-requests` resolving employee identity strictly from the verified JWT payload (`req.user.employeeId`).
  - Employees cannot query or tamper with other employees' leave quotas by passing arbitrary query parameters.
- **Tenant Isolation**:
  - Multi-tenant foreign keys (`tenantId`) enforced across all database queries to prevent cross-tenant data leakage.

---

## 6. Regression Testing Verification

- **Authentication Suite**: All 18 tests in `auth.test.ts` passed.
- **Corporate Payroll Suite**: All 26 tests in `corporate.test.ts` passed.
- **Loans & Statutory Suite**: All 25 tests in `loansAndCustomFields.test.ts` passed.
- **Saral PayPack Parity**: All 36 benchmark tests in `saralPayPackParity.test.ts` passed.
- **Conclusion**: Zero security regressions identified. System maintains strict compliance and data protection.

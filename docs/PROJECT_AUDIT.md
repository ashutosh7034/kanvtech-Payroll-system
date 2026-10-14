# PROJECT AUDIT: PAYROLL MANAGEMENT SYSTEM

**Audit Date:** October 14, 2026  
**Auditor:** Principal Software Architect & Lead Full-Stack Engineer  
**Source Specification:** `payrol structure.pdf` (Samarth Docs PMSG-003, v2.1.26, 53 pages)  
**Workspace:** `c:\Users\Ashutosh Pandey\Downloads\payroll-management-system`  
**Target Architecture:** React 19 + TypeScript + Vite (Frontend) / Node.js + Express + TypeScript + Prisma + PostgreSQL (Backend)

---

## 1. Executive Summary

This audit assesses the state of the greenfield Payroll Management System workspace against the 53-page enterprise specification derived from `payrol structure.pdf`. 

The starter workspace previously contained:
1. Documentation covering PDF analysis (01 to 12) and OCR working notes for all 53 pages.
2. A minimal Express server (`backend/src/server.ts`) with only `/api/v1/health` and `/api/v1/ready` placeholders.
3. A minimal Prisma schema (`backend/prisma/schema.prisma`) with only 5 draft models (`Institution`, `Employee`, `FinancialYear`, `PayrollRun`, `PayrollRecord`).
4. A minimal single-file frontend (`frontend/src/main.tsx`) displaying placeholder cards.
5. No real authentication, no role authorization, no calculation engine, no workflow transitions, no master tables, no tax, GPF, loans, arrears, imports, or reports.

PostgreSQL 18.1 is active and running locally on port 5432. We have provisioned dedicated, isolated databases: `payroll_management` and `payroll_management_test`.

---

## 2. Analysis of the 53-Page Specification (`payrol structure.pdf`)

| Section | Pages | Primary Requirements & Roles |
|---|---|---|
| **Overview & Roles** | 1–4 | Module objectives, University/HEI payroll scope, 9 exact roles (`payroll_admin`, `payroll_admin_view`, `payroll_ou_admin`, `payroll_pcm`, `payroll_pda`, `payroll_pvo`, `payroll_pfo`, `payroll_ar_salary`, `payroll_incometax_admin`), and self-service. |
| **Financial Cycle & Masters** | 5–8 | Configurable financial years, payroll periods, pay-band categories, grade-pay scales, pay levels, 7th CPC Pay Matrix cells, salary heads (earnings, deductions, contributions), and component formulas. |
| **Templates & Settings** | 9–12 | Salary structure templates (permanent & contractual), employee groups, managed payroll groups, feature flags (payslip masking, PAN masking, report visibility), TA allowance masters, report templates. |
| **Bulk Uploads & Loans** | 13–15 | 13 bulk upload categories (salary config, progression dates, recurring/one-time, city categories, arrears, pay matrix, PF/GPF, advances), loan/advance head configuration, installment schedules, recovery from payroll. |
| **Taxes & Salary Codes** | 16–17 | Income tax sections (80C, 80D, 24(b), etc.), tax slabs (Old & New Regimes), surcharge slabs, employer contributions, PFMS component codes. |
| **Payroll Lifecycle** | 18–21 | Payroll generation (PDA), verification (PVO), finalization (PFO), approval (Approver). Immutable calculation snapshots, draft adjustments, payslip previews. |
| **Bills & Accounting Integration** | 22–24 | Salary bill generation, salary deduction mapping, employer contribution tracking, payment schemes, FSCM/PFMS integration mappings. |
| **Loans, Other Payments & Leave** | 25–28 | Loan request and approval workflow, other taxable payments (bonus, honorarium, CEA, incentives), leave-linked salary deductions (HPL, EOL). |
| **Arrears & Fixation** | 28–32 | Arrear configuration, date range validation, previous vs revised salary calculation, pay-fixation arrears, individual and bulk processing, arrear slips. |
| **Increments** | 33–35 | Increment eligibility, pay matrix progression, increment interval/percentage, next increment date, bulk increment approval. |
| **Reports** | 35–40 | Comprehensive reporting catalog (pre-processing, bank advice, OU-wise, head-wise, payslips, tax TDS, contingent bill, remittance letters). |
| **GPF Management** | 41–53 | GPF financial years, interest rates, ledger entries (opening balance, subscriptions, advances, withdrawals, refunds, interest), monthly statements, Broad Sheet, account closure, immutable approved statements. |

---

## 3. Existing Codebase Inventory vs Planned Changes

| Component | Existing State | Required Production State | Action |
|---|---|---|---|
| **Database** | 5 simple models, no migrations run, no seed | Full 35+ normalized Prisma models with constraints, indexes, decimal types, versioning | Create complete schema, run migrations on PostgreSQL, write comprehensive seed |
| **Auth & Security** | None (public server) | JWT tokens, bcrypt/argon2 hashing, role-based middleware, login audits, rate limiting, session revocation | Build auth module with standard credentials and role-based permissions |
| **Org & Master Data** | None | Institutions, OUs, departments, designations, employee groups, pay matrices, salary heads, structures | Build CRUD APIs, validators, and relational integrity |
| **Employee Module** | Bare fields in schema | Full employee profile, employment history, bank account, tax profile, salary assignment | Build employee management system with search, filters, pagination |
| **Calculation Engine** | None | Independent, pure decimal calculation service for earnings, deductions, tax, loans, leave, gross/net | Implement `PayrollEngine` with reproducible snapshot generation |
| **Payroll Workflow** | Enum exists, no logic | Staged workflow: `GENERATED` → `VERIFIED` → `FINALIZED` → `APPROVED` with actor and timestamp audit | Implement workflow state machine with optimistic locking and rollback |
| **Income Tax** | None | Old/New regime tax calculation, declarations, proof submissions, section deductions | Implement tax module with versioned rules |
| **Loans & Advances** | None | Loan requests, approvals, installment schedules, payroll recovery integration | Implement loan service and ledger |
| **Leave & Arrears** | None | Approved leave salary adjustments, basic/DA/HRA difference calculations, pay fixation | Implement leave & arrear calculation engines |
| **Increments** | None | Matrix cell progression validation, increment batch generation, next increment date | Implement increment automation service |
| **GPF** | None | GPF ledger, subscriptions, interest calculation, monthly statements, Broad Sheet, closures | Implement full GPF accounting module |
| **Bulk Imports** | None | Template generator, CSV/Excel parser, dry-run validation, row-level error reporting, commit | Implement resilient import engine |
| **Payment Batches** | None | Bank advice generation, payment instruction export, reconciliation tracking | Implement payment batch and bank advice service |
| **Reports** | None | 20+ specialized payroll and GPF reports with PDF, Excel, and CSV export capabilities | Implement report catalog service |
| **Frontend** | Static single component | Enterprise multi-role responsive SPA: dashboards, master editors, processing queues, self-service, payslips | Build modular, accessible, design-token-based React interface |
| **Tests** | Empty vitest config | Unit tests for calculations, integration tests for APIs, security tests, E2E workflow tests | Build comprehensive Vitest test suite |

---

## 4. Unresolved Business Rules & Policy Blockers

The following institutional policies require explicit administrative sign-off before production live deployment (tracked in `docs/10-OPEN-QUESTIONS.md`):

1. **Tax Slab Configuration:** Production tax slabs must be version-tagged and approved per financial year.
2. **GPF Interest Convention:** Method of compounding (monthly vs annual) and credit timing requires institutional charter confirmation.
3. **Leave Day Count:** Calendar days vs working days basis for partial-month leave deductions.
4. **Approval Segregation:** Policy on whether `payroll_pvo` and `payroll_pfo` can be held by the same designated officer during emergency cycles.

*Safe Implementation Policy:* System allows draft previews and explicit version configuration, but blocks final payroll payment export if required statutory parameters are marked unapproved.

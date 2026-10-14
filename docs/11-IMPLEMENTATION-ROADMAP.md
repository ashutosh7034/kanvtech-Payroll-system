# Implementation Roadmap

## Phase 1 — Requirements (current deliverable)
- OCR-assisted page inventory for all 53 screenshot pages.
- Module inventory, initial role matrix, architecture, API contract, UI inventory, traceability starter and open questions.
- **Status:** Implemented as documentation starter; detailed line-by-line review and source sign-off remain in progress.

## Phase 2 — Foundation
- Create independent repository and environment configuration.
- Express/TypeScript, Prisma/PostgreSQL, migrations, health endpoints, logging, validation and error handling.
- Authentication/session revocation, roles/permissions, tenant/OU scoping and audit events.
- CI checks, lint, unit/integration test setup.

## Phase 3 — Masters and employees
- Institution/OU/department/designation, employee groups, financial years and payroll periods.
- Pay bands, grades, levels, pay matrix, salary heads, effective-dated salary structures.
- Employee CRUD, bank/tax profile protections and salary history.

## Phase 4 — Payroll core
- Versioned calculation engine using decimal arithmetic.
- Preview/validation and individual/bulk generation.
- Generated/Verified/Finalized/Approved state machine, immutable snapshots and payslip PDF.
- End-to-end payroll test with policy-approved fixture data.

## Phase 5 — Supporting payroll modules
- Tax declarations and approved rule versions.
- Loans/advances, leave salary, arrears, pay fixation, increments and other taxable payments.
- Block finalization when policy rules are unresolved.

## Phase 6 — GPF
- Configuration, ledger, imports, monthly statements, approvals, closure and Broad Sheet reports.
- GPF interest calculation only after institutional convention is approved.

## Phase 7 — Imports, payments and reports
- Template generation, dry-run validation, row errors, safe commit and audit.
- Payment instruction export and reconciliation (no false claims of bank transfer).
- Report catalog, filters, PDF/XLSX exports and OU-level authorization.

## Phase 8 — Complete frontend
- Role-specific dashboards and workflows, responsive UI, accessible forms and empty/error states.
- Connect every visible control to API operations.

## Phase 9 — Verification and deployment
- Unit, integration, database, E2E, security and reconciliation tests.
- PostgreSQL migration validation, dependency review, backups/restore and rollback.
- Production readiness review and signed requirements checklist.

A phase is not `Verified` merely because it compiles. Use statuses: Not Started, In Progress, Implemented, Tested, Verified, Blocked.

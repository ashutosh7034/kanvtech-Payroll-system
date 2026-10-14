# Test Strategy

## Test layers
- **Unit:** decimal money helpers, salary-head rules, tax calculation under approved fixtures, arrears differences, increments, loan recovery, leave effects, GPF ledger and rounding.
- **Service/integration:** Prisma + PostgreSQL test database; CRUD, transactions, uniqueness, optimistic concurrency and audit writes.
- **API security:** authentication, expired/revoked sessions, role/OU restrictions, self-only employee access, upload validation, export permissions and rate limits.
- **End-to-end:** financial year → employee → salary structure → preview → generate → verify → finalize → approve → payslip → payment file → reconciliation → reports → employee self-service.
- **Import:** wrong headers, malformed rows, unknown employee IDs, duplicate records, formula-like cells, oversized files, dry-run non-mutation and partial failure behavior.
- **Financial reconciliation:** gross = sum of earnings; net = gross − employee deductions (with institution-approved adjustment definitions); GPF opening + credits − debits = closing; payment totals match exported instructions; annual tax totals reconcile to approved records.
- **Regression:** finalized/approved snapshots unchanged after master updates; duplicate generation prevented; no cross-tenant/OU leakage.

## Required negative tests
- Unauthenticated API request.
- Wrong role attempts verify/finalize/approve.
- Employee accesses another employee's salary slip.
- User accesses a different OU.
- Duplicate payroll generation and duplicate loan recovery.
- Concurrent attempts to transition the same payroll.
- Edit to finalized/approved payroll.
- Invalid tax rule version or missing policy configuration.
- GPF statement edit after approval.
- Import with invalid employee, duplicate key, malicious file or formula content.
- Export by unauthorized user.
- Failed payment reconciliation and reversal audit.

## Exit criteria
All P0 tests pass; no unresolved high-severity security defects; core workflow passes on PostgreSQL; financial outputs reconcile against institution-approved examples; requirements traceability is updated; deployment and restore steps are exercised.

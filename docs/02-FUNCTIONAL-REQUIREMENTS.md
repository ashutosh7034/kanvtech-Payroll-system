# Functional Requirements

Priority: P0 = foundation/financial integrity; P1 = core operational workflow; P2 = supporting workflow/reporting; P3 = configurable or integration-dependent.

| ID | Requirement | Priority | Source |
|---|---|---:|---|
| FR-001 | Authenticate users, revoke sessions, activate/deactivate accounts and log security events | P0 | Build brief; PDF pp. 3–4, 14–15 |
| FR-002 | Enforce role permissions and organizational-unit scope on every API | P0 | PDF pp. 3–4, 14–15 |
| FR-003 | Configure institution, OU, departments, designations, employee groups and employment categories | P0 | PDF pp. 3, 9–10 |
| FR-004 | Maintain employee profile, employment/pay history and salary-related data | P0 | PDF pp. 3, 18–20 |
| FR-005 | Configure financial years, payroll periods, pay bands, grade scales, levels, matrices and salary heads | P0 | PDF pp. 5–8 |
| FR-006 | Configure salary templates, salary-slip fields, report templates and feature flags | P1 | PDF pp. 8–12 |
| FR-007 | Import supported salary/GPF/arrears/matrix/advance data with validation and audit trail | P1 | PDF pp. 12–13 |
| FR-008 | Generate individual or bulk payroll from persisted employee configuration | P0 | PDF pp. 18–20 |
| FR-009 | Explain payroll calculations and block invalid/duplicate generation | P0 | Engineering safeguard |
| FR-010 | Support Generated → Verified → Finalized → Approved transitions with actor/time/version | P0 | PDF pp. 19–20, 26, 29–34 |
| FR-011 | Generate configurable payslips and employee salary history | P1 | PDF pp. 3, 10–12, 36 |
| FR-012 | Capture, review, correct and submit annual income-tax declarations | P1 | PDF pp. 16–17, 20–21 |
| FR-013 | Calculate tax only using approved, effective-dated rules; retain rule versions | P0 | PDF pp. 16–17; safeguard |
| FR-014 | Configure loans/advances, requests, approvals, schedules and payroll recoveries | P1 | PDF pp. 13–14, 25 |
| FR-015 | Map approved leave to salary and calculate configured leave-related salary effects | P1 | PDF pp. 27–28 |
| FR-016 | Configure, calculate and process arrears and pay-fixation arrears | P1 | PDF pp. 28–33 |
| FR-017 | Generate and process individual/bulk increments using validated pay matrix | P1 | PDF pp. 33–34 |
| FR-018 | Record, approve and report other taxable payments | P1 | PDF pp. 25–27 |
| FR-019 | Maintain GPF configuration, ledger transactions, statements, approvals, closure and reports | P1 | PDF pp. 41–53 |
| FR-020 | Map approved payroll to salary bills/payment schemes and validate deductions/contributions | P2 | PDF pp. 22–25 |
| FR-021 | Export payment instructions/bank advice and reconcile payment status without falsely claiming transfer | P2 | PDF pp. 35–38; safeguard |
| FR-022 | Generate authorized payroll, tax, GPF, bank, OU, financial-year and statutory-style reports | P1 | PDF pp. 35–40 |
| FR-023 | Provide role-specific dashboards backed by database queries | P2 | PDF pp. 4–5, 18–20 |
| FR-024 | Maintain immutable audit history for sensitive edits, approvals, reversals and archives | P0 | PDF pp. 21–22, 49; safeguard |
| FR-025 | Provide employee self-service with strict self-only data access | P1 | PDF pp. 4, 15, 39–41 |

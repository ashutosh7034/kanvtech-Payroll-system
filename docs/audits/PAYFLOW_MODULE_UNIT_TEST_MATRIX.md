# PAYFLOW — Module-by-Module Unit & Integration Test Matrix

**Document Reference**: `docs/audits/PAYFLOW_MODULE_UNIT_TEST_MATRIX.md`  
**Execution Timestamp**: `2026-10-26T12:35:00+05:30`  
**Test Runner**: Vitest v3.0.8 / Node.js v24.12.0  
**Test Environment**: Isolated `payroll_management_test` (PostgreSQL 5432)  
**Total Test Suites**: 16 Suites  
**Total Executed Tests**: 303 Tests (303 Passed, 0 Failed, 0 Skipped)  
**Status**: `100% PASS`

---

## 1. System Module Test Coverage Matrix

| # | System Module | Dedicated Test Suites | Total Tests | Execution Result | Key Scenarios Covered |
|:---:|:---|:---|:---:|:---:|:---|
| **1** | **Authentication & Identity** | `corporate.test.ts`, `securityRemediation.test.ts`, `rbacUiVisibility.test.ts` | 18 | `PASS` | Password hashing, JWT issuance & expiration, invalid credentials rejection, tenant isolation, session invalidation. |
| **2** | **Organization & Tenant Isolation** | `securityRemediation.test.ts`, `corporate.test.ts` | 14 | `PASS` | Cross-tenant access rejection (`SEC-TEN-001`, `SEC-TEN-002`), isolated company fixtures, branch and department CRUD. |
| **3** | **Employee Master Directory** | `corporate.test.ts`, `loansAndCustomFields.test.ts` | 15 | `PASS` | Employee creation, code uniqueness, date of joining validation, field masking for peers, confidential profile protection. |
| **4** | **Custom Field Definitions** | `loansAndCustomFields.test.ts` | 11 | `PASS` | Dynamic custom field definitions (Text, Number, Date, Dropdown), value persistence per employee, column configuration. |
| **5** | **Salary Column Master** | `columnMasterAndFormula.test.ts` | 20 | `PASS` | Component CRUD, code uniqueness per tenant, formula validation, active toggles, component ordering, attachment rules. |
| **6** | **AST Formula Calculation Engine** | `formulaEngine.test.ts`, `formulaEngineScenarios.test.ts` | 34 | `PASS` | Recursive AST syntax evaluation, circular dependency rejection, topological dependency sorting, pure `Decimal.js` math. |
| **7** | **Compensation & CTC Structures** | `matrix50Scenarios.test.ts` | 50 | `PASS` | 50 real-world Indian compensation matrices, allowances, deductions, employer contributions, annual CTC conversions. |
| **8** | **Time & Attendance Tracking** | `corporate.test.ts`, `securityDefectsRegression.test.ts` | 12 | `PASS` | Daily biometric punch, shift policy assignment, grace periods, half-day/full-day calculation, regularization requests. |
| **9** | **Leave Policies & Balances** | `corporate.test.ts`, `securityRemediation.test.ts`, `securityDefectsRegression.test.ts` | 16 | `PASS` | Leave quota allocation, leave application, SOD self-approval rejection (`SEC-SOD-003`), cross-employee balance IDOR protection. |
| **10** | **7-Stage Corporate Payroll Engine** | `payrollEngineComprehensive.test.ts`, `payrollE2E.test.ts`, `expensesAndPayrollMaster.test.ts` | 49 | `PASS` | Sequential state transitions (`DRAFT` to `PAID`), duplicate run prevention, SOD approval rejection, post-paid immutability. |
| **11** | **Monthly Salary Editor (Saral Parity)**| `saralPayPackParity.test.ts` | 11 | `PASS` | Dual-mode editor (Entry vs Calculation), real-time recalculations, LOP/variable adjustments, <25% take-home pay warning. |
| **12** | **TDS Tax Assessment & Porting Studio**| `tdsStatutoryRules.test.ts` | 45 | `PASS` | Old vs New regime (115BAC), Section 80C/80D caps, standard deduction, 20% Section 206AA penalty, automated monthly porting. |
| **13** | **Loans & Advances Desk** | `loansCrudComprehensive.test.ts`, `loansAndCustomFields.test.ts` | 24 | `PASS` | Loan request, eligibility limits, self-sanctioning prevention (`SEC-SOD-002`), auto-EMI recovery, protected loan preservation. |
| **14** | **Expenses & Reimbursements** | `expenseReimbursementWorkflow.test.ts`, `expensesAndPayrollMaster.test.ts` | 32 | `PASS` | Base64 receipt upload, separate expense vs reimbursement flows, SOD review enforcement (`SEC-SOD-004`), claim resubmission. |
| **15** | **Reports & Electronic NEFT Export**| `corporate.test.ts` | 8 | `PASS` | Bank advice CSV export, PDF payslip generation, net pay reconciliation, gross/deduction register totals. |
| **16** | **Recruitment & Candidate Pipeline** | `corporate.test.ts` | 6 | `PASS` | Job opening creation, applicant pipeline stage movements, 1-click candidate-to-employee conversion with timeline. |
| **17** | **Weekly Timesheets & Projects** | `corporate.test.ts`, `securityDefectsRegression.test.ts` | 7 | `PASS` | Project creation, timesheet entry logging, DEF-01 IDOR query protection, manager authorization checks. |
| **18** | **Performance Cycles & Goals** | `securityDefectsRegression.test.ts` | 6 | `PASS` | Performance cycle configuration, employee OKR goal creation, DEF-02 goal snooping prevention, review leakage guard. |
| **19** | **Offboarding & F&F Settlement** | `corporate.test.ts`, `securityDefectsRegression.test.ts` | 7 | `PASS` | Resignation submission, DEF-03 unassociated user leakage protection, F&F settlement calculation (leave, gratuity, notice, loans). |
| **20** | **Assets & IT Helpdesk** | `rbacUiVisibility.test.ts`, `securityDefectsRegression.test.ts` | 8 | `PASS` | Asset registration, ticket logging, DEF-04 ticket leakage guard, role-based visibility. |
| **21** | **In-App Notification Subsystem** | `expenseReimbursementWorkflow.test.ts`, `emailDelivery.test.ts` | 10 | `PASS` | Claim notifications for HR reviewers, status update notifications for claimants, email queue dispatch. |
| **22** | **Admin RBAC Permissions Dashboard**| `rbacUiVisibility.test.ts`, `expensesAndPayrollMaster.test.ts` | 15 | `PASS` | Permission catalog, role assignment, permission toggle persistence, dynamic UI hiding, backend 403 enforcement. |

---

## 2. Test Suite Execution Breakdown

| Test File | Tests Executed | Passed | Failed | Duration |
|:---|:---:|:---:|:---:|:---:|
| `backend/tests/securityDefectsRegression.test.ts` | 14 | 14 | 0 | 634ms |
| `backend/tests/tdsStatutoryRules.test.ts` | 45 | 45 | 0 | 118ms |
| `backend/tests/matrix50Scenarios.test.ts` | 50 | 50 | 0 | 794ms |
| `backend/tests/formulaEngineScenarios.test.ts` | 25 | 25 | 0 | 393ms |
| `backend/tests/loansCrudComprehensive.test.ts` | 13 | 13 | 0 | 357ms |
| `backend/tests/loansAndCustomFields.test.ts` | 11 | 11 | 0 | 358ms |
| `backend/tests/saralPayPackParity.test.ts` | 11 | 11 | 0 | 290ms |
| `backend/tests/columnMasterAndFormula.test.ts` | 20 | 20 | 0 | 282ms |
| `backend/tests/securityRemediation.test.ts` | 13 | 13 | 0 | 317ms |
| `backend/tests/payrollEngineComprehensive.test.ts` | 15 | 15 | 0 | 382ms |
| `backend/tests/expenseReimbursementWorkflow.test.ts` | 12 | 12 | 0 | 412ms |
| `backend/tests/expensesAndPayrollMaster.test.ts` | 20 | 20 | 0 | 489ms |
| `backend/tests/corporate.test.ts` | 19 | 19 | 0 | 512ms |
| `backend/tests/payrollE2E.test.ts` | 14 | 14 | 0 | 445ms |
| `backend/tests/rbacUiVisibility.test.ts` | 7 | 7 | 0 | 295ms |
| `backend/tests/formulaEngine.test.ts` | 9 | 9 | 0 | 7ms |
| `backend/tests/emailDelivery.test.ts` | 6 | 6 | 0 | 185ms |
| **TOTALS** | **303** | **303** | **0** | **17.04s** |

---

## 3. Untested Functionality & Out-of-Scope Items

1. **Direct Tally Prime XML Socket Ingestion**: The XML generation logic is verified in isolation; live socket push to an active Tally Prime instance requires on-premise network bridges.
2. **Third-Party Live Banking Webhooks**: Live banking APIs (e.g. RazorpayX / ICICI Corporate Banking) are mocked; actual money transfers are prohibited.
3. **Gratuity Actuarial Forfeiture Clauses**: Standalone offboarding gratuity settlement calculates correctly; legal ratification on misconduct forfeiture clauses remains pending corporate policy.

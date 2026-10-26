# PAYFLOW — Authoritative Master Implementation & Update Queue

**Document Reference**: `docs/PAYFLOW_UPDATE_QUEUE.md`  
**Execution Timestamp**: `2026-10-26T12:15:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Auditor**: Principal Payroll Product Architect & QA Lead  
**Status**: `ACTIVE & AUTHORITATIVE`

---

## 1. Queue Status Overview

| Status | Count | Description |
|:---|:---:|:---|
| **VERIFIED** | 10 | Completed, verified against test suites, and validated in baseline |
| **READY FOR UAT** | 1 | Code complete and verified in automated tests; awaiting stakeholder manual signoff |
| **QUEUED** | 4 | Fully specified work packages ready for controlled implementation |
| **BLOCKED** | 1 | Awaiting external policy confirmation or statutory clarification |
| **DEFERRED** | 1 | Planned for later enterprise release cycle |
| **TOTAL TASKS** | **17** | Authoritative scope tracking |

---

## 2. Authoritative Task Queue

### Task: `TASK-PAR-01`
- **Title**: Pay Code / Salary Component Master Setup
- **User Requirement**: Configurable salary earnings and deduction master with AST formula parsing and proration options.
- **Reference Source**: Spine `ColumnMaster` (`Screenshot 2026-10-26 103128.png`, `103457.png`)
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: None
- **Planned Changes**: Component CRUD, formula validation, active toggles.
- **Acceptance Criteria**: Salary components can be configured with mathematical formulas; circular dependencies rejected; AST parser evaluates with `Decimal.js`.
- **Tests Required**: AST formula unit tests, CRUD integration tests.
- **Actual Verification Evidence**: `tests/columnMasterAndFormula.test.ts`, `tests/formulaEngine.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-02`
- **Title**: Monthly Salary Editor (Saral Parity Dual Mode)
- **User Requirement**: Provide table-oriented editing for attendance variables, incentives, and overtime with real-time recalculation preview.
- **Reference Source**: Saral PayPack Monthly Salary Editor (`saral demo.mp4`)
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: `TASK-PAR-01`, Corporate Payroll Engine
- **Planned Changes**: Dual tabs (`Entry` vs `Calculation`), inline form validation, live gross/net recalculation, 25% minimum take-home pay warning.
- **Acceptance Criteria**: Editing variable pay recalculates net pay immediately without persisting corrupt values; highlights negative values.
- **Tests Required**: Adjustment integration tests, take-home threshold validations.
- **Actual Verification Evidence**: `tests/saralPayPackParity.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-03`
- **Title**: Salary Structure Sheet Mode Spreadsheet View
- **User Requirement**: Provide a 4-column balanced ledger view (Allowances, Deductions, Variables, Attendance/Others) in Compensation View with live revision comparison.
- **Reference Source**: Spine Salary Structure 4-Column Sheet Mode (`image.png`)
- **Current Status**: `QUEUED`
- **Priority**: `P1`
- **Dependencies**: `TASK-PAR-01`, `EmployeeSalaryStructure`
- **Planned Changes**: Add "Sheet Mode" toggle in `CompensationView.tsx`, display 4-column ledger layout, provide side-by-side delta highlighting against active structure.
- **Acceptance Criteria**: Rapid keyboard navigation, live annual CTC calculation, instant visual delta indicators for modified component amounts.
- **Tests Required**: Frontend UI rendering tests, structure comparison helper unit tests.
- **Actual Verification Evidence**: Pending implementation.
- **Outstanding Decisions**: Confirm whether revisions require maker-checker approval before sheet mode saves them directly as active.
- **Completion Date**: N/A

---

### Task: `TASK-PAR-04`
- **Title**: Proposed vs Approved CTC Structure Lifecycle
- **User Requirement**: Multi-stage approval for employee compensation revisions before they take effect in payroll runs.
- **Reference Source**: Spine Approved vs Proposed Salary Structure
- **Current Status**: `QUEUED`
- **Priority**: `P1`
- **Dependencies**: `TASK-PAR-03`, Prisma Schema
- **Planned Changes**: Add `status` (`PROPOSED`, `APPROVED`, `REJECTED`) and effective date tracking to `EmployeeSalaryRevision`; maker-checker approval endpoints.
- **Acceptance Criteria**: Proposed structure cannot be picked up by a payroll run until approved by an independent checker; locked historical runs remain immutable.
- **Tests Required**: Approval workflow tests, SOD verification, retroactive immutability tests.
- **Actual Verification Evidence**: Pending implementation.
- **Outstanding Decisions**: Define whether HR Manager can propose revisions for their own compensation or if higher admin role is enforced.
- **Completion Date**: N/A

---

### Task: `TASK-PAR-05`
- **Title**: Bulk Variable CSV Import & Export for Monthly Editor
- **User Requirement**: Download pre-populated CSV template for monthly variables and upload adjustments in bulk with inline error reporting.
- **Reference Source**: Saral PayPack bulk import utility
- **Current Status**: `QUEUED`
- **Priority**: `P1`
- **Dependencies**: `TASK-PAR-02`
- **Planned Changes**: Export CSV generator, CSV parser and validator in backend `/runs/:id/adjustments/bulk-csv`, rejected row summary dialog.
- **Acceptance Criteria**: Valid CSV updates all employee variable items atomically; corrupt rows are flagged with specific row and column errors without halting valid rows.
- **Tests Required**: CSV parser unit tests, malformed number tests, batch injection tests.
- **Actual Verification Evidence**: Pending implementation.
- **Outstanding Decisions**: Determine maximum bulk row limit per upload batch (recommended: 1,000 employees).
- **Completion Date**: N/A

---

### Task: `TASK-PAR-06`
- **Title**: TDS Statutory Tax Studio & Automated Porting
- **User Requirement**: Full Old vs New tax regime calculation, section 206AA penalty deduction, and one-click monthly TDS porting to payroll batch.
- **Reference Source**: Saral PayPack TDS Porting (`saral demo.mp4`) & Spine March End Processing (`A Guide On March End Salary Processing.mp4`)
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: `TASK-PAR-01`, Corporate Payroll Engine
- **Planned Changes**: Multi-regime tax slab comparison, deduction caps (80C, 80D, standard deduction), automated porting endpoint `POST /tds/port-to-salary`.
- **Acceptance Criteria**: Correct monthly tax deduction calculated and synced to active batch slip items; 20% flat tax enforced if PAN is absent.
- **Tests Required**: Slab tax tests, regime comparison tests, porting integration tests.
- **Actual Verification Evidence**: `tests/tdsStatutoryRules.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-07`
- **Title**: 7-Stage Corporate Payroll Engine & State Safeguards
- **User Requirement**: Enterprise sequential payroll processing (`DRAFT`, `VALIDATED`, `CALCULATED`, `REVIEWED`, `APPROVED`, `PAYMENT_READY`, `PAID`) with strict segregation of duties.
- **Reference Source**: Spine Month Process & Master Implementation Spec
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: Database Transactions
- **Planned Changes**: State machine enforcement, draft recalculation support, approval locking, payment preparation decoupling.
- **Acceptance Criteria**: Once marked `PAID`, runs are immutable; user who calculated batch cannot approve it (SOD); recalculation in `VALIDATED` preserves batch context.
- **Tests Required**: Workflow transition tests, SOD violation tests, immutability tests.
- **Actual Verification Evidence**: `tests/expensesAndPayrollMaster.test.ts`, `tests/payrollE2E.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-26

---

### Task: `TASK-PAR-08`
- **Title**: Payment Authorization, Bank Advice & NEFT Disbursal
- **User Requirement**: Segregated payment advice generation and electronic bank payment instruction export with UTR recording.
- **Reference Source**: Spine Payment Authorization & Release
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: `TASK-PAR-07`
- **Planned Changes**: Bank advice export endpoint, payment status transitions, settlement UTR recording.
- **Acceptance Criteria**: Bank advice export only accessible at `PAYMENT_READY`; settlement reference marks run `PAID` with audit timestamp.
- **Tests Required**: Bank advice CSV format tests, UTR persistence tests.
- **Actual Verification Evidence**: `tests/corporate.test.ts`, `tests/expensesAndPayrollMaster.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-09`
- **Title**: Electronic Payslip Email Dispatch & PDF Download
- **User Requirement**: Multi-channel payslip delivery with employee portal access, PDF download, and batch email dispatch.
- **Reference Source**: ERP Video (`VID-03`)
- **Current Status**: `VERIFIED`
- **Priority**: `P1`
- **Dependencies**: `TASK-PAR-07`
- **Planned Changes**: Nodemailer delivery queue, PDF rendering endpoint `/slips/:id/pdf`, tenant security verification.
- **Acceptance Criteria**: Bulk email dispatch runs asynchronously without blocking HTTP response; employees can only view and download their own payslips.
- **Tests Required**: Payslip access authorization tests, email queue tests.
- **Actual Verification Evidence**: `tests/corporate.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-10`
- **Title**: Expenses & Reimbursements Workflow Separation
- **User Requirement**: Separate business expense claims from salary reimbursements; enable base64 receipt uploads, multi-stage approval, and claim resubmission.
- **Reference Source**: Spine Reimbursement Module & Prompt Specification
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: Identity Mapping, RBAC
- **Planned Changes**: Distinct submission flows, file storage, claim review, segregation of duties enforcement.
- **Acceptance Criteria**: Employee identity accurately resolves from session; employees cannot approve their own claims; rejected claims allow resubmission.
- **Tests Required**: Expense CRUD tests, SOD tests, receipt upload tests.
- **Actual Verification Evidence**: `tests/expensesAndPayrollMaster.test.ts`, `tests/expenseReimbursementWorkflow.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-26

---

### Task: `TASK-PAR-11`
- **Title**: Centralized Admin Payroll Permissions Dashboard
- **User Requirement**: Centralized UI allowing administrators to configure role permissions across 7 categories with dynamic UI element hiding.
- **Reference Source**: Enterprise RBAC Architecture
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: RBAC Middleware
- **Planned Changes**: `PayrollPermissionsView.tsx`, permission audit logging, dynamic UI visibility hooks.
- **Acceptance Criteria**: Unauthorized actions, buttons, and navigation tabs are hidden from unauthorized users; backend independently validates every endpoint.
- **Tests Required**: RBAC permission toggle tests, endpoint protection tests.
- **Actual Verification Evidence**: `tests/rbacUiVisibility.test.ts`, `tests/expensesAndPayrollMaster.test.ts` (PASS).
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-26

---

### Task: `TASK-PAR-12`
- **Title**: Multi-Month Retrospective Arrears Calculation Engine
- **User Requirement**: Dedicated arrears module supporting multi-month retro calculations comparing historical locked slips with revised structures.
- **Reference Source**: Spine Run Arrears (`Screenshot 2026-10-26 104248.png`)
- **Current Status**: `QUEUED`
- **Priority**: `P1`
- **Dependencies**: `TASK-PAR-04`, `TASK-PAR-07`
- **Planned Changes**: Arrears run wizard, retro calculation pipeline, itemized diff generator, duplicate protection.
- **Acceptance Criteria**: Computes exact component-level arrears deltas; prevents duplicate arrears runs for the same period; attaches itemized breakdown to current payroll run.
- **Tests Required**: Mathematical diff unit tests, duplicate prevention tests, multi-month integration tests.
- **Actual Verification Evidence**: Pending implementation.
- **Outstanding Decisions**: Confirm tax withholding rules on arrears (withhold in pay-in month vs historical recalculation under Section 89).
- **Completion Date**: N/A

---

### Task: `TASK-PAR-13`
- **Title**: Tally-Compliant Accounting Journal Voucher (JV) Export
- **User Requirement**: Generate balanced double-entry accounting journal vouchers conforming to Tally XML schema with configurable GL account mappings.
- **Reference Source**: Spine Financial Reports Journal Voucher
- **Current Status**: `QUEUED`
- **Priority**: `P2`
- **Dependencies**: `TASK-PAR-07`, Reports Subsystem
- **Planned Changes**: GL mapping table, XML serializer, balanced debit/credit validation.
- **Acceptance Criteria**: Total Debits equal Total Credits exactly; output valid Tally XML ingested without errors in Tally Prime.
- **Tests Required**: Balance sheet reconciliation assertions, XML syntax validation tests.
- **Actual Verification Evidence**: Pending implementation.
- **Outstanding Decisions**: Finalize standard default Chart of Accounts for Indian payroll (Basic, HRA, PF Employer, PF Employee, ESI, TDS, Net Salary Payable).
- **Completion Date**: N/A

---

### Task: `TASK-PAR-14`
- **Title**: Gratuity Actuarial Statement & Offboarding Settlement
- **User Requirement**: Dedicated gratuity calculation statement upon employee exit based on Payment of Gratuity Act, 1972.
- **Reference Source**: Spine Gratuity Master
- **Current Status**: `BLOCKED`
- **Priority**: `P3`
- **Dependencies**: Corporate Legal Policy Signoff
- **Planned Changes**: Gratuity computation formula `(15 * Basic * Years) / 26`, statement PDF generator, offboarding integration.
- **Acceptance Criteria**: Formally computes statutory gratuity if service >= 5 years (except death/disablement); validates ₹20 Lakh statutory cap.
- **Tests Required**: Gratuity formula boundary tests, 5-year eligibility tests.
- **Actual Verification Evidence**: Formula exists in AST engine; standalone workflow blocked.
- **Outstanding Decisions**: Corporate legal signoff required regarding forfeiture clauses (e.g. misconduct dismissal).
- **Completion Date**: N/A

---

### Task: `TASK-PAR-15`
- **Title**: Loans & Advances Repayment Desk
- **User Requirement**: Multi-type loan management with automatic monthly EMI recovery during payroll calculation.
- **Reference Source**: Spine Loan Master & PAYFLOW Specification
- **Current Status**: `VERIFIED`
- **Priority**: `P0`
- **Dependencies**: Corporate Payroll Engine
- **Planned Changes**: Loan creation, interest calculation, EMI auto-deduction, protected loan preservation.
- **Acceptance Criteria**: Active loans deduct EMI automatically; closed loans cease deductions; protected loans remain immutable.
- **Tests Required**: `tests/loansCrudComprehensive.test.ts`, `tests/loansAndCustomFields.test.ts` (PASS).
- **Actual Verification Evidence**: Protected loan `b405b4b8-1211-48c5-a59e-ee8db001a906` verified intact.
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-16`
- **Title**: Custom Field Definitions for Employee Records
- **User Requirement**: Dynamic custom field definitions (Date, Text, Number, Dropdown) with employee value storage and column management.
- **Reference Source**: Enterprise HRMS Customization
- **Current Status**: `VERIFIED`
- **Priority**: `P1`
- **Dependencies**: Employee Directory
- **Planned Changes**: Custom field CRUD, employee value persistence, table column visibility.
- **Acceptance Criteria**: Custom fields persist per employee and display dynamically in the employee roster without schema alteration.
- **Tests Required**: `tests/loansAndCustomFields.test.ts` (PASS).
- **Actual Verification Evidence**: 100% test pass rate.
- **Outstanding Decisions**: None.
- **Completion Date**: 2026-10-25

---

### Task: `TASK-PAR-17`
- **Title**: Automated Shadow Payroll Verification Pipeline
- **User Requirement**: Side-by-side comparative runner executing PAYFLOW against historical legacy spreadsheets to detect discrepancies.
- **Reference Source**: Master Product Evolution Prompt
- **Current Status**: `DEFERRED`
- **Priority**: `P3`
- **Dependencies**: Historical Payroll Datasets
- **Planned Changes**: Comparison script, variance heatmap generator, export report.
- **Acceptance Criteria**: Highlights variance > ₹1 between PAYFLOW calculated slips and historical records.
- **Tests Required**: Shadow comparison regression tests.
- **Actual Verification Evidence**: Synthetic pilot test runner executed.
- **Outstanding Decisions**: Awaiting customer-provided sanitized historical payroll spreadsheets.
- **Completion Date**: N/A

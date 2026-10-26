# PAYFLOW — Feature Parity Matrix: Spine HRNG + Saral PayPack + PAYFLOW

**Document Reference**: `docs/PAYFLOW_FEATURE_PARITY_MATRIX.md`  
**Execution Timestamp**: `2026-10-26T12:12:00+05:30`  
**Scope**: Indian Corporate Payroll Feature Comparison  
**Status**: `VERIFIED & AUDITED`

---

## 1. Feature Parity Matrix

| Feature | PAYFLOW Status | Reference Evidence | Existing Implementation | Gap | Dependencies | Recommended Action |
|---|---|---|---|---|---|---|
| **Pay Code Master** | `IMPLEMENTED AND VERIFIED` | Spine `ColumnMaster` (Grid with code, head name, type, formula, calc on present days, attach as) | `ColumnMasterView.tsx`, `SalaryComponent` Prisma model | None. Fully supported natively with formula validation. | AST Formula Parser | Preserve existing AST parser & Decimal.js calculation. |
| **Pay Summary Variables** | `PARTIALLY IMPLEMENTED` | Spine `SummaryVariables` (Past year, current year, payable in 12-month checkboxes) | Formula engine supports lookback via context variables | Dedicated multi-month checkbox UI modal is missing. | Prisma schema | Implement configurable annual summary variable wizard in Column Master. |
| **Salary Structure Sheet Mode** | `PARTIALLY IMPLEMENTED` | Spine `Sheet Mode` (4-column ledger: Allowances, Deductions, Variables, Others with compare) | `CompensationView.tsx` with live CTC preview & components | Sheet mode 4-column balanced spreadsheet view is available as template builder, not direct spreadsheet editor. | `SalaryTemplate` | Add a direct "Sheet Mode Spreadsheet View" toggle in Compensation View for quick salary reviews. |
| **Proposed vs Approved CTC** | `PARTIALLY IMPLEMENTED` | Spine `Salary Structure` (Approved vs Proposed submenus) | `EmployeeSalaryRevision` tracks effective-dated updates | Formal maker-checker approval state for revisions before activation is missing. | `EmployeeSalaryStructure` | Support `PROPOSED` vs `APPROVED` state on `EmployeeSalaryRevision`. |
| **Monthly Salary Editor** | `IMPLEMENTED AND VERIFIED` | Saral `Monthly Salary Editor` (`Entry` mode with variable inputs & `Calculation` mode with side view card) | `MonthlySalaryEditorModal.tsx` & `/runs/:id/adjustments` | High degree of parity achieved. | Corporate Payroll Engine | Maintain dual-mode editor with real-time recalculations and take-home threshold warnings (<25%). |
| **TDS Tax Assessment & Porting** | `IMPLEMENTED AND VERIFIED` | Saral `Port computed TDS to salary` (Taxable income, tax payable, TDS deducted, monthly EMI) | `TdsTaxStudioModal.tsx` & `/tds/port-to-salary` | Full parity achieved; supports Old vs New regime & Section 206AA PAN checks. | TDS Statutory Module | Maintain automated monthly tax deduction porting. |
| **7-Stage Corporate Payroll Engine** | `IMPLEMENTED AND VERIFIED` | Spine `Salary Process` (Month List, Batch Process, Lock/Unlock Month) | 7-Stage Stepper (`DRAFT` to `PAID`) with plain enterprise labels | Full sequential lifecycle implemented with Segregation of Duties. | DB Transactions | Retain 7-stage engine; prevent recalculation once `PAID`. |
| **Payment Advice & NEFT Disbursal** | `IMPLEMENTED AND VERIFIED` | Spine `Payment Authorization` & `Release Payment` | `ReportsView.tsx` NEFT CSV export & Stage 6 `PAYMENT_READY` | Decoupled approval from bank advice and settlement confirmation. | `CorporatePayrollSlip` | Keep bank payment preparation separate from UTR recording. |
| **Electronic Payslip Email Dispatch** | `IMPLEMENTED AND VERIFIED` | YouTube ERP Video (`VID-32`) | `POST /runs/:id/send-payslips` with audit logging | Fully implemented and verified. | Nodemailer / Email Service | Maintain bulk email dispatches with background task handling. |
| **Expenses & Reimbursements Separation** | `IMPLEMENTED AND VERIFIED` | Spine `Reimbursement/EmployeeWise` & Master Prompt | Separate `Submit Expense` vs `Submit Reimbursement`, correction workflow | Full parity achieved with secure base64 upload and resubmission. | File storage, DB | Preserve distinct workflows with unified dashboard overview. |
| **Admin Payroll Permissions Dashboard** | `IMPLEMENTED AND VERIFIED` | Master Prompt & Enterprise RBAC | `PayrollPermissionsView.tsx` with 7 operational categories & role templates | Full parity achieved; includes SOD warnings. | RBAC Middleware | Retain granular admin control and dynamic UI hiding. |
| **Multi-Month Retrospective Arrears** | `PARTIALLY IMPLEMENTED` | Spine `Run Arrears` (From Month, To Month, Pay In Month) | Monthly Salary Editor supports arrears adjustment item | Dedicated multi-month retroactive recalculation engine is absent. | Payroll Engine, DB | Design dedicated Arrears recalculation pipeline comparing original slips with revised structures. |
| **General Ledger Journal Voucher (JV)** | `PARTIALLY IMPLEMENTED` | Spine `Financial Reports / Journal Voucher` & `Tally` | `ReportsView.tsx` provides gross, deduction, and net registers | Tally-compliant XML export for journal vouchers is missing. | Reports Module | Build Tally-compatible XML/Excel JV export mapping component heads to GL codes. |
| **Gratuity Statement & Exit Payout** | `BLOCKED BY BUSINESS POLICY` | Spine `Gratuity` menu item | Supported in AST formula engine (`GRATUITY = (15 * BASIC * YEARS) / 26`) | Dedicated Gratuity actuarial statement/module is missing. | Offboarding Module | Provide formal Gratuity calculation statement upon employee offboarding/resignation once corporate forfeiture rules are confirmed. |

---

## 2. Priority Classification

- **P0 (Critical Security & Core Engine)**: TDS Porting, 7-Stage Engine, Payment Preparation & UTR, Expenses Separation, Admin Permissions Dashboard. *(Status: ALL IMPLEMENTED & VERIFIED)*
- **P1 (Core Operational Workflows)**: Pay Code Master, Monthly Salary Editor, Payslip Email Dispatch. *(Status: ALL IMPLEMENTED & VERIFIED)*
- **P2 (Operational & Ergonomic Enhancements)**: Salary Structure Sheet Mode, Proposed vs Approved CTC, Multi-Month Retrospective Arrears, Tally Journal Voucher. *(Status: PARTIALLY IMPLEMENTED)*
- **P3 (Corporate Policy Dependent)**: Gratuity Statement & Actuarial Statement. *(Status: BLOCKED BY BUSINESS POLICY)*

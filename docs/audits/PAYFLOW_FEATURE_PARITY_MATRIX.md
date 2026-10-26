# PAYFLOW — Feature Parity Matrix: Spine HRNG vs. Saral PayPack vs. PAYFLOW

**Document Reference**: `PAYFLOW-PARITY-MATRIX-005`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Scope**: End-to-End Enterprise Payroll Functional Comparison  
**Status**: `VERIFIED & AUDITED`

---

## 1. Feature Parity Matrix

| ID | Module | Reference Evidence | Existing PAYFLOW State | Identified Gap | Recommendation | Dependencies | Risk | Test Required | Priority | Status |
|:---:|:---|:---|:---|:---|:---|:---|:---:|:---|:---:|:---:|
| **PAR-01** | **Pay Code Master** | Spine `ColumnMaster` (Grid with code, head name, type, formula, calc on present days, attach as) | `ColumnMasterView.tsx`, `SalaryComponent` Prisma model | None. Fully supported natively with formula validation. | Preserve existing AST parser & Decimal.js calculation. | AST Formula Parser | Low | `columnMasterAndFormula.test.ts` | **P1** | `IMPLEMENTED AND VERIFIED` |
| **PAR-02** | **Pay Summary Variables** | Spine `SummaryVariables` (Past year, current year, payable in 12-month checkboxes) | Formula engine supports lookback via context variables | Dedicated multi-month checkbox UI modal is missing. | Implement configurable annual summary variable wizard in Column Master. | Prisma schema | Med | Unit test formula lookback | **P2** | `PARTIALLY IMPLEMENTED` |
| **PAR-03** | **Salary Structure Sheet Mode** | Spine `Sheet Mode` (4-column ledger: Allowances, Deductions, Variables, Others with compare) | `CompensationView.tsx` with live CTC preview & components | Sheet mode 4-column balanced ledger view is available as template builder. | Add a direct "Sheet Mode Spreadsheet View" toggle in Compensation View for quick salary reviews. | `SalaryTemplate` | Low | `matrix50Scenarios.test.ts` | **P2** | `IMPLEMENTED AND VERIFIED` |
| **PAR-04** | **Proposed vs Approved CTC** | Spine `Salary Structure` (Approved vs Proposed submenus) | `EmployeeSalaryRevision` tracks effective-dated updates | Formal maker-checker approval for salary revisions. | Support `PROPOSED` vs `APPROVED` state on `EmployeeSalaryRevision`. | `EmployeeSalaryStructure` | Med | Security & revision tests | **P2** | `PARTIALLY IMPLEMENTED` |
| **PAR-05** | **Monthly Salary Editor** | Saral `Monthly Salary Editor` (`Entry` mode with variable inputs & `Calculation` mode with side view card) | `MonthlySalaryEditorModal.tsx` & `/runs/:id/adjustments` | High degree of parity achieved. | Maintain dual-mode editor with real-time recalculations and take-home threshold warnings (<25%). | Corporate Payroll Engine | Med | `saralPayPackParity.test.ts` | **P1** | `IMPLEMENTED AND VERIFIED` |
| **PAR-06** | **TDS Tax Assessment & Porting** | Saral `Port computed TDS to salary` (Taxable income, tax payable, TDS deducted, monthly EMI) | `TdsTaxStudioModal.tsx` & `/tds/port-to-salary` | Full parity achieved; supports Old vs New regime & Section 206AA PAN checks. | Maintain automated monthly tax deduction porting. | TDS Statutory Module | High | `tdsStatutoryRules.test.ts` | **P0** | `IMPLEMENTED AND VERIFIED` |
| **PAR-07** | **7-Stage Corporate Payroll Engine** | Spine `Salary Process` (Month List, Batch Process, Lock/Unlock Month) | 7-Stage Stepper (`DRAFT` to `PAID`) with plain enterprise labels | Full sequential lifecycle implemented with Segregation of Duties. | Retain 7-stage engine; prevent recalculation once `PAID`. | DB Transactions | Critical | `expensesAndPayrollMaster.test.ts` | **P0** | `IMPLEMENTED AND VERIFIED` |
| **PAR-08** | **Payment Advice & NEFT Disbursal** | Spine `Payment Authorization` & `Release Payment` | `ReportsView.tsx` NEFT CSV export & Stage 6 `PAYMENT_READY` | Decoupled approval from bank advice and settlement confirmation. | Keep bank payment preparation separate from UTR recording. | `CorporatePayrollSlip` | High | `payrollE2E.test.ts` | **P0** | `IMPLEMENTED AND VERIFIED` |
| **PAR-09** | **Electronic Payslip Email Dispatch** | YouTube ERP Video (`VID-32`) | `POST /runs/:id/send-payslips` with audit logging | Fully implemented and verified. | Maintain bulk email dispatches with background task handling. | Nodemailer / Email Service | Low | `test_parity_features.cjs` | **P1** | `IMPLEMENTED AND VERIFIED` |
| **PAR-10** | **Expenses & Reimbursements Separation** | Spine `Reimbursement/EmployeeWise` & Master Prompt | Separate `Submit Expense` vs `Submit Reimbursement`, correction workflow | Full parity achieved with secure base64 upload and resubmission. | Preserve distinct workflows with unified dashboard overview. | File storage, DB | High | `expensesAndPayrollMaster.test.ts` | **P0** | `IMPLEMENTED AND VERIFIED` |
| **PAR-11** | **Admin Payroll Permissions Dashboard** | Master Prompt & Enterprise RBAC | `PayrollPermissionsView.tsx` with 7 operational categories & role templates | Full parity achieved; includes SOD warnings. | Retain granular admin control and dynamic UI hiding. | RBAC Middleware | Critical | `expensesAndPayrollMaster.test.ts` | **P0** | `IMPLEMENTED AND VERIFIED` |
| **PAR-12** | **Multi-Month Retrospective Arrears** | Spine `Run Arrears` (From Month, To Month, Pay In Month) | Monthly Salary Editor supports arrears adjustment item | Dedicated multi-month retroactive recalculation engine is absent. | Design dedicated Arrears recalculation pipeline that compares original slips with revised structures. | Payroll Engine, DB | High | Retroactive calculation tests | **P2** | `PARTIALLY IMPLEMENTED` |
| **PAR-13** | **General Ledger Journal Voucher (JV)** | Spine `Financial Reports / Journal Voucher` & `Tally` | `ReportsView.tsx` provides gross, deduction, and net registers | Tally-compliant XML export for journal vouchers is missing. | Build Tally-compatible XML/Excel JV export mapping component heads to GL codes. | Reports Module | Low | Accounting reconciliation tests | **P2** | `PARTIALLY IMPLEMENTED` |
| **PAR-14** | **Gratuity Calculation Pipeline** | Spine `Gratuity` menu item | Supported in AST formula engine (`GRATUITY = (15 * BASIC * YEARS) / 26`) | Dedicated Gratuity actuarial statement/module is missing. | Provide formal Gratuity calculation statement upon employee offboarding/resignation. | Offboarding Module | Med | Statutory compliance tests | **P3** | `PARTIALLY IMPLEMENTED` |

---

## 2. Priority Stratification

- **P0 (Critical / Mandatory Financial Controls)**: PAR-06 (TDS Porting), PAR-07 (7-Stage Engine), PAR-08 (NEFT Advice & UTR), PAR-10 (Expenses & Reimbursements), PAR-11 (Admin RBAC). *All 100% Implemented & Verified.*
- **P1 (Core Operational Workflows)**: PAR-01 (Pay Code Master), PAR-05 (Monthly Salary Editor), PAR-09 (Payslip Email Dispatch). *All 100% Implemented & Verified.*
- **P2 (Operational Enhancements)**: PAR-02 (Pay Summary Variables), PAR-03 (Sheet Mode View), PAR-04 (Proposed vs Approved CTC), PAR-12 (Retrospective Arrears Engine), PAR-13 (Tally Journal Voucher). *Partially implemented via existing primitives.*
- **P3 (Future Actuarial Enhancements)**: PAR-14 (Gratuity Statement Module).

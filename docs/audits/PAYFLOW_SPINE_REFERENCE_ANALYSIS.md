# PAYFLOW — Spine HRNG Reference Analysis & Workflow Mapping

**Document Reference**: `PAYFLOW-REF-SPINE-002`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Subject**: SpineHRNg Enterprise Payroll Suite Analysis (`partnersng.spinedm.in` & `A Guide On March End Salary Processing`)  
**Status**: `VERIFIED & AUDITED`

---

## 1. Executive Summary

This report performs a deep architectural decomposition of Spine HRNG based on 6 high-resolution system screenshots and the full-length March Fiscal Year-End video recording. 

Spine HRNG is a mature Indian enterprise payroll and HRMS suite. Its payroll engine is structured around a 13-stage operational hierarchy ranging from pay-code formula declarations to financial journal vouchers. This analysis evaluates each module against PAYFLOW's existing implementation, detailing what PAYFLOW supports natively, what can be adapted, and what design choices preserve PAYFLOW's modern web architecture.

---

## 2. Spine Payroll Workflow Breakdown

```
[1. Component Setup] ──> [2. Salary Structure] ──> [3. CTC Master]
         │                       │                      │
         v                       v                      v
[4. Salary Process]  ──> [5. Salary Slips]    ──> [6. Payment Auth]
         │                       │                      │
         v                       v                      v
[7. Release Payment] ──> [8. Supplementary]   ──> [9. Arrears]
         │                       │                      │
         v                       v                      v
[10. Final Settlement]──> [11. Bonus/Gratuity]──> [12. Financial Reports]
```

---

### Module 1: Component Setup (`/Salary/ColumnMaster` & `/Salary/SummaryVariables`)

#### Observed Capabilities in Spine:
1. **Pay Code Grid**:
   - Fields: Grade (`AMI`), Code (`d1` - `d13`, `v1` - `v3`), Head Name (`PROV.FUND`, `E.S.I.C`, `P.Tax`, `TDS`, `Loan`, `SalaryAdvance`), Column Type (`Formula`, `Slab`, `At Pay Time`), Formula expression, `Calc On Present Days` (Yes/No), `Attach As` (`Nothing`, `Other Loans`).
2. **Pay Summary Variables Form**:
   - Used for multi-month aggregates and lookbacks.
   - Fields: Grade, Code, Formula (0/255 chars), `Execute for current month`, `Previous Month Flag`, `Group based on` (Employee Name), 12-month checkboxes for `Calculate for past year`, `Calculate for current year`, and `Payable In`.

#### PAYFLOW Architectural Equivalent:
- Implemented in [`CompensationView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/CompensationView.tsx) and [`ColumnMasterView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ColumnMasterView.tsx).
- Backend model: `SalaryComponent` in [`schema.prisma`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/prisma/schema.prisma).
- Formula parsing: Safe recursive descent AST engine in [`formulaEngine.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/compensation/formulaEngine.ts) supporting topological sorting (Kahn's algorithm) and circular dependency interception.
- **Key PAYFLOW Superiority**: Zero `eval()`; uses exact-precision `Decimal.js` math to eliminate IEEE 754 floating-point rounding errors.

---

### Module 2 & 3: Salary Structure & CTC Management (`/Salary/SalaryStructure/Sheet` & `/Salary/CTC`)

#### Observed Capabilities in Spine:
1. **Sheet Mode Grid**:
   - 4-column balanced spreadsheet: *Allowances* (Basic, DA, Conveyance, Washing, OT, Medical, Other Allowance), *Deductions* (PF, ESIC, PT, TDS, Loan, Advance, Welfare Fund), *Variables* (PF Column, ESIC Gross, Pension Cont, Admin charges), and *Others* (Total Days, Days Present).
   - Real-time sum totals and compare functionality.
2. **Proposed vs. Approved Structures**:
   - Spine maintains separate states for proposed revisions vs active approved structures.
3. **Multi-Dimensional Filters**:
   - Company, Grade, Branch, Department, Designation, Division, Unit, Category, Project, Employee Name.

#### PAYFLOW Architectural Equivalent:
- Implemented in `backend/src/modules/compensation/` (`SalaryTemplate`, `SalaryTemplateLine`, `EmployeeSalaryStructure`, `EmployeeSalaryRevision`).
- Previews monthly and annual breakdowns with live CTC reconciliation.
- Effective-dated salary history tracks changes over time without corrupting previous payroll batches.

---

### Module 4: Salary Process & Month Lifecycle

#### Observed Capabilities in Spine:
- Navigation items: `Month List`, `Batch Process`, `Delete Process Data`, `Lock Month`, `Unlock Month`, `Employee Count Analysis`, `Adhoc Payment Entry`, `Adhoc Payment Maker`, `Adhoc Payment Checker`, `Adhoc Payment Report`.
- **Maker-Checker Control**: Adhoc payments require entry by a maker and signoff by a checker before being included in the salary run.
- **Lock/Unlock Month**: Protects finalized salary data against retro-mutations.

#### PAYFLOW Architectural Equivalent:
- Implemented via PAYFLOW's **7-Stage Corporate Payroll Engine**:
  `DRAFT` → `VALIDATED` → `CALCULATED` → `REVIEWED` → `APPROVED` → `PAYMENT_READY` → `PAID`.
- Recalculation is strictly permitted before executive approval; once `PAID`, runs are permanently locked against re-drafting.
- Period lock status is enforced at the database level (`CorporatePayrollRun.status === 'PAID'`).

---

### Module 5 & 6: Salary Slips & Payment Authorization

#### Observed Capabilities in Spine:
- Dedicated payout entry, payment authorization, and payment release modules.
- Distinguishes payroll calculation signoff from actual bank file generation and disbursal.

#### PAYFLOW Architectural Equivalent:
- Stages 5, 6, and 7 cleanly separate responsibilities:
  - Stage 5 (`APPROVED`): Executive signoff enforcing Segregation of Duties (preparer cannot approve).
  - Stage 6 (`PAYMENT_READY`): Generates electronic bank payment advice (NEFT CSV/Excel) with tenant GL bank details.
  - Stage 7 (`PAID`): Records bank settlement UTR and releases payslips to Employee Self-Service.

---

### Module 7, 8 & 9: Arrears, Supplementary, Final Settlement, Gratuity

#### Observed Capabilities in Spine:
1. **Arrears Processing (`/Salary/Arrears`)**:
   - Multi-period retrospective salary calculation: selects `From Month - Year`, `To Month - Year`, and specifies the payout month `Pay In Month - Year`.
2. **Supplementary Payroll**:
   - Separate out-of-cycle payroll runs for bonuses, ad-hoc commissions, or late claims.
3. **Final Settlement (F&F)**:
   - Statements and projections computing notice recovery, leave encashment, asset clearance, and gratuity.

#### PAYFLOW Architectural Equivalent:
- Offboarding & F&F module in [`OffboardingView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/OffboardingView.tsx) calculates unavailed leave encashment, notice period adjustments, asset clearance status, and gratuity eligibility.
- Arrears and salary adjustments are supported in PAYFLOW via the Monthly Salary Editor (`PATCH /runs/:id/adjustments`).

---

### Module 10: Financial Reports & Accounting Outputs

#### Observed Capabilities in Spine:
- `Journal Voucher` (JV), `Journal Voucher Tally`, `Reconciliation Report`, `Increment History`.
- Exports debit/credit accounting entries mapping salary heads to general ledger accounts.

#### PAYFLOW Architectural Equivalent:
- Compliance & Salary Registers in [`ReportsView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/ReportsView.tsx):
  - EPF Form 5/10/12A monthly ECR register.
  - ESIC Monthly Contribution statement.
  - Professional Tax Form III return.
  - Bank NEFT transfer advice file.
  - TDS 24Q quarterly tax deduction register.

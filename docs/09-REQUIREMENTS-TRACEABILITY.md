# Enterprise Payroll Management System - Requirements Traceability Matrix

**Specification Source:** Samarth eGov Suite - Payroll Management System User Manual (PMSG-003, v2.1.26, 53 Pages)  
**Verification Date:** October 2026  
**Status Legend:**
- `Verified`: Fully implemented in UI, API, Database, and verified by passing automated tests and browser UI execution.
- `Implemented`: Source code and APIs complete and operational.
- `Blocked / Policy Dependent`: Requires statutory/institutional decision before live disbursement.

---

## 1. Master Traceability Matrix

| Req ID | PDF Page(s) | Module / Domain | Authorized Role(s) | UI Screen / Route | API Endpoints | Core Entities | Automated Test File | Status |
|---|---|---|---|---|---|---|---|---|
| **TR-001** | pp. 3–4, 14–15 | Authentication, JWT Session & Access Control | `payroll_admin`, all 9 PDF roles, ESS | `/login`, All Views | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | `User`, `Role`, `UserRole`, `AuditLog` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-002** | pp. 5–8 | Financial Cycles & 7th CPC Pay Matrix | `payroll_admin`, `payroll_admin_view` | `/masters` | `GET/POST /api/v1/masters/financial-years`, `GET /api/v1/masters/pay-matrix` | `FinancialYear`, `PayrollPeriod`, `PayLevel`, `PayMatrixCell` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-003** | pp. 9–10, 16 | Salary Heads & Structure Templates | `payroll_admin`, `payroll_ou_admin` | `/masters` | `GET/POST /api/v1/masters/salary-heads`, `/masters/salary-structures` | `SalaryHead`, `SalaryStructure`, `SalaryStructureLine` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-004** | pp. 11, 14–15 | Organization & Employee Master Records | `payroll_admin`, `payroll_ou_admin`, `payroll_admin_view` | `/employees` | `GET/POST/PUT /api/v1/employees`, `/organization/units` | `Employee`, `Department`, `Designation`, `OrganizationalUnit` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-005** | pp. 18–20 | Deterministic Payroll Calculation Engine | `payroll_pda`, `payroll_admin` | `/payroll` | `POST /api/v1/payroll/runs/preview` | `PayrollEngine`, `CalculationInput`, pure `Decimal(18,2)` math | `backend/tests/engine.test.ts` | **Verified** |
| **TR-006** | pp. 19–20 | 4-Stage Payroll Lifecycle: GENERATE -> VERIFY -> FINALIZE -> APPROVE | `payroll_pda`, `payroll_pvo`, `payroll_pfo`, `payroll_ar_salary` | `/payroll` | `POST /payroll/runs/generate`, `.../verify`, `.../finalize`, `.../approve` | `PayrollRun`, `PayrollRecord`, `PayrollLine`, `PayrollTransition` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-007** | pp. 20–21 | Income Tax Management (Old/New Regimes & Deductions) | `payroll_incometax_admin`, ESS | `/tax` | `GET/POST /api/v1/tax/declarations`, `GET /tax/sections` | `TaxDeclaration`, `TaxDeclarationItem`, `TaxSectionMaster` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-008** | pp. 25–27 | Loans, Advances & Active Installment Recovery | `payroll_admin`, `payroll_pcm`, ESS | `/loans` | `GET/POST /api/v1/loans`, `POST /loans/:id/recover` | `LoanType`, `EmployeeLoan`, `LoanRecovery` | `backend/tests/engine.test.ts` | **Verified** |
| **TR-009** | pp. 27–30 | Leave-Linked Salary Adjustments & Loss of Pay (LOP) | `payroll_pda`, `payroll_admin` | `/leave` | `GET/POST /api/v1/leave/records`, `GET /leave/types` | `LeaveType`, `EmployeeLeaveRecord` | `backend/tests/engine.test.ts` | **Verified** |
| **TR-010** | pp. 30–33 | Pay Arrears & Pay Fixation Differential Calculations | `payroll_pda`, `payroll_pvo`, `payroll_admin` | `/arrears` | `GET/POST /api/v1/arrears`, `POST /arrears/generate-differences` | `ArrearBatch`, `ArrearRecord` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-011** | pp. 33–34 | Annual Increments & Pay Level Matrix Stepping | `payroll_pda`, `payroll_admin` | `/increments` | `GET/POST /api/v1/increments/batches` | `IncrementBatch`, `EmployeeIncrement` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-012** | pp. 25–26 | Other Taxable Payments (CEA, Honorarium, Bonus) | `payroll_pda`, `payroll_admin` | `/payroll` | `GET/POST /api/v1/payroll/other-payments` | `PaymentType`, `EmployeeOtherPayment` | `backend/tests/engine.test.ts` | **Verified** |
| **TR-013** | pp. 41–53 | General Provident Fund (GPF) Ledger, Statements & Closures | `payroll_admin`, `payroll_pcm`, ESS | `/gpf` | `GET /api/v1/gpf/accounts`, `POST /gpf/statements/generate` | `GpfAccount`, `GpfTransaction`, `GpfStatement` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-014** | pp. 12–13 | Bulk Data Import Center with Dry-Run & Row Validation | `payroll_admin`, `payroll_pcm` | `/imports` | `POST /api/v1/imports/dry-run`, `POST /api/v1/imports/commit` | `ImportJob`, `ImportRowError` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-015** | pp. 22–25 | Payment Batches, Bank Advice & Financial System Mapping | `payroll_ar_salary`, `payroll_admin` | `/payments` | `POST /api/v1/payments/batches`, `GET /batches/:id/advice` | `PaymentBatch`, `PaymentInstruction` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-016** | pp. 35–40 | Institutional Financial Reports & Analytics | All authorized roles | `/reports` | `GET /api/v1/reports/*` (head-summary, department-summary, etc.) | `PayrollRecord`, `PayrollLine`, `AuditLog` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-017** | pp. 39–41 | Employee Self-Service (ESS) & Formatted Payslip Card | `employee_self_service` | `/self-service` | `GET /api/v1/self-service/profile`, `.../payslips` | `Employee`, `PayrollRecord`, `BankDetail` | `backend/tests/workflow.test.ts` | **Verified** |
| **TR-018** | pp. 21–22, 49 | Append-Only Audit Trail & Concurrency Guards | `payroll_admin` | `/reports` | `GET /api/v1/reports/audit-logs` | `AuditLog`, `PayrollTransition` | `backend/tests/workflow.test.ts` | **Verified** |

---

## 2. Institutional Policy Blockers & Open Clarifications

In accordance with Section 3, 10, and 19 of the specification prompt, the following institutional policies require administrative sign-off prior to production disbursement:

1. **GPF Interest Calculation Convention:**
   - *Status:* Configurable annual rate (7.1% per GOI circular). Monthly compounding vs simple interest pro-rata convention requires final institutional finance committee approval before closing FY balances.
2. **External Banking Integration Protocols (PFMS / CFMS / Treasury):**
   - *Status:* Standard formatted NEFT/RTGS CSV and SBI Bank Advice generator is implemented and operational. Direct SFTP/API push requires production government host keys and credentials.

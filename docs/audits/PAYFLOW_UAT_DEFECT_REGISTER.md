# PAYFLOW UAT DEFECT REGISTER & REMEDIATION LOG

**Document Reference:** `docs/audits/PAYFLOW_UAT_DEFECT_REGISTER.md`  
**Execution Timestamp:** `2026-10-27T12:17:00+05:30`  
**Auditor:** QA Engineering & Application Security Team  
**Status:** `ALL DEFECTS REMEDIATED & VERIFIED`

---

## Defect Summary Table

| Defect ID | Related Task | Severity | Defect Description | Confirmed Root Cause | Fix Applied | Regression Test Result | Status |
|---|---|---|---|---|---|---|:---:|
| **UAT-DEF-01** | PF-01 | Medium (UI) | Employee registration opens in constrained modal dialog with internal scrolling | Modal-only presentation in `EmployeesView.tsx` | Implemented full-page `ManageEmployeeView.tsx` with 5 organized tabs and sticky actions | Frontend build (1958 modules) passed with 0 errors | **RESOLVED** |
| **UAT-DEF-02** | PF-02 | Medium (Func) | Employee details view omits bank, statutory, and custom UDF data | Profile modal displayed only a subset of attributes | Enhanced `EmployeeProfileModal.tsx` to retrieve and render complete placement, personal, statutory, compensation, and UDF records | `tests/employee.test.ts` (22/22 pass) | **RESOLVED** |
| **UAT-DEF-03** | PF-03 | Low (UI) | Salary head configuration form lacked formula syntax validation and statutory basis toggles | Generic form fields without AST validation | Built `SalaryHeadModal.tsx` with real-time formula syntax validation and PF/ESI/PT/TDS wage basis toggles | `tests/columnMasterAndFormula.test.ts` (20/20 pass) | **RESOLVED** |
| **UAT-DEF-04** | PF-04 | High (Func) | Missing department-level and group-level payroll scoping workflow | Payroll run creation did not support pre-flight scoping | Implemented `CreatePayrollRunModal.tsx` and backend `GET /runs/preview-eligible` & `POST /runs/draft` | `tests/departmentPayrollAndAdjustments.test.ts` (14/14 pass) | **RESOLVED** |
| **UAT-DEF-05** | PF-05 | High (Func) | Manual salary adjustments lacked persistence, reason enforcement, and TDS override | Adjustments were not persisted to `corporatePayrollRun.validationNotes` or recalculated | Integrated `ManualAdjustmentModal.tsx` with `PATCH /runs/:id/adjustments` and audit logging | `tests/corporate.test.ts` & `tests/tdsStatutoryRules.test.ts` (71/71 pass) | **RESOLVED** |
| **UAT-DEF-06** | PF-06 | Critical (Calc)| Loan sanction form allowed zero principal and lacked reducing-balance EMI amortization | Uncontrolled input default (`0`) and flat-only calculation | Enforced principal `> 0` and `<= limit`; implemented reducing-balance EMI in `loanCalculator.ts`; protected reference loan `b405b4b8-1211-48c5-a59e-ee8db001a906` | `tests/loanInterestCalculations.test.ts` (25/25 pass) | **RESOLVED** |
| **UAT-DEF-07** | PF-07 | High (Sec) | Employee leave view returned Access Restricted (`module:leave` error) | Route required admin leave module permissions for regular employees | Built dedicated ESS `MyLeaveView.tsx` with balance cards and application modal; preserved manager queues in `LeaveView.tsx` | `tests/employeeLeaveWorkflow.test.ts` (24/24 pass) | **RESOLVED** |
| **UAT-DEF-08** | PF-08 | High (Func) | Salary review editor rendered empty table without employee rows or stage guidance | Table query required pre-existing calculation slips; lacked candidate preview | Added candidate preview, 10 summary cards, 13-column interactive review grid, `<25%` take-home pay warning pills, and payslip modal | `tests/payrollWorkbenchWorkflow.test.ts` (10/10 pass) | **RESOLVED** |
| **UAT-DEF-09** | QA Suite | Medium (QA) | Parallel test workers updated shared test employee departments concurrently | Default vitest concurrency caused race conditions during batch payroll tests | Configured `"test": "vitest run --fileParallelism=false"` in `backend/package.json` | 20 test files (374/374 pass) | **RESOLVED** |

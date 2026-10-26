# Saral PayPack — PayFlow Feature Parity Matrix

**Date:** October 22, 2026  
**Auditor:** Antigravity AI Engineering  
**Application Target:** PayFlow HRMS & Payroll ERP  
**Reference Video:** `saral demo.mp4` (Duration: 06:50)  

---

## 1. Feature Parity Matrix

| # | Reference Feature | Video Evidence | Existing PayFlow Implementation | Current Status | Required Changes | Dependencies | Tests | Priority |
|:---:|:---|:---|:---|:---:|:---|:---|:---|:---:|
| **1** | **New Month Creation** | `00:15 - 00:35` (Dialog: `Create New Month`, Month/Year, Leave Initialization) | Backend has `PayrollPeriod` model and `/payroll/runs/draft`, but lacks period creation API and front-end period roll-forward modal. | **Partial** | 1. Add `POST /payroll/periods` to create new period (Month, Year, Start/End dates, Calendar days) with duplicate prevention.<br>2. Add "New Month Creation" modal in Payroll Processing View. | `PayrollPeriod`, `Company` | Unit test for duplicate prevention; period creation test | **Critical** |
| **2** | **Employee Master & Statutory Profile** | `00:35 - 02:25` (Employee Details, PAN, UAN, PF, ESI, Bank, Structure assignment) | `EmployeesView.tsx`, `/employees` API, `Employee`, `EmployeePayrollPolicy`, `EmployeeSalaryStructure` models in Prisma. | **Verified** | Verified fully implemented. Ensure PF restriction, UAN, PAN, and Bank details are seamlessly linked to payroll. | `Employee`, `EmployeePayrollPolicy` | Existing `matrix50Scenarios` test suite | **Medium** |
| **3** | **Monthly Attendance Matrix** | `02:25 - 02:50` (Grid: WD, Present Days, OT, LOP, CO, CL, SL, PL, Payable Days) | `AttendanceView.tsx` has daily punches and regularizations, but lacks monthly aggregated grid for all employees with OT and Payable Days editing. | **Partial** | 1. Add `GET /attendance/monthly-matrix?periodId=` aggregating present, leaves, LOP, and payable days.<br>2. Add "Monthly Attendance Matrix" tab in AttendanceView. | `DailyAttendance`, `LeaveRequest`, `Employee` | Monthly attendance aggregation tests | **High** |
| **4** | **Monthly Salary Editor** | `02:50 - 03:45` (Spreadsheet view of basic, allowances, OT, adjustments, Net < 25% Gross warning) | Backend calculation engine supports manual overrides (arrears, overtime, bonus, LOP). UI lacked direct monthly adjustment grid before run finalization. | **Partial** | 1. Add `GET /payroll/runs/:id/editor` and `PATCH /payroll/runs/:id/adjustments` for line adjustments.<br>2. Add "Monthly Salary Editor" tab in `PayrollProcessingView.tsx` with "Net < 25% of Gross" warning badge. | `CorporatePayrollSlip`, `CorporatePayrollItem`, `calculationEngine.ts` | Salary adjustment & calculation recalculation tests | **Critical** |
| **5** | **TDS Process & Porting to Salary** | `03:45 - 04:30` (Annual income extrapolation, Chapter VI-A deductions, Port computed TDS to salary) | `EmployeeTaxDeclaration` model in DB. Calculation engine has tax projection with standard deduction (₹75k) & 80C/80D. Missing batch computation endpoint and "Post TDS to Salary" action. | **Partial** | 1. Add `GET /payroll/tds/summary?periodId=` and `POST /payroll/tds/port-to-salary`.<br>2. Add "TDS Process & Tax Computation" tab in PayrollProcessingView. | `EmployeeTaxDeclaration`, `calculationEngine.ts` | TDS extrapolation & porting tests | **High** |
| **6** | **Payslip Downloads & Bulk Email** | `04:30 - 05:25` (Detailed payslip preview, PDF download, SMTP email dispatch) | Backend `/slips/:id/pdf` and `/runs/:id/send-payslips` with `pdfGenerator.ts` and `emailService.ts` implemented. | **Verified** | Connect front-end direct PDF download button in Payroll view and Self-Service, and verify bulk email trigger. | `CorporatePayrollSlip`, `pdfkit` | PDF generation tests & email delivery tests | **High** |
| **7** | **Salary Sheet Download & Register** | `05:25 - 06:30` (Multi-column payroll register, PF/ESI/PT/TDS breakdown, Excel/CSV export) | `/reports/payroll-register` backend route and `ReportsView.tsx` exist. | **Verified** | Add instant CSV/Excel export button in `ReportsView.tsx` and in `PayrollProcessingView.tsx` for one-click salary sheet download. | `CorporatePayrollRun`, `corporateReportRouter` | Payroll register export test | **High** |

---

## 2. Gap Assessment Summary

* **Total Identified Reference Features:** 7 core modules
* **Fully Verified in PayFlow:** 3 modules (Employee Master, Payslip PDF Generation/Emailing, Payroll Register Reporting)
* **Partial Gaps Identified for Immediate Implementation:** 4 modules:
  1. **New Month Creation:** Frontend modal & backend creation API (`POST /payroll/periods`) with period roll-forward and duplicate prevention.
  2. **Monthly Attendance Matrix:** Aggregated monthly attendance grid with Present Days, Overtime (OT), LOP, Leaves, and calculated Payable Days.
  3. **Monthly Salary Editor:** Interactive grid in `PayrollProcessingView` allowing variable adjustments (Overtime, Bonus, Manual LOP, Incentives) with instant preview and the Saral PayPack "Net Take-Home < 25% of Gross" compliance safeguard.
  4. **TDS Process & Porting to Salary:** Dedicated tax assessment grid calculating annual projection and the "Post computed TDS to salary" action to inject monthly TDS into active payroll slips.

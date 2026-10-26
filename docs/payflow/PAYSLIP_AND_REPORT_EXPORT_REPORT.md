# PayFlow HRMS & Payroll ERP — Payslip & Report Export Report

## 1. Overview
In Saral PayPack, the final phase of monthly payroll operations consists of generating official institutional payslips and exporting executive salary reports (Salary Sheet, Bank Transfer Register, and Attendance Registers).

This report outlines PayFlow's payslip generation architecture, reporting capabilities, export formats, and security enforcement.

---

## 2. Institutional Payslip System

### 2.1 Payslip Architecture & Data Model
- **Endpoint**: `GET /api/v1/self-service/payslips/:id` & `GET /api/v1/payroll/runs/:runId/slips/:slipId/pdf`
- **Component Breakdown**:
  * **Header**: Institution Name, Brand/Logo, Academic / Institutional Affiliation, Pay Period.
  * **Employee Details Grid**:
    - Staff Code, Designation, Department
    - Bank Account Number, Bank Name, IFSC
    - Permanent Account Number (PAN), Provident Fund (PF) UAN, ESIC Number
    - Calendar Days, Loss of Pay (LOP) Days, Payable Days
  * **Earnings Column**:
    - Basic Pay, Dearness Allowance (DA), House Rent Allowance (HRA)
    - Variable Pay / Performance Bonus, Arrears, Overtime
    - Total Gross Salary
  * **Deductions Column**:
    - Provident Fund (PF - Employee Share)
    - Employee State Insurance (ESIC)
    - Professional Tax (PT)
    - Tax Deducted at Source (TDS)
    - Loan / Advance Recovery, Loss of Pay Deduction
    - Total Deductions
  * **Net Payable Box**:
    - Bold highlight of Net Take-Home Salary in Indian Rupees (₹)
    - Statutory Certification statement.

### 2.2 Security & Multi-Tenant Authorization
- Self-Service access strictly validates that employees can only view their own payslips:
  * Attempting to query another employee's payslip ID throws `403 Forbidden` (`Access denied: You are not authorized to view another employee’s payslip`).
  * Verified via automated test `Scenario 21: prevents employee from accessing other employees payslips via API`.
- Administrative access requires explicit `payroll_pda`, `payroll_pvo`, `payroll_pfo`, `payroll_ar_salary`, or `payroll_admin` roles within the same tenant company.

---

## 3. Executive Report Exports

PayFlow provides one-click export capabilities matching Saral PayPack's reporting workflows:

| Report Type | Trigger Location | Format | Exported Fields |
|:---|:---|:---|:---|
| **Salary Sheet / Register** | `PayrollProcessingView` -> "Export Salary Sheet CSV" | CSV / Spreadsheet | Emp Code, Name, Department, Designation, Payable Days, LOP Days, Basic Pay, HRA, Variable Pay, Arrears, Gross Pay, TDS, Deductions, Net Pay, Take-Home < 25% Flag |
| **Monthly Attendance Matrix** | `AttendanceView` -> "Export CSV" | CSV / Spreadsheet | Emp Code, Name, Department, Calendar Days, Present Days, Absent Days, Paid Leaves, LOP Days, Overtime Hours, Payable Days |
| **Individual Payslip Document** | `PayrollProcessingView` & Self-Service -> "Print / Save PDF" | Print-Ready HTML & PDF | Complete Institutional Salary Bill with Watermark and Statutory Verification |

---

## 4. Verification & Testing
- Unit and integration tests verify:
  * Proper aggregation of lines by `headType` (`EARNING` vs `DEDUCTION`).
  * Accuracy of printed net pay vs calculated net totals.
  * Strict cross-tenant isolation preventing Tenant B from accessing Tenant A payslip documents.

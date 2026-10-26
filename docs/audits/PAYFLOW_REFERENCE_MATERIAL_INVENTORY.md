# PAYFLOW — Reference Material Inventory & Media Analysis Audit

**Document Reference**: `PAYFLOW-REF-INV-001`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Auditor**: Senior Payroll Product Architect & QA Lead  
**Status**: `VERIFIED & DOCUMENTED`

---

## 1. Executive Summary

This inventory documents all reference artifacts discovered in the repository root and documentation trees. The references comprise:
- **3 High-Definition Full-Length Video Recordings** (covering Spine HR Suite, Saral PayPack, and React/GAS HRMS Architecture).
- **8 High-Resolution Reference Screenshots** (covering SpineHRNg Component Setup, Pay Summary Codes, CTC sheets, Arrears processing, and Salary Structure Sheet Mode).
- **Comprehensive Historical Implementation & Audit Reports**.

Every accessible artifact has been indexed with exact file paths, media properties, duration, resolution, codecs, and inspected workflows.

---

## 2. Discovered Reference Media Inventory

### 2.1 Video Recordings Analysis

All three videos were inspected using `ffprobe` and frame extraction via `ffmpeg`:

| # | Filename & Path | File Size | Duration | Resolution / Codec | Status | Subject Matter & Workflow Demonstrated |
|:---:|:---|:---:|:---:|:---:|:---:|:---|
| **V1** | [`A Guide On March End Salary Processing with Spine HR Suite.mp4`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/A%20Guide%20On%20March%20End%20Salary%20Processing%20with%20Spine%20HR%20Suite.mp4) | 20,543,348 bytes | 11m 26s (686.61s) | 640x360 / H.264 / AAC | `FULLY INSPECTED` | March fiscal year-end salary processing in Spine HR Suite (`mydemo.payrollrx.in`). Demonstrates: Employee-wise reimbursement exemptions (`/Reim/EmployeeWise`), Tax Projector with regime comparisons (`/Tax/TaxProjector`), Monthly & Yearly payslip generation, and fiscal year closure. |
| **V2** | [`salary-slip--attendance---how-to-build-a-full-hr--payroll-erp-with-google-apps-script-and-react.mp4`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/salary-slip--attendance---how-to-build-a-full-hr--payroll-erp-with-google-apps-script-and-react.mp4) | 21,424,010 bytes | 15m 44s (944.10s) | 640x360 / AV1 / AAC | `FULLY INSPECTED` | Full-stack HRMS ERP architecture (React frontend + REST endpoints). Demonstrates: Attendance time-tracking, LOP deduction calculations, shift rosters, employee master drawer, dynamic custom fields, PDF payslip generation, and one-click bulk email dispatch. |
| **V3** | [`saral demo.mp4`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/saral%20demo.mp4) | 11,027,692 bytes | 6m 50s (410.23s) | 640x342 / VP9 / AAC | `FULLY INSPECTED` | Relyon Saral PayPack v16.00 desktop application walkthrough. Demonstrates: `Monthly Salary Editor` grid with `Entry` (variable inputs) and `Calculation` tabs, side-by-side component breakdown, `Port computed TDS to salary` wizard, salary advance deductions, overtime rate evaluation, and net pay threshold alerts. |

---

### 2.2 Screenshot Inventory & Visual Breakdown

All 8 reference screenshots were inspected directly at original resolution:

| # | Filename & Path | Resolution | Product & Module | URL / Location | Key Controls & Observed Data Elements |
|:---:|:---|:---:|:---|:---|:---|
| **S1** | [`Screenshot 2026-10-26 103128.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20103128.png) | 1920x1080 | SpineHRNg / Component Setup | `partnersng.spinedm.in/Salary/ColumnMaster` | **Pay Code Grid**: Columns for Grade (`AMI`), Code (`d1` to `d13`, `v1` to `v3`), Head Name (`PROV.FUND`, `E.S.I.C`, `P.Tax`, `TDS`, `Loan`, `SalaryAdvance`, `VPF`, `LWFEE`), Column Type (`Formula`, `Slab`, `At Pay Time`), Formula definitions (`v1*12/100`, `roundup((v3*1.75/100),0)`), Calc On Present Days (`No`), Attach As (`Nothing`, `Other Loans`). |
| **S2** | [`Screenshot 2026-10-26 103457.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20103457.png) | 1920x1080 | SpineHRNg / Component Setup | `partnersng.spinedm.in/Salary/ColumnMaster` | Duplicate high-resolution view of the Pay Code master table confirming Grade dropdown filter, Excel export, and column sorting. |
| **S3** | [`Screenshot 2026-10-26 103522.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20103522.png) | 1920x1080 | SpineHRNg / Payroll Navigation | Left Menu Flyout | Complete 13-node hierarchical payroll navigation tree: Component Setup, Salary Structure, CTC, Salary Process, Salary Slips, Payment Authorization, Release Payment, Supplementary, Arrears, Final Settlement, Bonus Calculation, Gratuity, Financial Reports. |
| **S4** | [`Screenshot 2026-10-26 103612.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20103612.png) | 1920x1080 | SpineHRNg / Summary Variables | `partnersng.spinedm.in/Salary/SummaryVariables` | **Create Pay Summary Code**: Grade selector, Code input, Formula editor (0/255 chars), `Execute for current month`, `Previous Month Flag`, `Group based on` (Employee Name), 12-month checkboxes for `Calculate for past year`, `Calculate for current year`, and `Payable In`. |
| **S5** | [`Screenshot 2026-10-26 103948.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20103948.png) | 266x784 | Reference Architecture Tree | Architectural Diagram | Detailed sub-menu tree mapping all 13 modules into specific screens (Sheet Mode, Bulk Mode, Approved, Proposed, Month List, Batch Process, Lock/Unlock Month, Adhoc Payment Entry/Maker/Checker, Payout Entry, File Report Builder, Journal Voucher, Reconciliation). |
| **S6** | [`Screenshot 2026-10-26 104145.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20104145.png) | 1920x1080 | SpineHRNg / CTC Master | `partnersng.spinedm.in/Salary/CTC` | **Current CTC Filter**: `GENERAL FILTER` and `ADDITIONAL FILTER` tabs, `Singular` vs `Tabular` toggle, filter inputs for Company, Grade, Branch, Department, Designation, Division, Unit, Category, Project, Employee Name, and `Show All Employees` checkbox. |
| **S7** | [`Screenshot 2026-10-26 104248.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/Screenshot%202026-10-26%20104248.png) | 1920x1080 | SpineHRNg / Arrears | `partnersng.spinedm.in/Salary/Arrears` | **Run Arrears**: `From Month - Year` (Sep-2026), `To Month - Year` (Sep-2026), `Pay In Month - Year` (Mar-2027), multi-dimensional organization filters, and execution action buttons. |
| **S8** | [`image.png`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/image.png) | 1920x1080 | SpineHRNg / Salary Structure | `partnersng.spinedm.in/Salary/SalaryStructure/Sheet?rf=E` | **Sheet Mode Salary Calculator**: Employee search (`Sandeep Kulkarni`), Monthly/Daily toggle, Basic input, Grade (`Blue Collar`), 4-column balanced ledger: Allowances (Basic, DA, Conveyance, Washing, OT, Medical, Other Allowance, Bonus = ₹16,126), Deductions (PF, ESIC, PT, TDS, Loan = ₹2,293), Variables (PF Column, ESIC Gross, Pension, Admin charges), Others (Total Days: 30, Days Present: 30). |

---

### 2.3 Historical Documentation Inventory

| Document File | Purpose & Focus Area |
|:---|:---|
| [`PAYROLL_FORMULA_ENGINE_REPORT.md`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/PAYROLL_FORMULA_ENGINE_REPORT.md) | Technical audit of AST Formula Parser, Kahn's algorithm topological sorting, 12 calculation types, and Decimal.js arithmetic. |
| [`PAYROLL_VIDEO_FEATURE_PARITY.md`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/PAYROLL_VIDEO_FEATURE_PARITY.md) | Initial 38-feature traceability matrix against the React ERP YouTube reference video. |
| [`PAYROLL_UAT_REPORT.md`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/PAYROLL_UAT_REPORT.md) | 25-scenario authoritative test execution report for Indian statutory payroll calculation. |
| [`PAYROLL_NEXT_STEPS_REPORT.md`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/PAYROLL_NEXT_STEPS_REPORT.md) | Architectural roadmap for shadow payroll execution, backup & recovery, CA handoff, and pilot verification. |
| [`PAYROLL_POST_IMPLEMENTATION_AUDIT.md`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/PAYROLL_POST_IMPLEMENTATION_AUDIT.md) | Compliance and release gate certification across payroll engine modules. |

# Saral PayPack Reference Video Analysis & Forensic Inspection

**Document ID:** `SARAL_PAYPACK_VIDEO_ANALYSIS`  
**Reference Asset:** `saral demo.mp4` (Duration: 00:06:50.23, Resolution: 640x342, Codec: VP9 / AAC stereo, 11,027,692 bytes)  
**Analysis Date:** October 22, 2026  
**Auditor:** Antigravity AI Engineering (Architect, Payroll Domain Analyst, Lead QA)  
**Objective:** Complete forensic breakdown of all screens, fields, business workflows, calculations, and data relationships identifiable in the reference video for implementation in PayFlow HRMS & Payroll ERP.

---

## 1. Video Technical Metadata

| Attribute | Observed Value | Technical Verification |
|:---|:---|:---|
| **Container & Format** | QuickTime / MP4 (ISO Media) | Verified via `ffprobe` (major brand: `isom`) |
| **Duration** | 410.226 seconds (6 min 50.2 sec) | Total frames @ 30 fps: ~12,306 frames |
| **Video Stream** | Google VP9 (`vp09`), Profile 0 | Resolution: 640 × 342, Sample Aspect Ratio: 1:1 |
| **Color Profile** | yuv420p, bt709 primaries/transfer | Progressive scan |
| **Audio Stream** | AAC (LC), Stereo, 44,100 Hz | Bitrate: ~105 kbps |
| **Application Identified** | Saral PayPack v16.00 [Premium / Corporate] | Relyon Softech Ltd., Bangalore |

---

## 2. Chronological Scene & Module Breakdown

Representative frames were extracted at 10-second intervals (41 frames) and key action timestamps (15 milestone frames) to capture all transitions.

```
00:00 ─── [Title Screen: 7 Core Monthly Processes]
00:15 ─── [New Month Creation & Period Roll-Forward]
00:35 ─── [Employee Details Master, Classification & Statutory]
02:25 ─── [Attendance Details Matrix & Payable Days Evaluation]
02:50 ─── [Monthly Salary Editor, Structure Heads & Calculation]
03:45 ─── [TDS Process, Annual Tax Computation & Porting]
04:30 ─── [Payslip Generation, Preview & Email Dispatch]
05:25 ─── [Salary Sheet Register, Multi-Column Breakdown & Export]
06:30 ─── [Outro / Conclusion]
```

---

## 3. Detailed Feature-by-Feature Forensic Analysis

### 3.1 Module 1: Title Screen & Core Process Index (00:00 - 00:15)
* **Directly Observed:**
  * Clean presentation slide titled `"MONTHLY SALARY PROCESS"`.
  * Explicitly highlights the 7 standard operational phases required for monthly institutional payroll:
    1. **NEW MONTH CREATION**
    2. **EMPLOYEE DETAILS**
    3. **ATTENDANCE DETAILS**
    4. **SALARY EDITOR**
    5. **TDS PROCESS**
    6. **PAYSLIPS DOWNLOAD**
    7. **SALARY SHEET DOWNLOAD**
* **Application Design Implication for PayFlow:**
  * PayFlow's Payroll Workbench and navigation must provide intuitive access to these exact workflow phases without fragmented navigation.

---

### 3.2 Module 2: New Month Creation (00:15 - 00:35)
* **Directly Observed:**
  * User clicks toolbar button `New Month`.
  * Modal Dialog titled **"Create New Month"**:
    * `Month/Year`: Dropdown selector (e.g. `Jan/2023`).
    * Actions: `Save`, `Delete`, `Close`.
    * System status bar displays the current active period: `Dec/2022 | Quick Info | Single User-ADMIN`.
    * Upon clicking `Save`, a progress modal appears: `"Please wait while configuring for Advanced Leave Management... Initializing Advanced Leave Management"`.
* **Inferred Workflow Logic:**
  * Creating a new month rolls forward the active calendar period.
  * Preserves existing employees and active salary assignments.
  * Initializes leave ledgers, working days, and attendance tracking grids for the newly created month.
  * Safeguards: Duplicate month creation is prevented; `Delete` / `Undo Month` is permitted if payroll has not been finalized.

---

### 3.3 Module 3: Employee Details Master (00:35 - 02:25)
* **Directly Observed:**
  * Window Title: **"Employee Details"**.
  * Identity & Demographics:
    * `Sl no`, `Emp ID`, `Order By Name`, `Short Name`.
    * `Employee Name`, `Father's Name`, `Mother's Name`.
    * `Gender`: Radio options (`Male`, `Female`, `Transgender`).
    * `Date of Birth`, `Marital Status` (`SINGLE`, `MARRIED`), `Spouse Name`.
  * Classification & Tenure:
    * `Designation`, `Occupation`, `Division`, `Department`, `Grade`, `Branch` (e.g. `Bengaluru`).
    * `Date of Joining`, `Salary Calculate from` (effective compensation date), `Date of Leaving`, `Reason for Leaving`.
  * Statutory & Banking:
    * `Bank A/C No.`, `Bank Name`, `Branch`, `IFSC Code`.
    * `PF / ESI / PT Details`:
      * `PF No.` (e.g. `BGBNG1740444000`), `PF No. for Dept. File`, `UAN`.
      * Checkboxes: `Restrict PF Contribution` (statutory ₹15,000 ceiling), `Zero Pension`, `Zero PT`.
      * `ESI No.`, `ESI Dispensary`.
    * `TDS Details`: `PAN`, `Verify` button, `TRACES` status, `Remarks`.
  * Employee Count Dashboard:
    * `Total Employee: 153`, `Current Employee: 42`, `Left Employee: 111`, `Listed Employee: 153`.
  * Salary Structure Assignment Sub-Dialog:
    * Assigns salary structure with effective date (`Valid From`), displaying formula lines for Basic, HRA, Conveyance, PF, ESI, and Professional Tax.

---

### 3.4 Module 4: Attendance Details Matrix (02:25 - 02:50)
* **Directly Observed:**
  * Window Title: **"Attendance - Monthly - (Attendance)"**.
  * Filtering Header:
    * `Month/Year`: `Jan/2023`.
    * `Department`: Dropdown selector.
    * `Designation`: Dropdown selector.
    * Counter: `Listed : 7`.
  * Grid Columns:
    1. `Emp ID` (e.g. 1010, 1115, 1119, 1121, 1137, 1141, 1142)
    2. `Employee Name` (Anantha Sadhu, Arvind Mishra, etc.)
    3. `Pay Days` (e.g. 30.00, 31.00)
    4. `Present Days` (e.g. 20.00, 22.00)
    5. `OT1` (Overtime hours or units, e.g. 200.00, 150.00, 100.00)
    6. `LOP` (Loss of Pay / Unpaid days, e.g. 1.00)
    7. `CO` (Compensatory Off)
    8. `CW` (Compensatory Work)
    9. `OOD` (Out of Office / On Official Duty)
    10. `CL` (Casual Leave)
    11. `SL` (Sick Leave)
    12. `PL` (Privilege / Paid Leave)
    13. `MTL` (Maternity Leave)
    14. `PTL` (Paternity Leave)
    15. `WFH` (Work From Home)
    16. `MC` (Medical / Misconduct)
    17. `Remarks`
  * Footer:
    * `Salary Calender Days : 31`.
    * Checkboxes: `Calculated`, `Entry Locked / Month Locked`.
    * `Close` button.

---

### 3.5 Module 5: Monthly Salary Editor (02:50 - 03:45)
* **Directly Observed:**
  * Window Title: **"Monthly Salary Editor"**.
  * Controls & Filters:
    * `Sal Structure` selector, `Month/Year` (`Jan/2023`), `Quick search by`, `Filter` button.
    * Checkbox: `Side View`.
    * Dual tabs: `Entry` (data entry mode) and `Calculation` (computed values).
  * Spreadsheet Grid:
    * Displays staff with `Pay Days`, `Present Days`, `BASIC+DA`, `HRA`, `Empr PF`, `Incentive`, `Gross`, `Deductions`, `Net`.
  * Statutory & Sanity Safeguard:
    * Checkbox: **`Show Net less than 25% of Gross in [Blue]`** (Crucial statutory compliance feature: alerts payroll officers when deductions exceed 75% of gross earnings, violating legal take-home minimums).
    * Highlights: `Resigned Employee(s)` rendered in distinct red highlight.
  * Action Toolbar:
    * `Calculate` (launches batch formula calculation progress dialog showing structure ID, employee count, heads count).
    * `Over Time` (opens overtime earnings adjustment).
    * `TDS` (opens tax deduction allocation).
    * `EMI Details` (manage active loan installment deductions).
    * `Adv. Bank` (bank advice payment list).
    * `Rel. Salary` (release salary hold).
  * Status Indicators:
    * `Employee Listed : 38`, `Joined : 0`, `Left : 0`, `Salary Affected : 0`, `Hold : 0`.

---

### 3.6 Module 6: TDS Process (03:45 - 04:30)
* **Directly Observed:**
  * Window Title: **"Port Details / Port computed TDS to salary"**.
  * Header Inputs:
    * `Financial Year`: e.g. `2022-2023`.
    * Checkbox: `Over write`.
    * Checkbox: `Extra Polate` (extrapolates full 12-month annual gross based on current monthly compensation).
  * Context Actions:
    * Right-click options on employee tax grid: `Tax Computation Details`, `Declarations`, `Calculate Income Tax`, **`Post computed TDS to salary`**.
  * Grid Data:
    * `Emp ID`, `Ref No.`, `Name`, `Taxable Gross`, `Chapter VI-A Deductions (80C, 80D)`, `Tax on Total Income`, `Rebate 87A`, `Cess (4%)`, `Total Tax Payable`, `TDS Deducted Till Date`, `Balance Tax`, `TDS Current Month`.
  * Operation:
    * Clicking `Port Data` batches through all listed employees (progress bar: `Employees listed: 27, 67%`), updating the monthly TDS deduction column in the active payroll run.

---

### 3.7 Module 7: Payslip Downloads & Distribution (04:30 - 05:25)
* **Directly Observed:**
  * Window Title: **"Pay Slip"**.
  * Selection & Filter:
    * Month/Year selection, Employee selection (All / Range / Department), Format selection.
  * Payslip Layout:
    * Clean corporate header with Company Name and Address.
    * Employee Details: Code, Name, Designation, Department, Branch, Bank Account, IFSC, PF Number, UAN Number.
    * Attendance Summary: Calendar Days (30/31), Paid Working Days, LOP Days, Present Days.
    * Two-column presentation:
      * Left: Itemized Earnings (Basic, HRA, Allowances, Gross Pay).
      * Right: Itemized Deductions (EPF, ESIC, Professional Tax, TDS, Loan EMI, Total Deductions).
    * Net Take-Home: Prominently formatted in numeric currency and capitalized Words (`"Rupees ... Only"`).
  * Distribution:
    * `Email Payslips` configuration dialog supporting SMTP Server, Port, SSL/TLS, Subject, Body, and direct bulk PDF attachment delivery.

---

### 3.8 Module 8: Salary Sheet Download / Register (05:25 - 06:30)
* **Directly Observed:**
  * Window Title: **"Salary Sheet"**.
  * Full institutional payroll register grid:
    * Row per employee, sorted by Employee Code or Department.
    * Multi-column financial ledger: Pay Days, Basic Pay, HRA, Medical, Conveyance, Special Allowance, Gross Earnings, PF (Employee), ESI (Employee), PT, TDS, Loan Deductions, Total Deductions, Net Salary Payable, Employer PF (12%), Employer ESI (3.25%), Total CTC Cost.
    * Footer Totals: Reconciled sum of all earnings, deductions, disbursements, and employer remittances.
    * Export: One-click export to Microsoft Excel (`.xlsx` / `.csv`) and Print / PDF preview.

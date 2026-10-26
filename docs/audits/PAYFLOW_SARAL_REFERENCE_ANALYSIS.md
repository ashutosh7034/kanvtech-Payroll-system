# PAYFLOW — Saral PayPack Reference Analysis & Workflow Decomposition

**Document Reference**: `PAYFLOW-REF-SARAL-003`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Media Source**: `saral demo.mp4` (Duration: 6m 50s / 410.23s / VP9 Video Codec)  
**Status**: `VERIFIED & AUDITED`

---

## 1. Executive Summary

This report documents the deep workflow analysis of Relyon Softech's **Saral PayPack v16.00 [Premium / Corporate]**, extracted directly from `saral demo.mp4`. 

Saral PayPack is a widely deployed desktop payroll software in India known for its operational density, robust TDS withholding calculations, and fast grid-based salary adjustment workflows. The video demonstrates three core features that offer immediate product patterns for PAYFLOW:
1. **The Dual-Mode Monthly Salary Editor** (`Entry` vs `Calculation` modes with a real-time side-view card).
2. **Bulk Variable Input Import/Export** (Incentives, Arrears, Salary Advance recovery via Excel/CSV).
3. **The "Port Computed TDS to Salary" Subsystem** (Regime-based income tax assessment and monthly withholding porting).

---

## 2. Key Workflows Demonstrated in Saral PayPack

### 2.1 The Monthly Salary Editor (`Entry` vs `Calculation` Modes)

#### Visual Evidence (Frames 002, 007):
- **Window Header**: `Monthly Salary Editor` (Month/Year dropdown, Sal Structure selector, Quick search, and `Side View` toggle).
- **Tab 1: Calculation View**:
  - Displays high-density spreadsheet grid: `Emp ID`, `Name`, `Pay Days`, `Present Days`, `BASIC+DA`, `HRA`, `Empr PF`, `Incentive`.
  - Right-hand collapsible `Side View` card dynamically displays the complete ledger for the selected employee:
    - *Earnings Heads*: BASIC+DA (₹4,20,000), HRA (₹2,80,000), Empr PF (₹1,800), PT Earning, Age, Service Years (4.75), Attendance Bonus.
    - *Gross Total*: ₹7,01,200.00.
    - *Deductions Heads*: PT (₹200), Loan Recovery (₹50,000), Deduction Total (₹50,200.00).
    - *Net Amount*: ₹6,51,000.00 (Derived Total: ₹7,00,000.00).
- **Tab 2: Entry Mode**:
  - Purpose: Capturing monthly variable inputs before triggering bulk calculations.
  - Columns: `Emp ID`, `Name`, `Pay Days`, `Present Days`, `Incentive`, `Arrear`, `Sal Advance`, `Salary Hold`.
  - Actions: One-click `Export` to Excel template and `Import` from populated spreadsheet.
- **Bottom Status & Exception Bar**:
  - Displays summary counters: `Employee Listed: 39 | Joined: 0 | Left: 1 | Salary Affected: 1 | Hold: 0`.
  - Color-coded safety alerts: Flags in blue if `Net take-home is less than 25% of Gross`.

#### PAYFLOW Adaptation:
- PAYFLOW implements this exact concept in [`MonthlySalaryEditorModal.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/MonthlySalaryEditorModal.tsx) and [`corporatePayroll.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/payroll/corporatePayroll.routes.ts#L1222-L1380):
  - `GET /api/v1/payroll/runs/:id/editor`: Delivers all employees in the run with their attendance days, salary heads, and editable adjustments.
  - `PATCH /api/v1/payroll/runs/:id/adjustments`: Bulk-updates attendance adjustments, incentives, and arrears with audit logs.
  - Frontend displays real-time gross, deduction, and net pay recalculations with take-home safety warnings.

---

### 2.2 Individual Salary Structure & Datewise Increments (Frame 004)

#### Visual Evidence:
- Individual employee compensation window (`Salary`).
- Displays earnings heads, statutory PF/ESI rates, and tracks datewise historical increments (`No Datewise increment(s) found.`).
- Demonstrates voluntary provident fund (`PF Vol. %` and `PF Voluntary`).

#### PAYFLOW Adaptation:
- In PAYFLOW, employee salary structures are managed under [`CompensationView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/CompensationView.tsx) and [`EmployeesView.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/EmployeesView.tsx).
- PAYFLOW tracks effective-dated salary revisions via model `EmployeeSalaryRevision` in Prisma, ensuring salary changes mid-year do not corrupt historical payroll runs.

---

### 2.3 The "Port Computed TDS to Salary" Wizard (Frame 010)

#### Visual Evidence:
- **Window Title**: `Port computed TDS to salary`
- **Fields**: Financial Year (`2022 - 2023`), Month/Year (`Jan/2023`), Salary Structure selector.
- **Grid Columns**:
  - `Emp ID`
  - `Name`
  - `Taxable Income` (e.g. ₹72,05,000.00)
  - `Tax Payable` (Annual projected liability: e.g. ₹12,71,204.00)
  - `TDS Deducted` (YTD tax already withheld: e.g. ₹12,41,523.00)
  - `EMI For Month` (Remaining annual liability divided by remaining months: e.g. ₹5,14,841.00)
  - `Edit TDS` (Authorized manual override column)
- **Status Alerts & Statutory Rules**:
  - Dark alert box: *TDS Deducted is more than Tax Payable* (Over-deduction warning).
  - Brown alert box: *Edited TDS is more than Net Amount* (Negative pay prevention).
  - Statutory PAN Warning: `*Show who does not hold PAN (Note: If PAN is not available then Tax will be deducted at the rate of 20%)`.
- **Action Buttons**: `Save`, `Port` (Posts monthly tax into active salary deductions), `TDS-SI`, `Filter`, `OneTimeTax`.

#### PAYFLOW Adaptation:
- Implemented in [`TdsTaxStudioModal.tsx`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/frontend/src/pages/TdsTaxStudioModal.tsx) and [`corporatePayroll.routes.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/src/modules/payroll/corporatePayroll.routes.ts#L1493-L1660):
  - `GET /api/v1/payroll/tds/summary`: Calculates annualized gross, Chapter VI-A deductions, Old vs New regime tax liability, and computes monthly withholding EMI across remaining financial year months.
  - `POST /api/v1/payroll/tds/port-to-salary`: Ports the calculated monthly TDS figure directly into employee salary items as `TDS_TAX`.
  - Flags missing PAN with 20% statutory minimum withholding per Section 206AA of Indian Income Tax Act.

# Corporate HRMS & Payroll - Open Business Rules & Policies

This document records the standard Indian corporate statutory formulas, configurable policies, and corporate conventions implemented in the system.

---

## 1. Statutory Compliance Rules (India)

### 1.1 Employees' Provident Fund (EPF)
- **Employee Contribution:** 12% of PF Gross (`Basic Pay + Dearness Allowance`).
- **Wage Ceiling Option:**
  - Statutory ceiling: ₹15,000 per month (Max deduction = ₹1,800/month).
  - Uncapped option: Many corporate IT firms allow voluntary 12% on actual Basic without the ₹15,000 cap.
- **Employer Contribution (Total 12%):**
  - **Employee Pension Scheme (EPS):** 8.33% of PF Gross, capped at ₹1,250/month (ceiling of ₹15,000).
  - **EPF (Employer share):** Remaining 3.67% of PF Gross (plus the difference if EPS is capped).
  - **EDLI (Employees' Deposit Linked Insurance):** 0.50% (subject to statutory cap).
  - **EPF Admin Charges:** 0.50% (minimum ₹500 per month).

### 1.2 Employee State Insurance (ESIC)
- **Applicability Wage Ceiling:** Gross wages up to ₹21,000 per month (₹25,000 for employees with disability).
- **Employee Share:** 0.75% of Gross wages.
- **Employer Share:** 3.25% of Gross wages.
- **Exemption Rule:** If gross wages exceed ₹21,000 in the middle of a contribution period (April–September or October–March), deductions continue until the end of that statutory window.

### 1.3 Professional Tax (PT)
- **State-Specific Slabs:** Professional Tax rates are determined by the employee's work location branch state.
- **Standard Maharashtra Slabs (Monthly):**
  - Gross salary up to ₹7,500: ₹0
  - Gross salary ₹7,501 to ₹10,000: ₹175
  - Gross salary above ₹10,000: ₹200 (except February where it is ₹300).
  - Female employees earning up to ₹25,000 are exempt.
- **Karnataka Slabs:**
  - Gross salary up to ₹24,999: ₹0
  - Gross salary ₹25,000 and above: ₹200 per month.
- **Configurability:** All slabs are stored in database master table `ProfessionalTaxSlab` with effective dates.

### 1.4 Tax Deducted at Source (TDS / Income Tax)
- **Dual Regime Support:**
  - **New Tax Regime (Section 115BAC - Default):** Simplified slab structure with standard deduction (₹75,000 for FY 2024–25 / 2025–26) and Section 87A rebate for taxable income up to ₹7,00,000.
  - **Old Tax Regime (Optional via declaration):** Standard deduction (₹50,000), Chapter VI-A deductions (Section 80C up to ₹1,50,000, 80D medical insurance up to ₹25,000/₹50,000, 80CCD(1B) NPS up to ₹50,000, Section 24b Home Loan Interest up to ₹2,00,000, and HRA exemption).
- **Monthly Proration:** Annual projected tax is computed from declaration and divided across remaining months in the financial year.

### 1.5 Gratuity & Full-and-Final Settlement
- **Formula:** `(15 * Last Drawn Basic * Number of Completed Years of Service) / 26`
- **Eligibility:** Minimum 5 years of continuous service (except in cases of death or disablement).
- **Statutory Ceiling:** ₹20,00,000 tax-free limit under the Payment of Gratuity Act.

---

## 2. Attendance & Leave Calculation Conventions

### 2.1 Payable Days Convention
- `Working Days in Month` = Total calendar days (28, 29, 30, or 31).
- `Payable Days` = `Total Days - LOP Days + Paid Leave Days + Paid Weekly Offs + Paid Holidays`.
- If an employee joins in the middle of the month (e.g. 16th of 30-day month), initial working days are prorated from joining date to month end.

### 2.2 Attendance Regularization
- Employees can regularize up to a policy-defined limit (e.g. 3 times per month).
- Must provide reason code (e.g., Biometric Machine Glitch, On-Duty Client Visit, Official Travel, Forgot to Punch).
- Requires reporting manager approval prior to the monthly attendance cutoff date.

---

## 3. Offboarding & Final Settlement Conventions

1. **Notice Period Recovery / Pay:**
   - If an employee is relieved earlier than the contractual notice period without a waiver, notice shortfall days are deducted at the rate of `(Gross or Basic Salary / 30) * Shortfall Days`.
2. **Leave Encashment:**
   - Privilege Leave balance as on the Last Working Day (LWD) is encashed: `(Last Drawn Basic / 30) * Earned Leave Balance Days`.
3. **Recovery Offsets:**
   - Unrecovered loan principal, travel advance balances, or unreturned IT asset replacement costs are offset against total gross payable in F&F.

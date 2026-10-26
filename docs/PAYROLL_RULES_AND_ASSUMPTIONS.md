# Corporate HRMS & Payroll Engine: Business Rules, Mathematical Formulas, and Statutory Assumptions

## 1. Proration Mathematical Rules

### 1.1 Attendance & Payable Ratio
Proration is computed dynamically based on the exact calendar days of the payroll month (28, 29, 30, or 31 days) rather than a fixed 30-day assumption.

$$\text{Proration Ratio} = \frac{\text{Payable Days}}{\text{Calendar Days in Month}}$$

Where:
- $\text{Payable Days} = \max(0, \text{Present Days} + \text{Approved Paid Leaves} + \text{Weekly Offs} + \text{Paid Holidays})$
- $\text{LOP Days} = \text{Approved Unpaid Leaves} + \text{Unexcused Absent Days}$
- $\text{Calendar Days} = \text{Date Diff}(\text{Period End}, \text{Period Start}) + 1$

### 1.2 Mid-Month Lifecycle Adjustments
- **Mid-Month Joining**: If an employee joins on Day $J$ ($J > 1$), payable calendar days are bounded to $[J, \text{Period End}]$. Days prior to $J$ are treated as unpayable.
- **Mid-Month Exit**: If an employee exits on Day $E$ ($E < \text{Period End}$), payable days are bounded to $[\text{Period Start}, E]$.
- **Mid-Month Salary Revision**: When an employee's salary is revised on Day $R$, the pay period is partitioned into:
  1. Window 1 $[1, R-1]$ evaluated at Structure 1.
  2. Window 2 $[R, \text{Period End}]$ evaluated at Structure 2.
  Component amounts are weight-summed across both windows.

### 1.3 Overtime Calculation
$$\text{Hourly Basic Rate} = \frac{\text{Monthly Basic}}{\text{Calendar Days} \times 8}$$
$$\text{Overtime Pay} = \text{Hourly Basic Rate} \times \left(\frac{\text{Overtime Minutes}}{60}\right) \times 2.0$$
Standard statutory double-rate multiplier ($2.0\times$) applies for verified factory/commercial overtime hours.

---

## 2. Salary Component Inclusion & CTC Reconciliation Rules

### 2.1 Component Categories and Treatment
1. **`FIXED_EARNING`**: Regular monthly salary (Basic, HRA, Conveyance, Special Allowance). Prorated by attendance ratio; included in Gross Pay; taxable.
2. **`VARIABLE_EARNING`**: Performance bonus, incentive, overtime. Not prorated; added directly to Gross Pay.
3. **`REIMBURSEMENT`**: Nontaxable expense payouts approved by finance. Added to take-home disbursements; excluded from statutory contribution wages.
4. **`STATUTORY_DEDUCTION`**: Employee mandatory contributions (EPF, ESIC, PT, TDS). Subtracted from Gross Pay.
5. **`LOAN_RECOVERY`**: Company loan EMI repayment. Subtracted from Gross Pay; capped at $\min(\text{Monthly EMI}, \text{Outstanding Balance})$.
6. **`EMPLOYER_CONTRIBUTION`**: Employer statutory liability (Employer EPF, Employer ESIC). Added to employer cost; not deducted from take-home pay.

### 2.2 Two-Pass CTC Reconciliation Policy
$$\text{Monthly CTC} = \frac{\text{Annual CTC}}{12}$$
$$\text{Target Monthly Gross} = \max(0, \text{Monthly CTC} - \text{Total Employer Statutory Costs})$$
$$\text{Balancing Component (Special Allowance)} = \max(0, \text{Target Monthly Gross} - \sum \text{Other Fixed Earnings})$$

This deterministic two-pass calculation guarantees exact reconciliation where:
$$\text{Gross Earnings} + \text{Employer Contributions} = \text{Total CTC}$$
No arbitrary unexplained allowances are created.

---

## 3. Statutory Contribution Rules and Formulas

### 3.1 Employees' Provident Fund (EPF)
- **Governing Law**: Employees' Provident Funds and Miscellaneous Provisions Act, 1952.
- **Statutory Wage Ceiling**: ₹15,000 per month.
- **Employee Contribution**: 12.0% of PF Wage Basis.
- **Employer Contribution Allocation**:
  - Employee Provident Fund (EPF): 3.67%
  - Employee Pension Scheme (EPS): 8.33% (subject to ₹15,000 wage ceiling = ₹1,250 max)
  - Administrative charges & EDLI: Applied according to employer profile.
- **Configured Wage Basis Modes**:
  1. `CEILING_15000`: $\min(\text{Basic}, ₹15,000 \times \text{Proration Ratio}) \times 12\%$
  2. `ACTUAL_BASIC` / `ACTUAL_PF_WAGES`: $\text{Basic} \times 12\%$ (uncapped voluntary contribution)
  3. `FIXED_1800`: Fixed ₹1,800 monthly deduction regardless of basic pay.
- **Exemption Treatment**: If `pfStatus == 'NOT_APPLICABLE'`, deduction is ₹0.00 and an explicit statutory remark is recorded in the calculation snapshot.

### 3.2 Employees' State Insurance (ESIC)
- **Governing Law**: Employees' State Insurance Act, 1948.
- **Eligibility Threshold**: Gross wage $\le ₹21,000$ per month (or ₹25,000 for employees with disability).
- **Employee Rate**: 0.75% of Gross Wages.
- **Employer Rate**: 3.25% of Gross Wages.
- **Rounding Policy**: ESIC contributions round up to the next higher rupee ($\lceil \text{amount} \rceil$).

### 3.3 Professional Tax (PT)
- **Maharashtra State Slabs (State Act 1975)**:
  - Monthly Gross $< ₹7,500$ (Men) / $< ₹10,000$ (Women): ₹0
  - Monthly Gross $₹7,500$ to $₹10,000$ (Men): ₹175
  - Monthly Gross $> ₹10,000$: ₹200 per month (April to January)
  - **February Surcharge**: ₹300 in February to reconcile the annual statutory limit of ₹2,500.

### 3.4 Income Tax & TDS (Finance Act 2024 / 2025 - Section 115BAC)
- **New Tax Regime Slabs (Default)**:
  - ₹0 to ₹3,00,000: Nil
  - ₹3,00,001 to ₹7,00,000: 5%
  - ₹7,00,001 to ₹10,00,000: 10%
  - ₹10,00,001 to ₹12,00,000: 15%
  - ₹12,00,001 to ₹15,00,000: 20%
  - Above ₹15,00,000: 30%
- **Standard Deduction**: ₹75,000 for salaried employees under New Regime.
- **Section 87A Rebate**: Full tax rebate for taxable income up to ₹7,00,000 (annual tax liability is zero).
- **Health & Education Cess**: 4% on calculated tax liability.
- **Monthly TDS Withholding**: $\frac{\text{Annual Estimated Liability}}{12}$, or authorized monthly manual override.

---

## 4. Unresolved Compliance Decisions & Legal Disclaimers

> [!IMPORTANT]
> The calculations implemented in this engine follow standard Indian statutory schedules and established enterprise practices. However, corporate payroll processing requires formal validation against specific establishment registrations and judicial interpretations:

1. **Supreme Court 2019 Wage Definition Ruling (RPFC West Bengal vs. Vivekananda Vidyamandir)**:
   - Requires inclusion of special allowances and non-variable allowances in PF wage definitions when uniformly paid. Establishments must configure component-level `isPfGross` flags in the Salary Component Master according to legal counsel guidance.
2. **ESIC Contribution Period Wage Continuity**:
   - If an employee's wage exceeds ₹21,000 mid-contribution period (April-September or October-March), ESIC rules require continuation until the end of the contribution period. The engine provides policy flag `esiStatus == 'APPLICABLE'` to enforce this.
3. **Dual-Control dual approval workflow**:
   - Large enterprises require separate Preparer and Approver identities. The platform enforces this via `APPROVED` stage gating requiring `company_admin` or `finance_admin` roles.
4. **Chartered Accountant / Tax Sign-Off**:
   - Production deployment should obtain written sign-off from the organization's CA or compliance partner for specific state PT registrations and investment declaration verification rules.

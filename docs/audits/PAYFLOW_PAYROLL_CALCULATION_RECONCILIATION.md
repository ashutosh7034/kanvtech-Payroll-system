# PAYFLOW — Task 8: Payroll Calculation & Statutory Reconciliation

## 1. Principles of Mathematical Integrity

PAYFLOW executes payroll calculation using decimal-safe monetary arithmetic via `decimal.js` on Node.js and PostgreSQL `DECIMAL(18, 2)` types via Prisma ORM.

Under no circumstances does PAYFLOW use native IEEE-754 binary floating-point numbers (`number`) for financial summation, statutory deduction computation, or rounding.

### Fundamental Financial Identity
For any employee slip $i$ and run $R$:

$$\text{Gross Pay}_i = \sum_{j \in \text{Earnings}_i} \text{Amount}_{i,j} + \text{Arrears}_i + \text{Variable}_i$$

$$\text{Deductions Pay}_i = \sum_{k \in \text{Deductions}_i} \text{Amount}_{i,k} + \text{Manual Deductions}_i$$

$$\text{Net Pay}_i = \max\left(0, \text{Gross Pay}_i - \text{Deductions Pay}_i + \text{Reimbursements}_i\right)$$

$$\text{Run Gross} = \sum_{i \in \text{Slips}} \text{Gross Pay}_i, \quad \text{Run Net} = \sum_{i \in \text{Slips}} \text{Net Pay}_i$$

$$\text{Total Employer Cost} = \sum_{i \in \text{Slips}} \left( \text{Gross Pay}_i + \text{Employer PF}_i + \text{Employer ESIC}_i + \text{EDLI}_i + \text{Admin}_i \right)$$

---

## 2. Proration & Working Days Engine

### Indian Corporate Payroll Basis (30-Day Standard)
In standard Indian corporate practice, payroll operates on a 30-day standardized month basis or calendar days basis as configured:

1. **Mid-Month Joining**:
   $$\text{Unpaid Days Prior to Joining} = \max\left(0, \text{DOJ} - \text{Period Start}\right)$$
2. **Mid-Month Exit**:
   $$\text{Unpaid Days After Exit} = \max\left(0, \text{Period End} - \text{Exit Date}\right)$$
3. **Loss of Pay (LOP)**:
   $$\text{Unpaid Leaves} = \text{Unapproved Absent Days} + \text{Approved Unpaid Leaves}$$
4. **Authoritative Payable Days**:
   $$\text{Payable Days} = \max\left(0, \text{Standard Working Days} - \text{Unpaid Mid-Month Days} - \text{LOP Days}\right)$$
5. **Proration Factor**:
   $$\text{Proration Ratio} = \frac{\text{Payable Days}}{\text{Standard Working Days}}$$

### Proration of Fixed Components
For all fixed monthly earnings (Basic Pay, House Rent Allowance, Special Allowance, Conveyance):
$$\text{Calculated Component Amount} = \text{round}\left(\text{Configured Monthly} \times \text{Proration Ratio}, 2\right)$$

---

## 3. Statutory Deductions Breakdown

### A. Employee Provident Fund (EPF)
- **Wage Ceiling**: ₹15,000.00 / month (or uncapped if configured for non-ceiling schemes).
- **PF Wage Basis**:
  $$\text{PF Wage Basis} = \min\left(15000, \text{Basic Pay} + \text{DA}\right)$$
- **Employee Contribution**:
  $$\text{EPF Employee} = \text{round}\left(\text{PF Wage Basis} \times 0.12, 0\right)$$
- **Employer Contribution Breakdown**:
  - **EPS (Pension Fund)**: $8.33\%$ on PF Wage Basis up to ceiling (max ₹1,250.00).
  - **EPF Employer (Difference)**: $12\% - 8.33\% = 3.67\%$.
  - **EDLI (Insurance)**: $0.50\%$ on PF Wage Basis (max ₹75.00).
  - **EPF Admin Charges**: $0.50\%$ on PF Wage Basis (min ₹500.00 company-wide).

### B. Employee State Insurance (ESIC)
- **Gross Threshold**: Applicable only if monthly gross earnings $\le ₹21,000.00$ (₹25,000.00 for employees with disabilities).
- **Employee Contribution**: $0.75\%$ of Gross Earnings (rounded up to nearest rupee).
- **Employer Contribution**: $3.25\%$ of Gross Earnings.

### C. Professional Tax (PT)
- Determined by the state of employment and local tax slabs.
- Example (Karnataka):
  - Gross $< ₹15,000.00$: ₹0.00
  - Gross $\ge ₹15,000.00$: ₹200.00 / month.
- Example (Maharashtra):
  - Male Gross $> ₹10,000.00$: ₹200.00 / month (₹300.00 in February).

### D. Income Tax (TDS Section 192)
- Calculated via annualized tax projection under Old or New Tax Regime:
  $$\text{Projected Annual Gross} = \text{YTD Gross} + (\text{Current Gross} \times \text{Remaining Months})$$
  $$\text{Projected Taxable Income} = \text{Projected Annual Gross} - \text{Standard Deduction (₹75,000/₹50,000)} - \text{Chapter VI-A Deductions}$$
  $$\text{Current Period TDS} = \max\left(0, \frac{\text{Annual Tax Liability} - \text{YTD Tax Deducted}}{\text{Remaining Months}}\right)$$

---

## 4. Take-Home Pay Statutory Safeguard (< 25% Rule)

Under the Payment of Wages Act and corporate compliance standards, total authorized deductions should generally not exceed 50% to 75% of an employee's gross wage, ensuring the employee receives a subsistence wage.

PAYFLOW automatically enforces a Take-Home Pay warning:
$$\text{Is Net Pay Under 25\%} = \left(\text{Gross Pay} > 0\right) \land \left(\text{Net Pay} < \text{Gross Pay} \times 0.25\right)$$

When triggered:
1. An orange warning badge `Take-Home < 25%` appears on the employee's row.
2. A validation exception note is appended: `High deductions: Take-home net pay is less than 25% of gross earnings`.
3. The row can be immediately filtered using the **Net Pay < 25%** workbench filter.
4. Payroll administrators can inspect loans, manual deductions, and TDS to adjust or defer deductions prior to final approval.

---

## 5. Pure Decimal Reconciliation Example

### Candidate Scenario: Senior Developer (Standard Grade)
- Configured Monthly CTC Gross: ₹90,000.00
  - Basic Pay: ₹60,000.00
  - HRA: ₹30,000.00
- Working Days in Month: 30
- Unapproved LOP Days: 2 (Payable days: 28)
- Proration Factor: $28 / 30 = 0.9333333333$
- Arrears Approved: ₹5,000.00
- Variable Allowance Approved: ₹7,500.00
- Manual Deduction: ₹1,000.00

### Step-by-Step Mathematical Trace

1. **Prorated Fixed Earnings**:
   - $\text{Prorated Basic} = 60000 \times \frac{28}{30} = ₹56,000.00$
   - $\text{Prorated HRA} = 30000 \times \frac{28}{30} = ₹28,000.00$
   - $\text{Prorated Base Gross} = 56000 + 28000 = ₹84,000.00$

2. **Additions**:
   - $\text{Arrears} = ₹5,000.00$
   - $\text{Variable Pay} = ₹7,500.00$
   - **Total Calculated Gross Pay**: $84000 + 5000 + 7500 = \mathbf{₹96,500.00}$

3. **Statutory & Other Deductions**:
   - $\text{PF Wage Basis} = \min(15000, 56000) = ₹15,000.00$
   - $\text{EPF Employee (12\%)} = 15000 \times 0.12 = ₹1,800.00$
   - $\text{ESIC} = ₹0.00$ (Gross $> ₹21,000.00$, exempt)
   - $\text{Professional Tax} = ₹200.00$
   - $\text{TDS (Projected)} = ₹4,200.00$
   - $\text{Manual Deduction} = ₹1,000.00$
   - **Total Deductions**: $1800 + 200 + 4200 + 1000 = \mathbf{₹7,200.00}$

4. **Net Disbursable Salary**:
   - $\text{Net Pay} = 96500 - 7200 = \mathbf{₹89,300.00}$
   - Take-Home percentage: $\frac{89300}{96500} = 92.54\% \ge 25\%$ (Passes Take-Home compliance).

5. **Employer Contributions**:
   - $\text{EPS Employer (8.33\% of 15000)} = ₹1,250.00$
   - $\text{EPF Employer Difference (3.67\%)} = ₹550.00$
   - $\text{EDLI (0.50\% of 15000)} = ₹75.00$
   - $\text{EPF Admin (0.50\% of 15000)} = ₹75.00$
   - $\text{Total Employer PF} = 1250 + 550 + 75 + 75 = ₹1,950.00$
   - **Total Employer Payroll Cost**: $96500 + 1950 = \mathbf{₹98,450.00}$

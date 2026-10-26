# PayFlow HRMS & Payroll ERP — Statutory Income-Tax Compliance Matrix & Salary TDS Rules (Tax Year 2026–27)

## 1. Regulatory Framework & Source-to-Rule Verification Table

| Statutory Provision / Subject | Enacted Legal Section | Official Government Source | Effective Date | Practical Payroll Calculation Consequence | Engine Code Location | Verification Status |
|:---|:---|:---|:---:|:---|:---|:---:|
| **Salary TDS Withholding** | **Section 392** (replaces legacy Section 192 of the 1961 Act) | Income-tax Act, 2025; Central Board of Direct Taxes (CBDT) Guidelines | **01-Apr-2026** (Tax Year 2026–27) | Employer must deduct tax at source on estimated annual salary income at average rate | `backend/src/modules/tax/taxEngine.ts` (`calculateIncomeTax`) | **VERIFIED ENACTED** |
| **New Tax Regime Default Slabs** | **Section 202** (replaces legacy Section 115BAC) | Income-tax Act, 2025; Union Budget 2025 & Finance Act provisions | **01-Apr-2026** | 0% (up to 4L), 5% (4L-8L), 10% (8L-12L), 15% (12L-16L), 20% (16L-20L), 25% (20L-24L), 30% (>24L) | `backend/src/modules/tax/taxEngine.ts` (lines 75–83) | **VERIFIED ENACTED** |
| **Standard Deduction (Salaries)** | **Section 19** (replaces legacy Section 16(ia)) | Income-tax Act, 2025; Ministry of Finance Gazette Notifications | **01-Apr-2026** | **₹75,000** flat deduction under New Regime; **₹50,000** under Old Regime | `backend/src/modules/tax/taxEngine.ts` (lines 74, 98) | **VERIFIED ENACTED** |
| **Individual Tax Rebate** | **Section 156(2)(a)** (replaces legacy Section 87A) | Income-tax Act, 2025; Official e-Filing Portal Guidance | **01-Apr-2026** | Up to **₹60,000** rebate for resident individuals with taxable income up to **₹12,00,000** (Net Tax = ₹0) | `backend/src/modules/tax/taxEngine.ts` (lines 84–85, 307–311) | **VERIFIED ENACTED** |
| **Marginal Relief on Rebate** | **Section 156 Proviso** | Income-tax Act, 2025; Income Tax Estimator Manual | **01-Apr-2026** | Tax payable cannot exceed excess of taxable income over ₹12,00,000 for income between ₹12,00,001 and ₹12,70,588 | `backend/src/modules/tax/taxEngine.ts` (lines 87–94, 312–318) | **VERIFIED ENACTED** |
| **Health & Education Cess** | **Finance Act Provision** | Finance Acts / Income-tax Rules | **Ongoing** | **4%** levied on net income-tax after rebate and surcharge | `backend/src/modules/tax/taxEngine.ts` (lines 324–326) | **VERIFIED ENACTED** |
| **Rounding of Taxable Income** | **Clause 516 / Sec 288A Eq.** | Income-tax Act, 2025 | **Ongoing** | Taxable income rounded to nearest multiple of ₹10 (ignoring paise, round up if last digit $\ge 5$) | `backend/src/modules/tax/taxEngine.ts` (lines 212–214, 301) | **VERIFIED ENACTED** |
| **Rounding of Tax Liability** | **Clause 516 / Sec 288B Eq.** | Income-tax Act, 2025 | **Ongoing** | Total tax payable/refundable rounded to nearest multiple of ₹10 | `backend/src/modules/tax/taxEngine.ts` (lines 212–214, 329) | **VERIFIED ENACTED** |
| **Surcharge on High Incomes** | **Rates Schedule** | Income-tax Act, 2025 | **Ongoing** | 10% (>50L to 1Cr), 15% (>1Cr to 2Cr), 25% (>2Cr; capped at 25% under New Regime) | `backend/src/modules/tax/taxEngine.ts` (lines 249–265) | **VERIFIED ENACTED** |

---

## 2. Tax Year 2026–27 Statutory Slab Details & Mathematical Proofs

### 2.1 New Tax Regime Slabs (Section 202 — Default)

| Taxable Income Bracket (₹) | Slab Span (₹) | Tax Rate (%) | Tax in Bracket (₹) | Cumulative Base Tax (₹) |
|:---|:---:|:---:|:---:|:---:|
| **₹0 – ₹4,00,000** | ₹4,00,000 | **0%** | ₹0 | ₹0 |
| **₹4,00,001 – ₹8,00,000** | ₹4,00,000 | **5%** | ₹20,000 | ₹20,000 |
| **₹8,00,001 – ₹12,00,000** | ₹4,00,000 | **10%** | ₹40,000 | **₹60,000** |
| **₹12,00,001 – ₹16,00,000** | ₹4,00,000 | **15%** | ₹60,000 | **₹1,20,000** |
| **₹16,00,001 – ₹20,00,000** | ₹4,00,000 | **20%** | ₹80,000 | **₹2,00,000** |
| **₹20,00,001 – ₹24,00,000** | ₹4,00,000 | **25%** | ₹1,00,000 | **₹3,00,000** |
| **Above ₹24,00,000** | Balance | **30%** | $30\% \times (\text{Income} - 24,00,000)$ | ₹3,00,000 + $30\%$ of excess |

### 2.2 Derivation of the ₹12,70,588 Marginal Relief Boundary

Under Section 156(2)(a), a resident individual with taxable income up to ₹12,00,000 receives a full rebate of calculated tax (₹60,000), resulting in ₹0 tax.
For taxable income $T > ₹12,00,000$, let $X = T - 12,00,000$ (excess income).

In the bracket ₹12,00,001 to ₹16,00,000, the statutory rate is 15%.
Normal tax liability without relief:
$$\text{Normal Tax} = ₹60,000 + 0.15 \times X$$

Under the marginal relief proviso, the tax payable cannot exceed the excess income $X$:
$$\text{Relief Tax} \le X$$

To find the crossover boundary where Normal Tax becomes equal to or lower than Excess Income:
$$60,000 + 0.15 \times X = X$$
$$60,000 = X - 0.15 X$$
$$60,000 = 0.85 X$$
$$X = \frac{60,000}{0.85} = 70,588.235... \approx \mathbf{70,588}$$

**Mathematical Consequence**:
1. When $T \le ₹12,70,588$ ($X \le 70,588$):
   $$\text{Excess Income } X < \text{Normal Tax } (60,000 + 0.15 X)$$
   Therefore, **Marginal Relief applies** and caps the tax payable at $X = T - 12,00,000$.
2. When $T \ge ₹12,70,589$ ($X \ge 70,589$):
   $$\text{Normal Tax } (60,000 + 0.15 X) \le \text{Excess Income } X$$
   Therefore, **Marginal Relief ceases to apply**, and normal progressive slab tax takes over.

---

## 3. Old Tax Regime Slabs & Chapter VI-A Deductions

- **Standard Deduction**: ₹50,000
- **Slabs**:
  * ₹0 – ₹2,50,000: Nil (0%)
  * ₹2,50,001 – ₹5,00,000: 5% (₹12,500)
  * ₹5,00,001 – ₹10,00,000: 20% (₹1,00,000; Cumulative: ₹1,12,500)
  * Above ₹10,00,000: 30% (+ ₹1,12,500)
- **Rebate**: Up to ₹12,500 for taxable income $\le$ ₹5,00,000.
- **Deductions**: Section 80C (up to ₹1,50,000), Section 80D (up to ₹50,000), Section 24(b) (up to ₹2,00,000).

---

## 4. Historical Tax Years (Backward Compatibility Matrix)

- **Tax Year 2024–25 & 2025–26 (Finance (No. 2) Act, 2024)**:
  * Slabs: 0-3L (0%), 3L-7L (5%), 7L-10L (10%), 10L-12L (15%), 12L-15L (20%), >15L (30%).
  * Standard deduction: ₹75,000.
  * Rebate threshold: ₹7,00,000 (max ₹25,000).
- **Tax Year 2023–24 (Finance Act, 2023)**:
  * Slabs: 0-3L (0%), 3L-6L (5%), 6L-9L (10%), 9L-12L (15%), 12L-15L (20%), >15L (30%).
  * Standard deduction: ₹50,000.
  * Rebate threshold: ₹7,00,000 (max ₹25,000).

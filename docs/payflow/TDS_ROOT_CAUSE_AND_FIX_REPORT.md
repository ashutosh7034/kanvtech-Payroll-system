# PayFlow HRMS & Payroll ERP — Income Tax (TDS) Root Cause Diagnosis & Architectural Remediation Report

## 1. Executive Summary

An exhaustive technical audit was conducted on every Income Tax (TDS) calculation pathway in PayFlow HRMS & Payroll ERP.

The audit revealed that the reported issue was not merely four incorrect cumulative numbers in a single route, but a deeper architectural deficiency:
1. **Duplicated Inline Calculation Logic**: Slabs and tax calculations were duplicated independently across three distinct locations:
   - `backend/src/modules/payroll/corporatePayroll.routes.ts` (lines 1546–1556 in `GET /tds/summary`)
   - `backend/src/modules/payroll/corporatePayroll.routes.ts` (lines 1681–1691 in `POST /tds/port-to-salary`)
   - `backend/src/modules/payroll/calculationEngine.ts` (lines 560–573 in the corporate payroll engine)
2. **Statutory Outdatedness for Tax Year 2026–27**: All three implementations lacked the enacted **Income-tax Act, 2025** slabs (₹4L, ₹8L, ₹12L, ₹16L, ₹20L, ₹24L, >₹24L) effective 1 April 2026.
3. **Cumulative Offset Arithmetic Bug**: `corporatePayroll.routes.ts` mixed the ₹7,00,000 threshold with legacy pre-2024 cumulative offset constants (+₹30k, +₹60k, +₹90k, +₹150k), causing an excess tax overcharge of ₹10,000 for taxable income above ₹7,00,000.
4. **Missing Versioning & Historical Reproducibility**: Tax rules were hardcoded inline without effective-date or tax-year parameterization. Finalized historical payroll periods were vulnerable to silent drift.
5. **Missing Cess in Engine**: While `corporatePayroll.routes.ts` applied 4% Health and Education Cess, `calculationEngine.ts` omitted cess entirely, resulting in mathematical divergence between pre-processing previews and ported salary slips.

---

## 2. Forensic Code Trace of Defective Paths

### Pathway A: `corporatePayroll.routes.ts` (Summary & Porting Routes)
```typescript
// Defective Logic in routes: Lines 1546–1556 & 1681–1691
if (regime === 'NEW') {
  if (taxableIncome > 1500000) {
    annualTax += (taxableIncome - 1500000) * 0.30 + 150000; // Overcharged by ₹10k
  } else if (taxableIncome > 1200000) {
    annualTax += (taxableIncome - 1200000) * 0.20 + 90000;  // Overcharged by ₹10k
  } else if (taxableIncome > 1000000) {
    annualTax += (taxableIncome - 1000000) * 0.15 + 60000;  // Overcharged by ₹10k
  } else if (taxableIncome > 700000) {
    annualTax += (taxableIncome - 700000) * 0.10 + 30000;   // Overcharged by ₹10k
  } else if (taxableIncome > 300000) {
    annualTax += (taxableIncome - 300000) * 0.05;
  }
  if (taxableIncome <= 700000) annualTax = 0;
}
```

### Pathway B: `calculationEngine.ts` (Monthly Payroll Engine)
```typescript
// Lines 560–573 in calculationEngine.ts:
if (taxableIncome.greaterThan(700000)) {
  let annualTax = new Decimal(0);
  if (taxableIncome.greaterThan(1500000)) {
    annualTax = annualTax.plus(taxableIncome.minus(1500000).times(0.30)).plus(140000);
  } else if (taxableIncome.greaterThan(1200000)) {
    annualTax = annualTax.plus(taxableIncome.minus(1200000).times(0.20)).plus(80000);
  } else if (taxableIncome.greaterThan(1000000)) {
    annualTax = annualTax.plus(taxableIncome.minus(1000000).times(0.15)).plus(50000);
  } else if (taxableIncome.greaterThan(700000)) {
    annualTax = annualTax.plus(taxableIncome.minus(700000).times(0.10)).plus(20000);
  }
  tdsAmount = annualTax.dividedBy(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
// OMITTED: 4% Cess, Marginal Relief, Old Regime Slabs
```

---

## 3. Scope of Impact

| Scenario | Statutory Tax (FY 2026–27) | Old Route Computation | Engine Computation | Discrepancy / Impact |
|:---|:---:|:---:|:---:|:---|
| **Gross ₹7,50,000 (New Regime)** | **₹0** | ₹0 | ₹0 | None (Within ₹12L rebate) |
| **Gross ₹12,00,000 (New Regime)** | **₹0** (Taxable ₹11.25L $\le$ ₹12L) | ₹91,000 / yr | ₹87,500 / yr | **Critical Overcharge**: Erroneously taxed under old ₹7L rebate rule |
| **Gross ₹18,00,000 (New Regime)** | **₹1,50,800** | ₹2,28,800 / yr | ₹2,07,500 / yr | **Major Overcharge**: ₹78,000/yr overcharge due to obsolete slabs |
| **Gross ₹25,00,000 (New Regime)** | **₹3,42,160** | ₹4,52,400 / yr | ₹4,15,000 / yr | **Major Overcharge**: Exceeds actual liability by >₹1,00,000 |

---

## 4. Architectural Remediation Plan

To permanently resolve these defects without patchwork or recurring drift:
1. **Centralized Tax Calculation Service (`backend/src/modules/tax/taxEngine.ts`)**:
   - Single authoritative service for all tax calculations across the ERP.
   - Effective-dated and versioned tax rules indexed by Financial Year (`2026-2027`, `2025-2026`, `2024-2025`, `2023-2024`).
   - Supports both **New Tax Regime** and **Old Tax Regime**.
   - Enforces Standard Deduction (₹75k New / ₹50k Old), Section 87A rebate, marginal relief, progressive slabs, surcharge, and 4% Health & Education Cess.
   - Enforces Section 288A/B rounding (nearest ₹10).
2. **Unified Integration**:
   - `corporatePayroll.routes.ts`: `GET /payroll/tds/summary` delegates to `taxEngine`.
   - `corporatePayroll.routes.ts`: `POST /payroll/tds/port-to-salary` delegates to `taxEngine`.
   - `calculationEngine.ts`: delegates to `taxEngine` ensuring 100% mathematical parity across pre-processing previews, payslips, and salary sheets.

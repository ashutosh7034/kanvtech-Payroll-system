# PayFlow HRMS & Payroll ERP — Income Tax (TDS) Comprehensive Regression Test Report

## 1. Test Suite Overview & Execution Metadata

- **Test Suite Path**: `backend/tests/tdsStatutoryRules.test.ts`
- **Execution Engine**: Vitest v3.2.7 (Node.js runtime, Decimal.js)
- **Governing Law Tested**: Income-tax Act, 2025 (Tax Year 2026–27) & Historical Enactments
- **Total Test Scenarios**: 20
- **Passed**: 20 (100%)
- **Failed**: 0
- **Execution Duration**: 324ms

---

## 2. Test Scenarios & Independent Expected Results Matrix

| Scenario ID | Test Scope / Rule Tested | Input Data | Statutory Expected Result | Real Test Result | Status |
|:---|:---|:---|:---|:---|:---:|
| **SC-TDS-01** | Zero Income Baseline | Gross: ₹0 | Taxable: ₹0, Base Tax: ₹0, Net Tax: ₹0 | Tax: ₹0, Monthly: ₹0 | **PASS** |
| **SC-TDS-02** | Below Standard Deduction | Gross: ₹50,000 | Std Ded: ₹75,000, Taxable: ₹0, Tax: ₹0 | Taxable: ₹0, Tax: ₹0 | **PASS** |
| **SC-TDS-03** | 0% Slab Upper Boundary | Gross: ₹4,75,000 | Taxable: ₹4,00,000, Base Tax: ₹0 | Base Tax: ₹0, Net: ₹0 | **PASS** |
| **SC-TDS-04** | One Rupee Above 0% Slab | Gross: ₹4,75,010 | Taxable: ₹4,00,010, Covered by Rebate | Tax: ₹0 u/s Rebate | **PASS** |
| **SC-TDS-05** | Middle of 5% Slab | Gross: ₹6,75,000 | Taxable: ₹6,00,000, Base: ₹10k, Rebate: ₹10k | Net Tax: ₹0 | **PASS** |
| **SC-TDS-06** | 5% / 10% Slab Boundary | Gross: ₹8,75,000 | Taxable: ₹8,00,000, Base: ₹20k, Rebate: ₹20k | Net Tax: ₹0 | **PASS** |
| **SC-TDS-07** | Middle of 10% Slab | Gross: ₹10,75,000 | Taxable: ₹10,00,000, Base: ₹40k, Rebate: ₹40k | Net Tax: ₹0 | **PASS** |
| **SC-TDS-08** | Rebate Threshold Boundary | Gross: ₹12,75,000 | Taxable: ₹12,00,000, Base: ₹60k, Rebate: ₹60k | Net Tax: ₹0 | **PASS** |
| **SC-TDS-09** | Marginal Relief on Rebate | Gross: ₹12,85,000 | Taxable: ₹12,10,000, Capped at Excess ₹10,000 + 4% Cess | Total Tax: ₹10,400 | **PASS** |
| **SC-TDS-10** | 15% Slab Ceiling Boundary | Gross: ₹16,75,000 | Taxable: ₹16,00,000, Base: ₹1,20,000 + 4% Cess | Total: ₹1,24,800, Mo: ₹10,400 | **PASS** |
| **SC-TDS-11** | 20% Slab Ceiling Boundary | Gross: ₹20,75,000 | Taxable: ₹20,00,000, Base: ₹2,00,000 + 4% Cess | Total: ₹2,08,000, Mo: ₹17,333 | **PASS** |
| **SC-TDS-12** | 25% Slab Ceiling Boundary | Gross: ₹24,75,000 | Taxable: ₹24,00,000, Base: ₹3,00,000 + 4% Cess | Total: ₹3,12,000, Mo: ₹26,000 | **PASS** |
| **SC-TDS-13** | Top Slab 30% High Earner | Gross: ₹30,75,000 | Taxable: ₹30,00,000, Base: ₹4,80,000 + 4% Cess | Total: ₹4,99,200, Mo: ₹41,600 | **PASS** |
| **SC-TDS-14** | Old Regime Std Deduction | Gross: ₹5,50,000 | Std Ded: ₹50,000, Taxable: ₹5,00,000, Rebate ₹12.5k | Net Tax: ₹0 | **PASS** |
| **SC-TDS-15** | Old Regime 80C/80D/24b | Gross: ₹15,00,000 | Taxable: ₹10,75,000 after 3.75L deductions | Total: ₹1,40,400, Mo: ₹11,700 | **PASS** |
| **SC-TDS-16** | Historical FY 2024–25 | Gross: ₹12,75,000 | Finance (No. 2) Act 2024 slabs & 7L rebate | Total: ₹83,200 | **PASS** |
| **SC-TDS-17** | Historical FY 2023–24 | Gross: ₹12,50,000 | Finance Act 2023 slabs & ₹50k std deduction | Total: ₹93,600 | **PASS** |
| **SC-TDS-18** | Negative Salary Defense | Gross: -₹50,000 | Clamped to 0 | Tax: ₹0 | **PASS** |
| **SC-TDS-19** | Ultra-High ₹10 Cr Income | Gross: ₹10,00,75,000 | Taxable ₹10 Cr + 25% Surcharge + 4% Cess | Total: ₹3,84,54,000 | **PASS** |
| **SC-TDS-20** | Installment Allocation | Gross: ₹16,75,000 | 4 months remaining, ₹83,200 previously deducted | Monthly TDS: ₹10,400 | **PASS** |

---

## 3. Conclusion & Certification
The centralized tax engine (`backend/src/modules/tax/taxEngine.ts`) satisfies all statutory requirements of the Income-tax Act, 2025 and historical Finance Acts, providing exact mathematical precision, marginal relief protection, and backward compatibility.

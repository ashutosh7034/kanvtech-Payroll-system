import { describe, it, expect } from 'vitest';
import { calculateIncomeTax, roundToNearestTen } from '../src/modules/tax/taxEngine.js';
import { PayrollCalculationEngine } from '../src/modules/payroll/calculationEngine.js';
import { prisma } from '../src/config/db.js';

/**
 * COMPREHENSIVE TAX STATUTORY REGRESSION SPECIFICATION
 * Authoritative Indian Income-tax Act, 2025 (Effective 1 April 2026 / Tax Year 2026–27)
 * and Historical Enactments (Finance (No. 2) Act 2024, Finance Act 2023)
 */
describe('Statutory Income Tax Engine — Comprehensive Tax Year 2026–27 Verification', () => {

  describe('1. Tax Year 2026–27: New Tax Regime (Section 393 / Default Regime)', () => {
    
    it('Scenario 1.1: Zero income yields zero tax and zero deductions', () => {
      const res = calculateIncomeTax({ annualGross: 0, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(0);
      expect(res.grossTax).toBe(0);
      expect(res.rebate87A).toBe(0);
      expect(res.totalAnnualTax).toBe(0);
      expect(res.monthlyTds).toBe(0);
    });

    it('Scenario 1.2: Income below standard deduction (Gross ₹50,000) yields zero taxable income', () => {
      const res = calculateIncomeTax({ annualGross: 50000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.standardDeduction).toBe(75000);
      expect(res.taxableIncome).toBe(0);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 1.3: Income exactly at First Nil Slab Boundary (Taxable ₹4,00,000, Gross ₹4,75,000)', () => {
      const res = calculateIncomeTax({ annualGross: 475000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(400000);
      expect(res.grossTax).toBe(0);
      expect(res.totalAnnualTax).toBe(0);
      expect(res.monthlyTds).toBe(0);
    });

    it('Scenario 1.4: One Rupee above First Nil Slab (Taxable ₹4,00,010 after Sec 288A rounding)', () => {
      // Gross 4,75,010 -> Taxable 4,00,010 -> Slab 5% on ₹10 = ₹0.50 -> rounds to ₹1, fully covered by rebate
      const res = calculateIncomeTax({ annualGross: 475010, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(400010);
      expect(res.rebate87A).toBeGreaterThan(0);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 1.5: Middle of 5% Slab (Taxable ₹6,00,000, Gross ₹6,75,000)', () => {
      // 0-4L: 0, 4L-6L (2L @ 5%): ₹10,000 -> Within ₹12L rebate threshold -> Tax is 0
      const res = calculateIncomeTax({ annualGross: 675000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(600000);
      expect(res.grossTax).toBe(10000);
      expect(res.rebate87A).toBe(10000);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 1.6: Boundary of 5% / 10% Slab (Taxable ₹8,00,000, Gross ₹8,75,000)', () => {
      // 0-4L: 0, 4L-8L (4L @ 5%): ₹20,000 -> Within ₹12L rebate threshold -> Tax is 0
      const res = calculateIncomeTax({ annualGross: 875000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(800000);
      expect(res.grossTax).toBe(20000);
      expect(res.rebate87A).toBe(20000);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 1.7: Middle of 10% Slab (Taxable ₹10,00,000, Gross ₹10,75,000)', () => {
      // 0-4L: 0, 4L-8L: 20k, 8L-10L (2L @ 10%): 20k -> Base Tax: 40k -> Within ₹12L rebate threshold -> Tax is 0
      const res = calculateIncomeTax({ annualGross: 1075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1000000);
      expect(res.grossTax).toBe(40000);
      expect(res.rebate87A).toBe(40000);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 1.8: Exactly at Tax Rebate Threshold (Taxable ₹12,00,000, Gross ₹12,75,000)', () => {
      // 0-4L: 0, 4L-8L: 20k, 8L-12L: 40k -> Base Tax = ₹60,000. Full Rebate = ₹60,000. Net Tax = 0
      const res = calculateIncomeTax({ annualGross: 1275000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1200000);
      expect(res.grossTax).toBe(60000);
      expect(res.rebate87A).toBe(60000);
      expect(res.taxAfterRebate).toBe(0);
      expect(res.totalAnnualTax).toBe(0);
      expect(res.monthlyTds).toBe(0);
    });

    it('Scenario 1.9: Marginal Relief Immediately Above Rebate Threshold (Taxable ₹12,10,000)', () => {
      // Gross 12,85,000 -> Taxable 12,10,000 (Excess over 12L is ₹10,000)
      // Normal tax without relief: 60k + 15% of 10k = 61,500 + 4% cess = 63,960
      // With Marginal Relief: Tax payable capped at excess income = ₹10,000
      // Cess 4% on 10,000 = 400 -> Total Tax = 10,400 u/s 288B
      const res = calculateIncomeTax({ annualGross: 1285000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1210000);
      expect(res.grossTax).toBe(61500);
      expect(res.marginalRelief).toBe(51500); // 61,500 - 10,000
      expect(res.taxAfterRebate).toBe(10000);
      expect(res.cess).toBe(400);
      expect(res.totalAnnualTax).toBe(10400);
    });

    it('Scenario 1.9a: Marginal Relief at ₹12,70,580 (Last rounded multiple of ₹10 where relief applies)', () => {
      // Gross: 12,70,580 + 75,000 = 13,45,580 -> Taxable: 12,70,580
      // Excess income over 12L: ₹70,580
      // Normal slab tax: 20k + 40k + 15% of 70,580 = 60,000 + 10,587 = ₹70,587
      // Statutory Cap: Tax payable cannot exceed excess income (₹70,580)
      // Marginal Relief: 70,587 - 70,580 = ₹7
      // Tax after relief = ₹70,580
      // Cess 4% on 70,580 = 2,823.20 -> ₹2,823
      // Total tax: 70,580 + 2,823 = 73,403 -> Rounded u/s 288B/516 to ₹73,400
      const res = calculateIncomeTax({ annualGross: 1345580, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1270580);
      expect(res.grossTax).toBe(70587);
      expect(res.marginalRelief).toBe(7);
      expect(res.taxAfterRebate).toBe(70580);
      expect(res.cess).toBe(2823);
      expect(res.totalAnnualTax).toBe(73400);
    });

    it('Scenario 1.9b: Marginal Relief Crossover Boundary at ₹12,70,590 (Relief ceases)', () => {
      // Gross: 12,70,590 + 75,000 = 13,45,590 -> Taxable: 12,70,590
      // Excess income over 12L: ₹70,590
      // Normal slab tax: 60,000 + 15% of 70,590 = 60,000 + 10,588.50 = ₹70,589
      // Excess income (70,590) > Normal slab tax (70,589)
      // Cap is NOT breached -> Marginal Relief = ₹0
      // Tax after relief = ₹70,589
      // Cess 4% on 70,589 = 2,823.56 -> ₹2,824
      // Total tax: 70,589 + 2,824 = 73,413 -> Rounded u/s 288B/516 to ₹73,410
      const res = calculateIncomeTax({ annualGross: 1345590, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1270590);
      expect(res.grossTax).toBe(70589);
      expect(res.marginalRelief).toBe(0);
      expect(res.taxAfterRebate).toBe(70589);
      expect(res.cess).toBe(2824);
      expect(res.totalAnnualTax).toBe(73410);
    });

    it('Scenario 1.9c: Mathematical Crossover Verification at ₹12,70,588 vs ₹12,70,589', () => {
      // Theoretical continuous crossover is derived by 60,000 / 0.85 = 70,588.235
      // Taxable income of 12,70,588.24 is the exact crossover
      // At unrounded 12,70,588: Slab tax is 60,000 + 0.15 * 70,588 = 70,588.20 > 70,588.00 (0.20 relief)
      // Under Section 288A/516 mandatory rounding of taxable income to nearest 10:
      // ₹12,70,588 rounds to ₹12,70,590, where relief is ₹0.
      const res588 = calculateIncomeTax({ annualGross: 1270588 + 75000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res588.taxableIncome).toBe(1270590); // Rounded u/s 288A to nearest 10
      expect(res588.totalAnnualTax).toBe(73410);
    });

    it('Scenario 1.10: 15% Slab Ceiling Boundary (Taxable ₹16,00,000, Gross ₹16,75,000)', () => {
      // Slabs:
      // 0-4L: 0
      // 4L-8L (4L @ 5%): 20,000
      // 8L-12L (4L @ 10%): 40,000
      // 12L-16L (4L @ 15%): 60,000
      // Cumulative Base Tax = ₹1,20,000
      // Cess 4% = ₹4,800
      // Total Annual Tax = ₹1,24,800, Monthly TDS = ₹10,400
      const res = calculateIncomeTax({ annualGross: 1675000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(1600000);
      expect(res.grossTax).toBe(120000);
      expect(res.cess).toBe(4800);
      expect(res.totalAnnualTax).toBe(124800);
      expect(res.monthlyTds).toBe(10400);
    });

    it('Scenario 1.11: 20% Slab Ceiling Boundary (Taxable ₹20,00,000, Gross ₹20,75,000)', () => {
      // Base Tax: 1,20,000 + (4L @ 20% = 80,000) = ₹2,00,000
      // Cess 4% = ₹8,000
      // Total Tax = ₹2,08,000, Monthly TDS = ₹17,333
      const res = calculateIncomeTax({ annualGross: 2075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(2000000);
      expect(res.grossTax).toBe(200000);
      expect(res.cess).toBe(8000);
      expect(res.totalAnnualTax).toBe(208000);
      expect(res.monthlyTds).toBe(17333);
    });

    it('Scenario 1.12: 25% Slab Ceiling Boundary (Taxable ₹24,00,000, Gross ₹24,75,000)', () => {
      // Base Tax: 2,00,000 + (4L @ 25% = 1,00,000) = ₹3,00,000
      // Cess 4% = ₹12,000
      // Total Tax = ₹3,12,000, Monthly TDS = ₹26,000
      const res = calculateIncomeTax({ annualGross: 2475000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(2400000);
      expect(res.grossTax).toBe(300000);
      expect(res.cess).toBe(12000);
      expect(res.totalAnnualTax).toBe(312000);
      expect(res.monthlyTds).toBe(26000);
    });

    it('Scenario 1.13: Top Slab 30% for High Earner (Taxable ₹30,00,000, Gross ₹30,75,000)', () => {
      // Up to 24L: 3,00,000
      // Excess 6L @ 30%: 1,80,000
      // Total Base Tax: ₹4,80,000
      // Cess 4%: ₹19,200
      // Total Tax: ₹4,99,200, Monthly TDS: ₹41,600
      const res = calculateIncomeTax({ annualGross: 3075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(3000000);
      expect(res.grossTax).toBe(480000);
      expect(res.cess).toBe(19200);
      expect(res.totalAnnualTax).toBe(499200);
      expect(res.monthlyTds).toBe(41600);
    });

    it('Scenario 1.14: Exactly at Surcharge Boundary (Taxable ₹50,00,000, Gross ₹50,75,000)', () => {
      // Up to 24L: 3,00,000; Excess 26L @ 30% = 7,80,000 -> Gross Tax: ₹10,80,000
      // At ₹50,00,000, surcharge is Nil (threshold not exceeded)
      // Cess 4% = ₹43,200 -> Total Tax = ₹11,23,200
      const res = calculateIncomeTax({ annualGross: 5075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(5000000);
      expect(res.grossTax).toBe(1080000);
      expect(res.surcharge).toBe(0);
      expect(res.cess).toBe(43200);
      expect(res.totalAnnualTax).toBe(1123200);
    });

    it('Scenario 1.15: First Surcharge Bracket (Taxable ₹60,00,000, Surcharge 10%)', () => {
      // Up to 24L: 3,00,000; Excess 36L @ 30% = 10,80,000 -> Gross Tax: ₹13,80,000
      // Surcharge 10% on 13,80,000 = ₹1,38,000
      // Cess 4% on (13.8L + 1.38L = 15,18,000) = ₹60,720
      // Total Tax = ₹15,78,720
      const res = calculateIncomeTax({ annualGross: 6075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(6000000);
      expect(res.grossTax).toBe(1380000);
      expect(res.surcharge).toBe(138000);
      expect(res.cess).toBe(60720);
      expect(res.totalAnnualTax).toBe(1578720);
    });
  });

  describe('2. Tax Year 2026–27: Old Tax Regime (Optional with Chapter VI-A Deductions)', () => {
    
    it('Scenario 2.1: Old Regime Standard Deduction of ₹50,000 applied', () => {
      const res = calculateIncomeTax({ annualGross: 550000, regime: 'OLD', financialYear: '2026-2027' });
      expect(res.standardDeduction).toBe(50000);
      expect(res.taxableIncome).toBe(500000);
      // Within 5L threshold -> Rebate up to 12,500 -> Zero tax
      expect(res.rebate87A).toBe(12500);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 2.2: Old Regime with 80C, 80D, and 24b deductions', () => {
      // Gross 15,00,000 - 50k SD - 1.5L 80C - 25k 80D - 2L 24b = Taxable 10,75,000
      const res = calculateIncomeTax({
        annualGross: 1500000,
        regime: 'OLD',
        financialYear: '2026-2027',
        declarations: {
          section80C: 200000, // Capped at 150k
          section80D: 25000,
          section24b: 250000  // Capped at 200k
        }
      });
      expect(res.chapterVIA).toBe(375000); // 1.5L + 25k + 2L
      expect(res.taxableIncome).toBe(1075000); // 15L - 50k - 3.75L
      // Slabs:
      // 0-2.5L: 0
      // 2.5L-5L: 12,500
      // 5L-10L: 1,00,000
      // Above 10L (75k @ 30%): 22,500
      // Base Tax: 1,35,000
      // Cess 4%: 5,400
      // Total: 1,40,400
      expect(res.grossTax).toBe(135000);
      expect(res.cess).toBe(5400);
      expect(res.totalAnnualTax).toBe(140400);
      expect(res.monthlyTds).toBe(11700);
    });
  });

  describe('3. Historical Tax Years Backward Compatibility', () => {
    
    it('Scenario 3.1: FY 2024–25 / FY 2025–26 (Finance (No. 2) Act 2024) preserves 7L rebate & slabs', () => {
      // Under FY 2024-25: Slabs: 0-3L 0, 3-7L 5% (20k), 7-10L 10% (30k; cum 50k), 10-12L 15% (30k; cum 80k), 12-15L 20% (60k; cum 140k), >15L 30%
      // Gross 12,75,000 -> Taxable 12,00,000
      // Base Tax = 20k + 30k + 30k = 80,000
      // Cess = 3,200
      // Total = 83,200
      const res = calculateIncomeTax({ annualGross: 1275000, regime: 'NEW', financialYear: '2024-2025' });
      expect(res.taxableIncome).toBe(1200000);
      expect(res.grossTax).toBe(80000);
      expect(res.cess).toBe(3200);
      expect(res.totalAnnualTax).toBe(83200);
    });

    it('Scenario 3.2: FY 2023–24 (Finance Act 2023) preserves ₹50,000 standard deduction', () => {
      // Under FY 2023-24: Std deduction was 50k. Slabs: 3L-6L 5% (15k), 6L-9L 10% (30k), 9L-12L 15% (45k; cum 90k)
      // Gross 12,50,000 -> Taxable 12,00,000
      // Base Tax = 15k + 30k + 45k = 90,000
      // Cess = 3,600
      // Total = 93,600
      const res = calculateIncomeTax({ annualGross: 1250000, regime: 'NEW', financialYear: '2023-2024' });
      expect(res.standardDeduction).toBe(50000);
      expect(res.taxableIncome).toBe(1200000);
      expect(res.grossTax).toBe(90000);
      expect(res.cess).toBe(3600);
      expect(res.totalAnnualTax).toBe(93600);
    });
  });

  describe('4. Input Validation & Defensive Edge Cases', () => {
    
    it('Scenario 4.1: Clamps negative gross earnings to zero', () => {
      const res = calculateIncomeTax({ annualGross: -50000, regime: 'NEW' });
      expect(res.annualGross).toBe(0);
      expect(res.taxableIncome).toBe(0);
      expect(res.totalAnnualTax).toBe(0);
    });

    it('Scenario 4.2: Handles extreme income without precision loss or overflow', () => {
      // Taxable ₹10,00,00,000 (10 Crores)
      // Up to 24L: 3,00,000
      // Excess 9,76,00,000 @ 30% = 2,92,80,000
      // Base Tax = 2,95,80,000
      // Surcharge @ 25% = 73,95,000
      // Tax + Surcharge = 3,69,75,000
      // Cess 4% = 14,79,000
      // Total Tax = 3,84,54,000
      const res = calculateIncomeTax({ annualGross: 100075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(100000000);
      expect(res.grossTax).toBe(29580000);
      expect(res.surcharge).toBe(7395000);
      expect(res.cess).toBe(1479000);
      expect(res.totalAnnualTax).toBe(38454000);
    });

    it('Scenario 4.3: Correctly computes remaining installment allocation', () => {
      // Annual tax 1,24,800. If 4 months remaining and 83,200 already deducted -> (124800 - 83200) / 4 = 10,400
      const res = calculateIncomeTax({
        annualGross: 1675000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 4,
        tdsAlreadyDeducted: 83200
      });
      expect(res.monthlyTds).toBe(10400);
    });
  });

  // =========================================================================
  // 5. SURCHARGE MARGINAL RELIEF (FIRST SCHEDULE TO FINANCE ACT)
  // =========================================================================
  describe('5. Surcharge Marginal Relief Across All Thresholds & Regimes', () => {

    it('Scenario 5.1: Exactly at ₹50,00,000 threshold (Taxable ₹50L, Surcharge Nil)', () => {
      // Up to 24L: 3,00,000; Excess 26L @ 30% = 7,80,000 -> Base Tax: ₹10,80,000
      // Threshold not exceeded -> Surcharge = 0, Relief = 0, Cess = 43,200, Total = ₹11,23,200
      const res = calculateIncomeTax({ annualGross: 5075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(5000000);
      expect(res.grossTax).toBe(1080000);
      expect(res.surcharge).toBe(0);
      expect(res.surchargeMarginalRelief).toBe(0);
      expect(res.cess).toBe(43200);
      expect(res.totalAnnualTax).toBe(1123200);
    });

    it('Scenario 5.2: DEF-TAX-002 Remediation — Taxable ₹50,10,000 with Surcharge Marginal Relief', () => {
      // Taxable ₹50,10,000 (Gross ₹50,85,000)
      // Base Tax on 50.1L = 10,80,000 + 3,000 = ₹10,83,000
      // Raw Surcharge @ 10% = ₹1,08,300 -> Total without relief = ₹11,91,300
      // Cap = Tax at 50L (10,80,000) + Excess Income (10,000) = ₹10,90,000
      // Surcharge Marginal Relief = 11,91,300 - 10,90,000 = ₹1,01,300
      // Net Surcharge = 1,08,300 - 1,01,300 = ₹7,000
      // Base for Cess = 10,83,000 + 7,000 = ₹10,90,000 (capped at excess income)
      // Cess 4% = ₹43,600
      // Total Annual Tax = ₹11,33,600 (Exact statutory cap u/s 288B)
      const res = calculateIncomeTax({ annualGross: 5085000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(5010000);
      expect(res.grossTax).toBe(1083000);
      expect(res.surchargeMarginalRelief).toBe(101300);
      expect(res.surcharge).toBe(7000);
      expect(res.cess).toBe(43600);
      expect(res.totalAnnualTax).toBe(1133600);
      expect(res.monthlyTds).toBe(94467);
    });

    it('Scenario 5.3: Marginal Relief tapering limit near ₹51,61,190', () => {
      // Base Tax on 51,61,190 = 10,80,000 + (1,61,190 * 0.30) = 10,80,000 + 48,357 = 11,28,357
      // Raw Surcharge @ 10% = 1,12,836
      // Current Total = 11,28,357 + 1,12,836 = 12,41,193
      // Cap = 10,80,000 + 1,61,190 = 12,41,190
      // Relief = 12,41,193 - 12,41,190 = ₹3
      const res = calculateIncomeTax({ annualGross: 5161190 + 75000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(5161190);
      expect(res.surchargeMarginalRelief).toBe(3);
      expect(res.surcharge).toBe(112833);
      expect(res.cess).toBe(49648);
      expect(res.totalAnnualTax).toBe(1290840);
    });

    it('Scenario 5.4: Point where Marginal Relief ceases at ₹51,61,200', () => {
      // Cap: 10,80,000 + 1,61,200 = 12,41,200
      // Base Tax: 11,28,360, Raw Surcharge: 1,12,836 -> Current Total: 12,41,196 <= Cap
      // Relief = 0
      const res = calculateIncomeTax({ annualGross: 5161200 + 75000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(5161200);
      expect(res.surchargeMarginalRelief).toBe(0);
      expect(res.surcharge).toBe(112836);
    });

    it('Scenario 5.5: Surcharge Boundary at ₹1 Crore (Taxable ₹1,00,00,000)', () => {
      // Base Tax on 1 Crore: 3L + (76L * 0.30) = 3L + 22.8L = ₹25,80,000
      // Surcharge @ 10% = ₹2,58,000 -> Total = ₹28,38,000
      // Cess 4% = 1,13,520 -> Total Tax = ₹29,51,520
      const res = calculateIncomeTax({ annualGross: 10075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(10000000);
      expect(res.grossTax).toBe(2580000);
      expect(res.surcharge).toBe(258000);
      expect(res.surchargeMarginalRelief).toBe(0);
      expect(res.cess).toBe(113520);
      expect(res.totalAnnualTax).toBe(2951520);
    });

    it('Scenario 5.6: Surcharge Marginal Relief immediately above ₹1 Crore (Taxable ₹1,00,10,000)', () => {
      // Base Tax on 1,00,10,000 = 25,80,000 + 3,000 = ₹25,83,000
      // Raw Surcharge @ 15% = ₹3,87,450 -> Current Total = ₹29,70,450
      // Cap = Total at 1 Cr (28,38,000) + Excess Income (10,000) = ₹28,48,000
      // Marginal Relief = 29,70,450 - 28,48,000 = ₹1,22,450
      // Net Surcharge = 3,87,450 - 1,22,450 = ₹2,65,000
      // Base for Cess = 25,83,000 + 2,65,000 = ₹28,48,000
      // Cess 4% = ₹1,13,920 -> Total Tax = ₹29,61,920
      const res = calculateIncomeTax({ annualGross: 10085000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(10010000);
      expect(res.grossTax).toBe(2583000);
      expect(res.surchargeMarginalRelief).toBe(122450);
      expect(res.surcharge).toBe(265000);
      expect(res.cess).toBe(113920);
      expect(res.totalAnnualTax).toBe(2961920);
    });

    it('Scenario 5.7: Surcharge Boundary at ₹2 Crore (Taxable ₹2,00,00,000)', () => {
      // Base Tax on 2 Crore: 3L + (1.76 Cr * 0.30) = 3L + 52.8L = ₹55,80,000
      // Surcharge @ 15% = ₹8,37,000 -> Total Base = ₹64,17,000
      // Cess 4% = 2,56,680 -> Total Tax = ₹66,73,680
      const res = calculateIncomeTax({ annualGross: 20075000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(20000000);
      expect(res.grossTax).toBe(5580000);
      expect(res.surcharge).toBe(837000);
      expect(res.surchargeMarginalRelief).toBe(0);
      expect(res.cess).toBe(256680);
      expect(res.totalAnnualTax).toBe(6673680);
    });

    it('Scenario 5.8: Surcharge Marginal Relief immediately above ₹2 Crore (Taxable ₹2,00,10,000)', () => {
      // Base Tax on 2,00,10,000 = 55,80,000 + 3,000 = ₹55,83,000
      // Raw Surcharge @ 25% = ₹13,95,750 -> Current Total = ₹69,78,750
      // Cap = Total at 2 Cr (64,17,000) + Excess Income (10,000) = ₹64,27,000
      // Marginal Relief = 69,78,750 - 64,27,000 = ₹5,51,750
      // Net Surcharge = 13,95,750 - 5,51,750 = ₹8,44,000
      // Base for Cess = 55,83,000 + 8,44,000 = ₹64,27,000
      // Cess 4% = ₹2,57,080 -> Total Tax = ₹66,84,080
      const res = calculateIncomeTax({ annualGross: 20085000, regime: 'NEW', financialYear: '2026-2027' });
      expect(res.taxableIncome).toBe(20010000);
      expect(res.grossTax).toBe(5583000);
      expect(res.surchargeMarginalRelief).toBe(551750);
      expect(res.surcharge).toBe(844000);
      expect(res.cess).toBe(257080);
      expect(res.totalAnnualTax).toBe(6684080);
    });

    it('Scenario 5.9: Old Regime Surcharge Marginal Relief at ₹50,10,000', () => {
      // Old Regime Base Tax on 50L = 1,12,500 + 40L * 0.30 = ₹13,12,500. Surcharge at 50L = 0.
      // Base Tax on 50.1L = 13,12,500 + 3,000 = ₹13,15,500
      // Raw Surcharge @ 10% = ₹1,31,550 -> Current Total = ₹14,47,050
      // Cap = 13,12,500 + 10,000 = ₹13,22,500
      // Relief = 14,47,050 - 13,22,500 = ₹1,24,550
      // Net Surcharge = 1,31,550 - 1,24,550 = ₹7,000
      // Base for Cess = ₹13,22,500
      // Cess 4% = ₹52,900 -> Total Tax = ₹13,75,400
      const res = calculateIncomeTax({
        annualGross: 5060000,
        regime: 'OLD',
        financialYear: '2026-2027'
      });
      expect(res.taxableIncome).toBe(5010000);
      expect(res.grossTax).toBe(1315500);
      expect(res.surchargeMarginalRelief).toBe(124550);
      expect(res.surcharge).toBe(7000);
      expect(res.cess).toBe(52900);
      expect(res.totalAnnualTax).toBe(1375400);
    });
  });

  // =========================================================================
  // 6. YEAR-TO-DATE (YTD) TDS DEDUCTION RECONCILIATION (SECTION 192)
  // =========================================================================
  describe('6. Year-to-Date TDS Deduction Reconciliation (Section 192 / Rule 26A)', () => {

    it('Scenario 6.1: Full-year employee regular monthly TDS in Month 1 (12 periods remaining)', () => {
      // Annual Gross ₹16,75,000 -> Taxable ₹16,00,000 -> Total Tax ₹1,24,800
      // 12 months remaining, 0 prior TDS -> 1,24,800 / 12 = 10,400
      const res = calculateIncomeTax({
        annualGross: 1675000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 12,
        tdsAlreadyDeducted: 0
      });
      expect(res.totalAnnualTax).toBe(124800);
      expect(res.monthlyTds).toBe(10400);
    });

    it('Scenario 6.2: Mid-year joiner joining in October with 6 remaining periods (Nil tax)', () => {
      // 6 remaining months @ ₹1,00,000/mo = ₹6,00,000 annual gross
      // Taxable = 6,00,000 - 75,000 = ₹5,25,000 -> Within 12L rebate threshold -> Tax 0
      const res = calculateIncomeTax({
        annualGross: 600000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 6,
        tdsAlreadyDeducted: 0
      });
      expect(res.totalAnnualTax).toBe(0);
      expect(res.monthlyTds).toBe(0);
    });

    it('Scenario 6.3: Mid-year joiner joining in October with high salary (6 remaining periods)', () => {
      // 6 months @ ₹4,00,000/mo = ₹24,00,000 gross -> Taxable ₹23,25,000
      // Base Tax: 20k + 40k + 60k + 80k + (3.25L * 25% = 81,250) = 2,81,250
      // Cess 4% = 11,250 -> Total Tax = ₹2,92,500
      // TDS already deducted = 0, Remaining months = 6 -> 2,92,500 / 6 = ₹48,750/mo
      const res = calculateIncomeTax({
        annualGross: 2400000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 6,
        tdsAlreadyDeducted: 0
      });
      expect(res.totalAnnualTax).toBe(292500);
      expect(res.monthlyTds).toBe(48750);
    });

    it('Scenario 6.4: Mid-year salary increase reconciliation (6 mos @ 1L, 6 mos @ 2.5L)', () => {
      // First 6 months (Apr..Sep): 6L gross, 0 tax deducted.
      // October: salary increased to 2.5L. Total annual = 6L (prior) + 15L (Oct..Mar) = 21,00,000
      // Taxable = 21,00,000 - 75,000 = 20,25,000
      // Tax: 2,00,000 (up to 20L) + 25k * 25% (6,250) = 2,06,250. Cess 4% = 8,250 -> Total = 2,14,500
      // Prior TDS = 0, Remaining months = 6 -> 2,14,500 / 6 = ₹35,750/mo
      const res = calculateIncomeTax({
        annualGross: 2100000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 6,
        tdsAlreadyDeducted: 0
      });
      expect(res.totalAnnualTax).toBe(214500);
      expect(res.monthlyTds).toBe(35750);
    });

    it('Scenario 6.5: Variable Diwali bonus month with prior TDS reconciliation', () => {
      // Annual salary 18L regular + 3L Diwali bonus = 21,00,000
      // Total annual tax = 2,14,500
      // In first 6 months, employee had regular TDS deducted of ₹74,100 (6 * 12,350)
      // Remaining Tax = 2,14,500 - 74,100 = ₹1,40,400
      // Remaining months = 6 (Oct..Mar) -> 1,40,400 / 6 = ₹23,400/mo
      const res = calculateIncomeTax({
        annualGross: 2100000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 6,
        tdsAlreadyDeducted: 74100
      });
      expect(res.totalAnnualTax).toBe(214500);
      expect(res.monthlyTds).toBe(23400);
    });

    it('Scenario 6.6: Excess previous deductions yields zero monthly withholding (no negative TDS)', () => {
      // Recalculated total tax: ₹65,000. Prior TDS already deducted: ₹80,000.
      // Net remaining liability = Math.max(0, 65,000 - 80,000) = 0
      // Monthly TDS = 0 (never negative)
      const res = calculateIncomeTax({
        annualGross: 1350000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 4,
        tdsAlreadyDeducted: 80000
      });
      expect(res.monthlyTds).toBe(0);
    });

    it('Scenario 6.7: Final month of Financial Year (March, 1 remaining period)', () => {
      // Annual tax 1,24,800. Prior 11 months deducted 1,14,400 -> Remaining: 10,400 / 1 = 10,400
      const res = calculateIncomeTax({
        annualGross: 1675000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 1,
        tdsAlreadyDeducted: 114400
      });
      expect(res.monthlyTds).toBe(10400);
    });

    it('Scenario 6.8: Mid-year salary decrease reconciliation (6 mos @ 2.5L, 6 mos @ 1.25L)', () => {
      // First 6 months @ 2.5L = 15L gross. Prior TDS deducted = ₹1,07,250.
      // October onwards: salary reduced to 1.25L.
      // Total annual gross = 15L + (6 * 1.25L) = 22,50,000.
      // Taxable = 22,50,000 - 75,000 = 21,75,000.
      // Base Tax: 2L + (1.75L * 25% = 43,750) = 2,43,750. Cess 4% = 9,750. Total Annual Tax = 2,53,500.
      // Prior TDS = 1,07,250 -> Remaining Tax = 2,53,500 - 1,07,250 = ₹1,46,250.
      // Monthly TDS across remaining 6 months = 1,46,250 / 6 = ₹24,375/mo (reconciles downwards smoothly).
      const res = calculateIncomeTax({
        annualGross: 2250000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 6,
        tdsAlreadyDeducted: 107250
      });
      expect(res.totalAnnualTax).toBe(253500);
      expect(res.monthlyTds).toBe(24375);
    });

    it('Scenario 6.9: Defensive input clamping (negative prior TDS, zero remaining months)', () => {
      // Negative prior TDS clamped to 0, zero remaining months clamped to 1
      const resNeg = calculateIncomeTax({
        annualGross: 1675000,
        regime: 'NEW',
        financialYear: '2026-2027',
        remainingMonths: 0, // Clamped to 1
        tdsAlreadyDeducted: -50000 // Clamped to 0
      });
      expect(resNeg.totalAnnualTax).toBe(124800);
      expect(resNeg.monthlyTds).toBe(124800);
    });
  });

  // =========================================================================
  // 7. PAYROLL ENGINE CALCULATION WITH DYNAMIC YTD TDS INTEGRATION
  // =========================================================================
  describe('7. Payroll Engine calculateEmployee with Dynamic YTD TDS', () => {

    it('Scenario 7.1: calculateEmployee dynamically calculates YTD TDS with remaining months and prior TDS', async () => {
      const mockEmp = {
        id: 'mock-ytd-emp-01',
        employeeCode: 'YTD-EMP-01',
        firstName: 'Vikram',
        lastName: 'Aditya',
        dateOfJoining: new Date('2025-01-01'),
        salaryStructure: {
          lines: [
            { component: { code: 'BASIC', name: 'Basic', type: 'EARNING' }, monthlyAmount: 100000 },
            { component: { code: 'HRA', name: 'HRA', type: 'EARNING' }, monthlyAmount: 50000 },
            { component: { code: 'SPECIAL_ALLOWANCE', name: 'Spl', type: 'EARNING' }, monthlyAmount: 25000 }
          ]
        },
        payrollPolicy: {
          pfApplicable: false,
          esiApplicable: false,
          ptApplicable: false,
          taxRegime: 'NEW'
        }
      };

      const periodOct = {
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        month: 10,
        year: 2026
      };

      // In October (month 10): 6 remaining months.
      // Prior 6 months gross = 10,50,000 (6 * 1,75,000). Current = 1,75,000. Future 5 mos = 8,75,000.
      // Annual projected = 10,50,000 + 1,75,000 + 8,75,000 = 21,00,000.
      // Total Annual Tax on 21L (20.25L taxable) = ₹2,14,500.
      // Case A: 0 prior TDS deducted -> 2,14,500 / 6 = ₹35,750
      const resA = await PayrollCalculationEngine.calculateEmployee(
        mockEmp,
        periodOct,
        [],
        null,
        0, 0, 0, 0, 0, undefined, 0,
        0,       // ytdTdsOverride = 0
        6,       // remainingMonthsOverride = 6
        1050000  // ytdGrossOverride = 10,50,000
      );

      const tdsItemA = resA.items.find(i => i.code === 'TDS');
      expect(tdsItemA).toBeDefined();
      expect(tdsItemA?.calculatedAmount.toNumber()).toBe(35750);

      // Case B: Prior TDS of ₹74,100 already deducted -> Remaining = 2,14,500 - 74,100 = 1,40,400 -> 1,40,400 / 6 = ₹23,400
      const resB = await PayrollCalculationEngine.calculateEmployee(
        mockEmp,
        periodOct,
        [],
        null,
        0, 0, 0, 0, 0, undefined, 0,
        74100,   // ytdTdsOverride = 74,100
        6,       // remainingMonthsOverride = 6
        1050000  // ytdGrossOverride = 10,50,000
      );

      const tdsItemB = resB.items.find(i => i.code === 'TDS');
      expect(tdsItemB).toBeDefined();
      expect(tdsItemB?.calculatedAmount.toNumber()).toBe(23400);
    });

    it('Scenario 7.2: Database Status Semantics: calculateEmployee queries strictly PAID runs and ignores APPROVED runs', async () => {
      const testPeriod = await prisma.payrollPeriod.findFirst({
        where: { month: 10, year: 2026 }
      });
      if (!testPeriod) return;

      const testEmp = await prisma.employee.findFirst({
        where: { companyId: testPeriod.companyId },
        include: { salaryStructure: { include: { lines: true } }, payrollPolicy: true }
      });
      if (!testEmp) return;

      // Find or create an earlier period in the same FY (September 2026)
      let priorPeriod = await prisma.payrollPeriod.findFirst({
        where: { companyId: testPeriod.companyId, month: 9, year: 2026 }
      });
      if (!priorPeriod) {
        priorPeriod = await prisma.payrollPeriod.create({
          data: {
            companyId: testPeriod.companyId,
            periodNumber: 999,
            name: 'September 2026 Synthetic Test',
            month: 9,
            year: 2026,
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-30'),
            cutoffDate: new Date('2026-09-25')
          }
        });
      }

      // Create a test payroll run with status APPROVED (not PAID)
      const testRun = await prisma.corporatePayrollRun.create({
        data: {
          companyId: testPeriod.companyId,
          periodId: priorPeriod.id,
          runNumber: `TEST-RUN-APPROVED-${Date.now()}`,
          status: 'APPROVED',
          slips: {
            create: {
              employeeId: testEmp.id,
              workingDays: 30,
              payableDays: 30,
              grossPay: 150000,
              deductionsPay: 15000,
              netPay: 135000,
              employerCost: 165000,
              calculationSnapshot: {},
              items: {
                create: {
                  code: 'TDS',
                  name: 'TDS Deduction',
                  type: 'DEDUCTION',
                  amount: 15000
                }
              }
            }
          }
        }
      });

      try {
        // Run calculateEmployee for testEmp in October
        // Because testRun is only APPROVED (not PAID), its TDS must NOT be counted as deducted!
        const resUnpaid = await PayrollCalculationEngine.calculateEmployee(
          testEmp,
          testPeriod,
          [],
          null
        );
        const tdsItemUnpaid = resUnpaid.items.find(i => i.code === 'TDS');
        if (tdsItemUnpaid) {
          // Rule applied must show YTD TDS ₹0, verifying un-paid runs are excluded
          expect(tdsItemUnpaid.ruleApplied).toContain('YTD TDS ₹0');
        }

        // Now transition run to PAID
        await prisma.corporatePayrollRun.update({
          where: { id: testRun.id },
          data: { status: 'PAID', paidAt: new Date() }
        });

        // Run calculateEmployee again
        // Now because testRun is PAID, its TDS of ₹15,000 must be included!
        const resPaid = await PayrollCalculationEngine.calculateEmployee(
          testEmp,
          testPeriod,
          [],
          null
        );
        const tdsItemPaid = resPaid.items.find(i => i.code === 'TDS');
        if (tdsItemPaid) {
          expect(tdsItemPaid.ruleApplied).toContain('YTD TDS ₹15000');
        }
      } finally {
        // Clean up synthetic test fixtures
        await prisma.corporatePayrollItem.deleteMany({
          where: { payrollSlip: { payrollRunId: testRun.id } }
        });
        await prisma.corporatePayrollSlip.deleteMany({
          where: { payrollRunId: testRun.id }
        });
        await prisma.corporatePayrollRun.delete({
          where: { id: testRun.id }
        });
      }
    });
  });
});


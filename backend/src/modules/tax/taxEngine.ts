import { Decimal } from 'decimal.js';

export type TaxRegime = 'NEW' | 'OLD';

export interface TaxDeclarations {
  section80C?: Decimal | number | string | null;
  section80D?: Decimal | number | string | null;
  section24b?: Decimal | number | string | null;
  otherDeductions?: Decimal | number | string | null;
}

export interface TaxCalculationInput {
  annualGross: Decimal | number | string;
  regime?: TaxRegime | string;
  financialYear?: string;
  declarations?: TaxDeclarations;
  remainingMonths?: number;
  tdsAlreadyDeducted?: number;
}

export interface TaxCalculationResult {
  financialYear: string;
  regime: TaxRegime;
  annualGross: number;
  standardDeduction: number;
  chapterVIA: number;
  taxableIncome: number;
  grossTax: number;
  rebate87A: number;
  marginalRelief: number;
  surchargeMarginalRelief: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalAnnualTax: number;
  monthlyTds: number;
  breakdown: {
    slabBreakdown: Array<{
      bracket: string;
      ratePct: number;
      taxableAmountInBracket: number;
      tax: number;
    }>;
  };
}

interface SlabDefinition {
  upTo: number; // Upper limit of bracket, Infinity for top
  rate: number; // e.g. 0.05
}

interface RegimeRules {
  standardDeduction: number;
  slabs: SlabDefinition[];
  rebateThreshold: number;
  maxRebate: number;
  hasMarginalRelief: boolean;
  marginalReliefCap?: (taxableIncome: number, baseTax: number, threshold: number) => number;
}

interface TaxYearRules {
  NEW: RegimeRules;
  OLD: RegimeRules;
}

/**
 * Authoritative Indian Tax Rules Matrix
 * - Tax Year 2026–27: Income-tax Act, 2025 (effective 1 April 2026)
 * - Tax Year 2024–25 & 2025–26: Finance (No. 2) Act, 2024
 * - Tax Year 2023–24: Finance Act, 2023
 */
const TAX_YEAR_REGISTRY: Record<string, TaxYearRules> = {
  // Tax Year 2026–27 (Income-tax Act, 2025 / Budget 2025-26)
  '2026-2027': {
    NEW: {
      standardDeduction: 75000,
      slabs: [
        { upTo: 400000, rate: 0.00 },
        { upTo: 800000, rate: 0.05 },
        { upTo: 1200000, rate: 0.10 },
        { upTo: 1600000, rate: 0.15 },
        { upTo: 2000000, rate: 0.20 },
        { upTo: 2400000, rate: 0.25 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 1200000,
      maxRebate: 60000,
      hasMarginalRelief: true,
      marginalReliefCap: (taxableIncome, baseTax, threshold) => {
        // If income exceeds 12,00,000, tax cannot exceed the amount by which income exceeds 12,00,000
        if (taxableIncome > threshold) {
          const excessIncome = taxableIncome - threshold;
          return Math.min(baseTax, excessIncome);
        }
        return baseTax;
      }
    },
    OLD: {
      standardDeduction: 50000,
      slabs: [
        { upTo: 250000, rate: 0.00 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 500000,
      maxRebate: 12500,
      hasMarginalRelief: false
    }
  },

  // Tax Year 2024–25 and 2025–26 (Finance (No. 2) Act, 2024)
  '2025-2026': {
    NEW: {
      standardDeduction: 75000,
      slabs: [
        { upTo: 300000, rate: 0.00 },
        { upTo: 700000, rate: 0.05 },
        { upTo: 1000000, rate: 0.10 },
        { upTo: 1200000, rate: 0.15 },
        { upTo: 1500000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 700000,
      maxRebate: 25000,
      hasMarginalRelief: true,
      marginalReliefCap: (taxableIncome, baseTax, threshold) => {
        if (taxableIncome > threshold) {
          const excessIncome = taxableIncome - threshold;
          return Math.min(baseTax, excessIncome);
        }
        return baseTax;
      }
    },
    OLD: {
      standardDeduction: 50000,
      slabs: [
        { upTo: 250000, rate: 0.00 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 500000,
      maxRebate: 12500,
      hasMarginalRelief: false
    }
  },
  '2024-2025': {
    NEW: {
      standardDeduction: 75000,
      slabs: [
        { upTo: 300000, rate: 0.00 },
        { upTo: 700000, rate: 0.05 },
        { upTo: 1000000, rate: 0.10 },
        { upTo: 1200000, rate: 0.15 },
        { upTo: 1500000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 700000,
      maxRebate: 25000,
      hasMarginalRelief: true,
      marginalReliefCap: (taxableIncome, baseTax, threshold) => {
        if (taxableIncome > threshold) {
          const excessIncome = taxableIncome - threshold;
          return Math.min(baseTax, excessIncome);
        }
        return baseTax;
      }
    },
    OLD: {
      standardDeduction: 50000,
      slabs: [
        { upTo: 250000, rate: 0.00 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 500000,
      maxRebate: 12500,
      hasMarginalRelief: false
    }
  },

  // Tax Year 2023–24 (Finance Act, 2023)
  '2023-2024': {
    NEW: {
      standardDeduction: 50000,
      slabs: [
        { upTo: 300000, rate: 0.00 },
        { upTo: 600000, rate: 0.05 },
        { upTo: 900000, rate: 0.10 },
        { upTo: 1200000, rate: 0.15 },
        { upTo: 1500000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 700000,
      maxRebate: 25000,
      hasMarginalRelief: false
    },
    OLD: {
      standardDeduction: 50000,
      slabs: [
        { upTo: 250000, rate: 0.00 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.20 },
        { upTo: Infinity, rate: 0.30 }
      ],
      rebateThreshold: 500000,
      maxRebate: 12500,
      hasMarginalRelief: false
    }
  }
};

/**
 * Rounds a monetary amount to the nearest 10 (Section 288A/B compliance)
 */
export function roundToNearestTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

/**
 * Calculates progressive slab tax and returns bracket breakdown
 */
function computeSlabTax(taxableIncome: number, slabs: SlabDefinition[]) {
  let remaining = taxableIncome;
  let lowerBound = 0;
  let totalTax = 0;
  const breakdown: Array<{
    bracket: string;
    ratePct: number;
    taxableAmountInBracket: number;
    tax: number;
  }> = [];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const bracketSpan = slab.upTo === Infinity ? remaining : slab.upTo - lowerBound;
    const taxableInBracket = Math.min(remaining, bracketSpan);
    const taxInBracket = Math.round(taxableInBracket * slab.rate);

    totalTax += taxInBracket;
    breakdown.push({
      bracket: slab.upTo === Infinity ? `Above ₹${lowerBound.toLocaleString('en-IN')}` : `₹${lowerBound.toLocaleString('en-IN')} - ₹${slab.upTo.toLocaleString('en-IN')}`,
      ratePct: slab.rate * 100,
      taxableAmountInBracket: taxableInBracket,
      tax: taxInBracket
    });

    remaining -= taxableInBracket;
    lowerBound = slab.upTo;
  }

  return { totalTax, breakdown };
}

/**
 * Computes Surcharge with statutory Marginal Relief under the First Schedule to Finance Act
 */
function computeSurcharge(
  taxableIncome: number,
  taxAfterRebate: number,
  slabs: SlabDefinition[]
): { surcharge: number; marginalRelief: number } {
  if (taxableIncome <= 5000000 || taxAfterRebate <= 0) {
    return { surcharge: 0, marginalRelief: 0 };
  }

  let surchargeRate = 0;
  let threshold = 5000000;
  let priorSurchargeRate = 0;

  if (taxableIncome > 20000000) {
    surchargeRate = 0.25;
    threshold = 20000000;
    priorSurchargeRate = 0.15;
  } else if (taxableIncome > 10000000) {
    surchargeRate = 0.15;
    threshold = 10000000;
    priorSurchargeRate = 0.10;
  } else if (taxableIncome > 5000000) {
    surchargeRate = 0.10;
    threshold = 5000000;
    priorSurchargeRate = 0;
  }

  const rawSurcharge = Math.round(taxAfterRebate * surchargeRate);
  
  // Surcharge Marginal Relief (First Schedule to Finance Act):
  // The aggregate of (Tax + Surcharge) shall not exceed the aggregate of
  // (Tax on threshold income + Surcharge on threshold income) + (Total Income - Threshold Income).
  const taxAtThreshold = computeSlabTax(threshold, slabs).totalTax;
  const surchargeAtThreshold = Math.round(taxAtThreshold * priorSurchargeRate);
  const totalAtThreshold = taxAtThreshold + surchargeAtThreshold;
  const excessIncome = taxableIncome - threshold;
  const maxAllowableTotal = totalAtThreshold + excessIncome;

  const currentTotal = taxAfterRebate + rawSurcharge;

  if (currentTotal > maxAllowableTotal) {
    const marginalRelief = currentTotal - maxAllowableTotal;
    const finalSurcharge = Math.max(0, rawSurcharge - marginalRelief);
    return { surcharge: finalSurcharge, marginalRelief };
  }

  return { surcharge: rawSurcharge, marginalRelief: 0 };
}

/**
 * Centralized, Versioned, Authoritative Income Tax (TDS) Calculation Engine
 */
export function calculateIncomeTax(input: TaxCalculationInput): TaxCalculationResult {
  const annualGross = Math.max(0, Number(input.annualGross || 0));
  const regime: TaxRegime = input.regime?.toUpperCase() === 'OLD' ? 'OLD' : 'NEW';
  const financialYear = input.financialYear && TAX_YEAR_REGISTRY[input.financialYear] ? input.financialYear : '2026-2027';

  const rules = TAX_YEAR_REGISTRY[financialYear][regime];

  // 1. Standard Deduction
  const standardDeduction = rules.standardDeduction;

  // 2. Chapter VI-A Deductions (Old Regime only)
  let chapterVIA = 0;
  if (regime === 'OLD' && input.declarations) {
    const sec80C = Math.min(150000, Math.max(0, Number(input.declarations.section80C || 0)));
    const sec80D = Math.min(50000, Math.max(0, Number(input.declarations.section80D || 0)));
    const sec24b = Math.min(200000, Math.max(0, Number(input.declarations.section24b || 0)));
    const other = Math.max(0, Number(input.declarations.otherDeductions || 0));
    chapterVIA = sec80C + sec80D + sec24b + other;
  }

  // 3. Taxable Income (Rounded to nearest 10 u/s 288A)
  const rawTaxableIncome = Math.max(0, annualGross - standardDeduction - chapterVIA);
  const taxableIncome = roundToNearestTen(rawTaxableIncome);

  // 4. Progressive Slab Tax
  const { totalTax: grossTax, breakdown: slabBreakdown } = computeSlabTax(taxableIncome, rules.slabs);

  // 5. Rebate (Section 87A equivalent) & Marginal Relief
  let rebate87A = 0;
  let marginalRelief = 0;
  let taxAfterRebate = grossTax;

  if (taxableIncome <= rules.rebateThreshold) {
    // Within threshold -> 100% tax rebate
    rebate87A = Math.min(grossTax, rules.maxRebate);
    taxAfterRebate = Math.max(0, grossTax - rebate87A);
  } else if (rules.hasMarginalRelief && rules.marginalReliefCap) {
    // Just above threshold -> apply marginal relief cap
    const cappedTax = rules.marginalReliefCap(taxableIncome, grossTax, rules.rebateThreshold);
    if (cappedTax < grossTax) {
      marginalRelief = grossTax - cappedTax;
      taxAfterRebate = cappedTax;
    }
  }

  // 6. Surcharge
  const { surcharge, marginalRelief: surchargeMarginalRelief } = computeSurcharge(taxableIncome, taxAfterRebate, rules.slabs);

  // 7. Health & Education Cess (4% on Tax + Surcharge)
  const baseForCess = taxAfterRebate + surcharge;
  const cess = baseForCess > 0 ? Math.round(baseForCess * 0.04) : 0;

  // 8. Total Annual Tax (Rounded to nearest 10 u/s 288B)
  const rawTotalTax = taxAfterRebate + surcharge + cess;
  const totalAnnualTax = roundToNearestTen(rawTotalTax);

  // 9. Monthly TDS Installment
  const remainingMonths = input.remainingMonths !== undefined && input.remainingMonths !== null && !isNaN(Number(input.remainingMonths))
    ? Math.max(1, Math.min(12, Number(input.remainingMonths)))
    : 12;
  const tdsAlreadyDeducted = Math.max(0, Number(input.tdsAlreadyDeducted || 0));
  const remainingTax = Math.max(0, totalAnnualTax - tdsAlreadyDeducted);
  const monthlyTds = Math.round(remainingTax / remainingMonths);

  return {
    financialYear,
    regime,
    annualGross,
    standardDeduction,
    chapterVIA,
    taxableIncome,
    grossTax,
    rebate87A,
    marginalRelief,
    surchargeMarginalRelief,
    taxAfterRebate,
    surcharge,
    cess,
    totalAnnualTax,
    monthlyTds,
    breakdown: {
      slabBreakdown
    }
  };
}

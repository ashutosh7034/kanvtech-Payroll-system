import { Decimal } from 'decimal.js';
import { AppError } from '../../middleware/errorHandler.js';

export type LoanInterestType = 'INTEREST_FREE' | 'FIXED_RATE';
export type LoanInterestMethod = 'FLAT_RATE' | 'REDUCING_BALANCE';

export interface LoanCalculationInput {
  principal: Decimal | number | string;
  tenureMonths: number;
  interestType: LoanInterestType;
  interestMethod?: LoanInterestMethod;
  annualInterestRatePct?: Decimal | number | string;
}

export interface ScheduleItem {
  installmentNumber: number;
  dueDate?: string;
  openingBalance: Decimal;
  emi: Decimal;
  principalPortion: Decimal;
  interestPortion: Decimal;
  closingBalance: Decimal;
}

export interface LoanCalculationResult {
  principal: Decimal;
  tenureMonths: number;
  interestType: LoanInterestType;
  interestMethod: LoanInterestMethod;
  annualInterestRatePct: Decimal;
  monthlyEmi: Decimal;
  totalInterest: Decimal;
  totalRepayment: Decimal;
  schedule: ScheduleItem[];
}

export class LoanCalculator {
  /**
   * Authoritative Decimal-safe loan calculation engine
   */
  public static calculate(input: LoanCalculationInput): LoanCalculationResult {
    // 1. Validate Principal
    let principal: Decimal;
    try {
      if (input.principal === undefined || input.principal === null || input.principal === '') {
        throw new AppError('Principal amount is required and cannot be empty.', 400);
      }
      principal = new Decimal(input.principal);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid principal amount: must be a valid positive numeric monetary value.', 400);
    }

    if (principal.isNaN() || !principal.isFinite()) {
      throw new AppError('Principal amount must be a finite number.', 400);
    }
    if (principal.lte(0)) {
      throw new AppError('Principal amount must be strictly greater than zero.', 400);
    }

    // 2. Validate Tenure
    const tenureMonths = Number(input.tenureMonths);
    if (!Number.isInteger(tenureMonths) || tenureMonths <= 0 || tenureMonths > 120) {
      throw new AppError('Tenure must be a positive integer between 1 and 120 months.', 400);
    }

    const interestType: LoanInterestType = input.interestType === 'FIXED_RATE' ? 'FIXED_RATE' : 'INTEREST_FREE';
    const interestMethod: LoanInterestMethod = input.interestMethod === 'REDUCING_BALANCE' ? 'REDUCING_BALANCE' : 'FLAT_RATE';

    let annualRate = new Decimal(0);
    if (interestType === 'FIXED_RATE') {
      try {
        if (input.annualInterestRatePct === undefined || input.annualInterestRatePct === null || input.annualInterestRatePct === '') {
          throw new AppError('Annual interest rate (%) is required for interest-bearing loans.', 400);
        }
        annualRate = new Decimal(input.annualInterestRatePct);
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid interest rate: must be a valid percentage.', 400);
      }

      if (annualRate.isNaN() || !annualRate.isFinite()) {
        throw new AppError('Annual interest rate must be a finite number.', 400);
      }
      if (annualRate.lt(0)) {
        throw new AppError('Annual interest rate cannot be negative.', 400);
      }
      if (annualRate.gt(100)) {
        throw new AppError('Annual interest rate cannot exceed 100%.', 400);
      }
    }

    // 3. Execute math based on calculation model
    if (interestType === 'INTEREST_FREE' || annualRate.isZero()) {
      return this.calculateInterestFree(principal, tenureMonths);
    }

    if (interestMethod === 'FLAT_RATE') {
      return this.calculateFlatRate(principal, tenureMonths, annualRate);
    } else {
      return this.calculateReducingBalance(principal, tenureMonths, annualRate);
    }
  }

  /**
   * Interest-Free Loan
   * Monthly EMI = Principal / Tenure (rounded half-up)
   * Total Interest = 0
   * Total Repayment = Principal
   */
  public static calculateInterestFree(principal: Decimal, tenureMonths: number): LoanCalculationResult {
    const monthlyEmi = principal.dividedBy(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalInterest = new Decimal(0);
    const totalRepayment = principal;

    const schedule: ScheduleItem[] = [];
    let currentBalance = principal;

    for (let i = 1; i <= tenureMonths; i++) {
      const opening = currentBalance;
      let emi = monthlyEmi;
      let principalPortion = emi;

      // Final instalment reconciliation
      if (i === tenureMonths) {
        principalPortion = opening;
        emi = principalPortion;
      }

      currentBalance = opening.minus(principalPortion);

      schedule.push({
        installmentNumber: i,
        openingBalance: opening,
        emi,
        principalPortion,
        interestPortion: new Decimal(0),
        closingBalance: currentBalance
      });
    }

    return {
      principal,
      tenureMonths,
      interestType: 'INTEREST_FREE',
      interestMethod: 'FLAT_RATE',
      annualInterestRatePct: new Decimal(0),
      monthlyEmi,
      totalInterest,
      totalRepayment,
      schedule
    };
  }

  /**
   * Flat-Rate Interest Loan
   * Total Interest = Principal * (Annual Rate / 100) * (Tenure in Years)
   * Total Repayment = Principal + Total Interest
   * Monthly EMI = Total Repayment / Tenure (rounded half-up)
   */
  public static calculateFlatRate(
    principal: Decimal,
    arg2: number | Decimal,
    arg3: Decimal | number
  ): LoanCalculationResult {
    const tenureMonths = typeof arg2 === 'number' ? arg2 : Number(arg3);
    const annualRatePct = arg2 instanceof Decimal ? arg2 : (arg3 instanceof Decimal ? arg3 : new Decimal(arg3));
    const tenureYears = new Decimal(tenureMonths).dividedBy(12);
    const rateFactor = annualRatePct.dividedBy(100);
    const totalInterest = principal.times(rateFactor).times(tenureYears).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalRepayment = principal.plus(totalInterest);
    const monthlyEmi = totalRepayment.dividedBy(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const monthlyInterest = totalInterest.dividedBy(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const monthlyPrincipal = principal.dividedBy(tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const schedule: ScheduleItem[] = [];
    let currentBalance = totalRepayment;

    for (let i = 1; i <= tenureMonths; i++) {
      const opening = currentBalance;
      let emi = monthlyEmi;
      let intPortion = monthlyInterest;
      let princPortion = monthlyPrincipal;

      // Final instalment reconciles any penny difference
      if (i === tenureMonths) {
        emi = opening;
        intPortion = totalInterest.minus(monthlyInterest.times(tenureMonths - 1));
        princPortion = emi.minus(intPortion);
      }

      currentBalance = opening.minus(emi);

      schedule.push({
        installmentNumber: i,
        openingBalance: opening,
        emi,
        principalPortion: princPortion,
        interestPortion: intPortion,
        closingBalance: currentBalance
      });
    }

    return {
      principal,
      tenureMonths,
      interestType: 'FIXED_RATE',
      interestMethod: 'FLAT_RATE',
      annualInterestRatePct: annualRatePct,
      monthlyEmi,
      totalInterest,
      totalRepayment,
      schedule
    };
  }

  /**
   * Reducing-Balance Interest Loan
   * Monthly Rate r = Annual Rate / 12 / 100
   * EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
   * Total Repayment = Sum of all EMIs
   * Total Interest = Total Repayment - Principal
   */
  public static calculateReducingBalance(
    principal: Decimal,
    arg2: number | Decimal,
    arg3: Decimal | number
  ): LoanCalculationResult {
    const tenureMonths = typeof arg2 === 'number' ? arg2 : Number(arg3);
    const annualRatePct = arg2 instanceof Decimal ? arg2 : (arg3 instanceof Decimal ? arg3 : new Decimal(arg3));
    const monthlyRate = annualRatePct.dividedBy(1200);

    // If rate is effectively zero
    if (monthlyRate.isZero()) {
      return this.calculateInterestFree(principal, tenureMonths);
    }

    // (1 + r)^n
    const onePlusR = new Decimal(1).plus(monthlyRate);
    const factor = onePlusR.pow(tenureMonths);

    // P * r * factor / (factor - 1)
    const numerator = principal.times(monthlyRate).times(factor);
    const denominator = factor.minus(1);
    const monthlyEmi = numerator.dividedBy(denominator).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const schedule: ScheduleItem[] = [];
    let currentPrincipal = principal;
    let accumulatedInterest = new Decimal(0);
    let accumulatedRepayment = new Decimal(0);

    for (let i = 1; i <= tenureMonths; i++) {
      const opening = currentPrincipal;
      let intPortion = opening.times(monthlyRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      let princPortion = monthlyEmi.minus(intPortion);
      let emi = monthlyEmi;

      // Final instalment reconciliation
      if (i === tenureMonths || princPortion.gte(opening)) {
        princPortion = opening;
        emi = princPortion.plus(intPortion);
      }

      currentPrincipal = opening.minus(princPortion);
      accumulatedInterest = accumulatedInterest.plus(intPortion);
      accumulatedRepayment = accumulatedRepayment.plus(emi);

      schedule.push({
        installmentNumber: i,
        openingBalance: opening,
        emi,
        principalPortion: princPortion,
        interestPortion: intPortion,
        closingBalance: currentPrincipal
      });
    }

    const totalInterest = accumulatedInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalRepayment = principal.plus(totalInterest);

    return {
      principal,
      tenureMonths,
      interestType: 'FIXED_RATE',
      interestMethod: 'REDUCING_BALANCE',
      annualInterestRatePct: annualRatePct,
      monthlyEmi,
      totalInterest,
      totalRepayment,
      schedule
    };
  }
}

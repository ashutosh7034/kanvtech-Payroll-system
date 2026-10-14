import { Decimal } from 'decimal.js';

export interface CalculationInput {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  pan?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  ifscCode?: string | null;
  cityCategory?: string | null;
  basicPay: number | Decimal;
  workingDays: number;
  payableDays: number;
  leaveLossOfPayDays: number;
  structureLines: Array<{
    salaryHeadId: string;
    headCode: string;
    headName: string;
    headType: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
    calculationType: 'FIXED' | 'PERCENTAGE_OF_HEAD' | 'FORMULA';
    baseHeadCode?: string | null;
    percentage?: number | Decimal | null;
    fixedAmount?: number | Decimal | null;
    formulaConfig?: any;
    isTaxable: boolean;
    isLeaveImpacted: boolean;
  }>;
  activeLoanRecoveries: Array<{
    loanId: string;
    loanTypeCode: string;
    loanTypeName: string;
    installmentNumber: number;
    monthlyInstallment: number | Decimal;
    outstandingAmount: number | Decimal;
  }>;
  otherPayments: Array<{
    typeCode: string;
    typeName: string;
    amount: number | Decimal;
    isTaxable: boolean;
  }>;
  manualTds?: number | Decimal;
}

export interface CalculatedHeadItem {
  salaryHeadId: string;
  headCode: string;
  headName: string;
  headType: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
  amount: Decimal;
  ruleExplanation: string;
}

export interface PayrollCalculationResult {
  employeeId: string;
  employeeCode: string;
  workingDays: number;
  payableDays: number;
  leaveLossOfPayDays: number;
  baseBasicPay: Decimal;
  effectiveBasicPay: Decimal;
  earnings: CalculatedHeadItem[];
  deductions: CalculatedHeadItem[];
  employerContributions: CalculatedHeadItem[];
  loanRecoveries: Array<{
    loanId: string;
    loanTypeCode: string;
    installmentNumber: number;
    amountPaid: Decimal;
    remainingBalance: Decimal;
  }>;
  grossAmount: Decimal;
  deductionAmount: Decimal;
  netAmount: Decimal;
  calculationSnapshot: Record<string, any>;
}

export class PayrollEngine {
  /**
   * Deterministically calculate monthly payroll for an employee with decimal precision.
   */
  public static calculate(input: CalculationInput): PayrollCalculationResult {
    // 1. Leave factor and basic pay adjustment
    const workingDays = new Decimal(input.workingDays > 0 ? input.workingDays : 30);
    const payableDays = new Decimal(input.payableDays >= 0 ? input.payableDays : 30);
    const lopDays = new Decimal(input.leaveLossOfPayDays || 0);

    const fullBasic = new Decimal(input.basicPay);
    // Proportion: (workingDays - lopDays) / workingDays
    const attendanceFactor = lopDays.greaterThan(0)
      ? Decimal.max(0, workingDays.minus(lopDays)).dividedBy(workingDays)
      : new Decimal(1);

    const effectiveBasic = fullBasic.times(attendanceFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const headAmountMap = new Map<string, Decimal>();
    headAmountMap.set('BASIC', effectiveBasic);

    const earnings: CalculatedHeadItem[] = [];
    const deductions: CalculatedHeadItem[] = [];
    const employerContributions: CalculatedHeadItem[] = [];

    // Helper map for fast lookup of configured heads
    const lineMap = new Map(input.structureLines.map(l => [l.headCode, l]));

    // 2. Process Earnings First
    for (const line of input.structureLines) {
      if (line.headType !== 'EARNING') continue;

      let amount = new Decimal(0);
      let explanation = '';

      if (line.headCode === 'BASIC') {
        amount = effectiveBasic;
        explanation = lopDays.greaterThan(0)
          ? `Basic ₹${fullBasic.toFixed(2)} prorated for ${payableDays} days (LOP: ${lopDays} days) = ₹${amount.toFixed(2)}`
          : `Full monthly basic pay: ₹${amount.toFixed(2)}`;
      } else if (line.calculationType === 'PERCENTAGE_OF_HEAD') {
        const baseCode = line.baseHeadCode ?? 'BASIC';
        let baseAmount = headAmountMap.get(baseCode) ?? new Decimal(0);
        if (baseCode === 'BASIC_PLUS_DA') {
          const da = headAmountMap.get('DA') ?? new Decimal(0);
          baseAmount = effectiveBasic.plus(da);
        }
        const pct = new Decimal(line.percentage ?? 0).dividedBy(100);
        amount = baseAmount.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        explanation = `${line.percentage}% of ${baseCode} (₹${baseAmount.toFixed(2)}) = ₹${amount.toFixed(2)}`;
      } else if (line.calculationType === 'FIXED') {
        const fixed = new Decimal(line.fixedAmount ?? 0);
        amount = line.isLeaveImpacted && lopDays.greaterThan(0)
          ? fixed.times(attendanceFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          : fixed;
        explanation = `Fixed allowance ₹${amount.toFixed(2)}`;
      }

      headAmountMap.set(line.headCode, amount);
      earnings.push({
        salaryHeadId: line.salaryHeadId,
        headCode: line.headCode,
        headName: line.headName,
        headType: 'EARNING',
        amount,
        ruleExplanation: explanation
      });
    }

    // Add other taxable payments (bonus, honorarium, CEA)
    if (input.otherPayments && input.otherPayments.length > 0) {
      for (const op of input.otherPayments) {
        const opAmount = new Decimal(op.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        earnings.push({
          salaryHeadId: `other-${op.typeCode}`,
          headCode: op.typeCode,
          headName: op.typeName,
          headType: 'EARNING',
          amount: opAmount,
          ruleExplanation: `Approved additional payment: ₹${opAmount.toFixed(2)}`
        });
      }
    }

    // 3. Process Deductions
    for (const line of input.structureLines) {
      if (line.headType !== 'DEDUCTION') continue;

      let amount = new Decimal(0);
      let explanation = '';

      if (line.headCode === 'TDS' && input.manualTds !== undefined) {
        amount = new Decimal(input.manualTds).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        explanation = `Monthly tax deduction (TDS) ₹${amount.toFixed(2)}`;
      } else if (line.calculationType === 'PERCENTAGE_OF_HEAD') {
        const baseCode = line.baseHeadCode ?? 'BASIC';
        let baseAmount = headAmountMap.get(baseCode) ?? new Decimal(0);
        if (baseCode === 'BASIC_PLUS_DA') {
          const da = headAmountMap.get('DA') ?? new Decimal(0);
          baseAmount = effectiveBasic.plus(da);
        }
        const pct = new Decimal(line.percentage ?? 0).dividedBy(100);
        amount = baseAmount.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        explanation = `${line.percentage}% of ${baseCode} (₹${baseAmount.toFixed(2)}) = ₹${amount.toFixed(2)}`;
      } else if (line.calculationType === 'FIXED') {
        amount = new Decimal(line.fixedAmount ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        explanation = `Standard fixed deduction ₹${amount.toFixed(2)}`;
      }

      headAmountMap.set(line.headCode, amount);
      deductions.push({
        salaryHeadId: line.salaryHeadId,
        headCode: line.headCode,
        headName: line.headName,
        headType: 'DEDUCTION',
        amount,
        ruleExplanation: explanation
      });
    }

    // 4. Process Active Loan Recoveries
    const loanRecoveriesOut: Array<{
      loanId: string;
      loanTypeCode: string;
      installmentNumber: number;
      amountPaid: Decimal;
      remainingBalance: Decimal;
    }> = [];

    if (input.activeLoanRecoveries && input.activeLoanRecoveries.length > 0) {
      for (const lr of input.activeLoanRecoveries) {
        const instAmount = Decimal.min(new Decimal(lr.monthlyInstallment), new Decimal(lr.outstandingAmount));
        const remaining = new Decimal(lr.outstandingAmount).minus(instAmount);

        deductions.push({
          salaryHeadId: `loan-${lr.loanId}`,
          headCode: `LOAN_${lr.loanTypeCode}`,
          headName: `${lr.loanTypeName} (Inst #${lr.installmentNumber})`,
          headType: 'DEDUCTION',
          amount: instAmount,
          ruleExplanation: `Installment #${lr.installmentNumber} recovery: ₹${instAmount.toFixed(2)} (Remaining: ₹${remaining.toFixed(2)})`
        });

        loanRecoveriesOut.push({
          loanId: lr.loanId,
          loanTypeCode: lr.loanTypeCode,
          installmentNumber: lr.installmentNumber,
          amountPaid: instAmount,
          remainingBalance: remaining
        });
      }
    }

    // 5. Process Employer Contributions
    for (const line of input.structureLines) {
      if (line.headType !== 'EMPLOYER_CONTRIBUTION') continue;

      let amount = new Decimal(0);
      let explanation = '';

      if (line.calculationType === 'PERCENTAGE_OF_HEAD') {
        const baseCode = line.baseHeadCode ?? 'BASIC';
        let baseAmount = headAmountMap.get(baseCode) ?? new Decimal(0);
        if (baseCode === 'BASIC_PLUS_DA') {
          const da = headAmountMap.get('DA') ?? new Decimal(0);
          baseAmount = effectiveBasic.plus(da);
        }
        const pct = new Decimal(line.percentage ?? 0).dividedBy(100);
        amount = baseAmount.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        explanation = `Employer contribution: ${line.percentage}% of ${baseCode} = ₹${amount.toFixed(2)}`;
      } else if (line.calculationType === 'FIXED') {
        amount = new Decimal(line.fixedAmount ?? 0);
        explanation = `Employer fixed contribution: ₹${amount.toFixed(2)}`;
      }

      employerContributions.push({
        salaryHeadId: line.salaryHeadId,
        headCode: line.headCode,
        headName: line.headName,
        headType: 'EMPLOYER_CONTRIBUTION',
        amount,
        ruleExplanation: explanation
      });
    }

    // 6. Totals
    const grossAmount = earnings.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
    const deductionAmount = deductions.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
    const netAmount = Decimal.max(0, grossAmount.minus(deductionAmount));

    const calculationSnapshot = {
      calculatedAt: new Date().toISOString(),
      engineVersion: '2.1.26',
      employee: {
        id: input.employeeId,
        code: input.employeeCode,
        name: input.employeeName,
        pan: input.pan,
        bankAccount: input.bankAccount,
        bankName: input.bankName,
        ifscCode: input.ifscCode,
        cityCategory: input.cityCategory
      },
      attendance: {
        workingDays: Number(workingDays),
        payableDays: Number(payableDays),
        leaveLossOfPayDays: Number(lopDays),
        attendanceFactor: Number(attendanceFactor.toFixed(4))
      },
      summary: {
        gross: Number(grossAmount.toFixed(2)),
        deductions: Number(deductionAmount.toFixed(2)),
        net: Number(netAmount.toFixed(2))
      },
      breakdown: {
        earnings: earnings.map(e => ({ code: e.headCode, name: e.headName, amount: Number(e.amount.toFixed(2)), note: e.ruleExplanation })),
        deductions: deductions.map(d => ({ code: d.headCode, name: d.headName, amount: Number(d.amount.toFixed(2)), note: d.ruleExplanation })),
        employerContributions: employerContributions.map(c => ({ code: c.headCode, name: c.headName, amount: Number(c.amount.toFixed(2)), note: c.ruleExplanation }))
      }
    };

    return {
      employeeId: input.employeeId,
      employeeCode: input.employeeCode,
      workingDays: Number(workingDays),
      payableDays: Number(payableDays),
      leaveLossOfPayDays: Number(lopDays),
      baseBasicPay: fullBasic,
      effectiveBasicPay: effectiveBasic,
      earnings,
      deductions,
      employerContributions,
      loanRecoveries: loanRecoveriesOut,
      grossAmount,
      deductionAmount,
      netAmount,
      calculationSnapshot
    };
  }
}

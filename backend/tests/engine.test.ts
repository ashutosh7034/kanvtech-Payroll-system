import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { PayrollEngine, type CalculationInput } from '../src/modules/payroll/engine.js';

describe('PayrollEngine - Financial Calculation Unit Tests', () => {
  const sampleStructureLines: CalculationInput['structureLines'] = [
    {
      salaryHeadId: 'sh-basic',
      headCode: 'BASIC',
      headName: 'Basic Pay',
      headType: 'EARNING',
      calculationType: 'FIXED',
      fixedAmount: 56100,
      isTaxable: true,
      isLeaveImpacted: true
    },
    {
      salaryHeadId: 'sh-da',
      headCode: 'DA',
      headName: 'Dearness Allowance (50%)',
      headType: 'EARNING',
      calculationType: 'PERCENTAGE_OF_HEAD',
      baseHeadCode: 'BASIC',
      percentage: 50,
      isTaxable: true,
      isLeaveImpacted: true
    },
    {
      salaryHeadId: 'sh-hra',
      headCode: 'HRA',
      headName: 'House Rent Allowance (27%)',
      headType: 'EARNING',
      calculationType: 'PERCENTAGE_OF_HEAD',
      baseHeadCode: 'BASIC',
      percentage: 27,
      isTaxable: false,
      isLeaveImpacted: true
    },
    {
      salaryHeadId: 'sh-ta',
      headCode: 'TA',
      headName: 'Transport Allowance',
      headType: 'EARNING',
      calculationType: 'FIXED',
      fixedAmount: 7200,
      isTaxable: true,
      isLeaveImpacted: true
    },
    {
      salaryHeadId: 'sh-nps',
      headCode: 'NPS_TIER1',
      headName: 'NPS Tier 1 (10% of Basic+DA)',
      headType: 'DEDUCTION',
      calculationType: 'PERCENTAGE_OF_HEAD',
      baseHeadCode: 'BASIC_PLUS_DA',
      percentage: 10,
      isTaxable: false,
      isLeaveImpacted: true
    },
    {
      salaryHeadId: 'sh-tds',
      headCode: 'TDS',
      headName: 'Income Tax (TDS)',
      headType: 'DEDUCTION',
      calculationType: 'FIXED',
      fixedAmount: 5000,
      isTaxable: false,
      isLeaveImpacted: false
    },
    {
      salaryHeadId: 'sh-pt',
      headCode: 'PT',
      headName: 'Professional Tax',
      headType: 'DEDUCTION',
      calculationType: 'FIXED',
      fixedAmount: 200,
      isTaxable: false,
      isLeaveImpacted: false
    },
    {
      salaryHeadId: 'sh-emp-nps',
      headCode: 'EMPLOYER_NPS',
      headName: 'Employer NPS Contribution (14%)',
      headType: 'EMPLOYER_CONTRIBUTION',
      calculationType: 'PERCENTAGE_OF_HEAD',
      baseHeadCode: 'BASIC_PLUS_DA',
      percentage: 14,
      isTaxable: false,
      isLeaveImpacted: true
    }
  ];

  it('calculates full standard monthly payroll correctly with 0 LOP', () => {
    const input: CalculationInput = {
      employeeId: 'emp-101',
      employeeCode: 'EMP001',
      employeeName: 'Dr. Vikram Sharma',
      basicPay: 56100,
      workingDays: 30,
      payableDays: 30,
      leaveLossOfPayDays: 0,
      structureLines: sampleStructureLines,
      activeLoanRecoveries: [],
      otherPayments: []
    };

    const result = PayrollEngine.calculate(input);

    // Basic: 56,100
    // DA (50% of 56100): 28,050
    // HRA (27% of 56100): 15,147
    // TA: 7,200
    // Gross = 56100 + 28050 + 15147 + 7200 = 106,497
    expect(result.effectiveBasicPay.toNumber()).toBe(56100);
    expect(result.grossAmount.toNumber()).toBe(106497);

    // Basic+DA = 56100 + 28050 = 84,150
    // NPS = 10% of 84150 = 8,415
    // TDS = 5,000
    // PT = 200
    // Total Deductions = 8415 + 5000 + 200 = 13,615
    expect(result.deductionAmount.toNumber()).toBe(13615);

    // Net Amount = 106497 - 13615 = 92,882
    expect(result.netAmount.toNumber()).toBe(92882);

    // Employer NPS = 14% of 84150 = 11,781
    const empContribution = result.employerContributions.find(c => c.headCode === 'EMPLOYER_NPS');
    expect(empContribution).toBeDefined();
    expect(empContribution!.amount.toNumber()).toBe(11781);
  });

  it('accurately prorates earnings when employee has Loss of Pay (LOP) days', () => {
    const input: CalculationInput = {
      employeeId: 'emp-101',
      employeeCode: 'EMP001',
      employeeName: 'Dr. Vikram Sharma',
      basicPay: 60000,
      workingDays: 30,
      payableDays: 27,
      leaveLossOfPayDays: 3, // 10% loss of pay
      structureLines: [
        {
          salaryHeadId: 'sh-basic',
          headCode: 'BASIC',
          headName: 'Basic Pay',
          headType: 'EARNING',
          calculationType: 'FIXED',
          fixedAmount: 60000,
          isTaxable: true,
          isLeaveImpacted: true
        },
        {
          salaryHeadId: 'sh-da',
          headCode: 'DA',
          headName: 'Dearness Allowance (50%)',
          headType: 'EARNING',
          calculationType: 'PERCENTAGE_OF_HEAD',
          baseHeadCode: 'BASIC',
          percentage: 50,
          isTaxable: true,
          isLeaveImpacted: true
        },
        {
          salaryHeadId: 'sh-pt',
          headCode: 'PT',
          headName: 'Professional Tax (Fixed)',
          headType: 'DEDUCTION',
          calculationType: 'FIXED',
          fixedAmount: 200,
          isTaxable: false,
          isLeaveImpacted: false
        }
      ],
      activeLoanRecoveries: [],
      otherPayments: []
    };

    const result = PayrollEngine.calculate(input);

    // Effective Basic = 60,000 * (27 / 30) = 54,000
    expect(result.effectiveBasicPay.toNumber()).toBe(54000);

    // DA = 50% of 54,000 = 27,000
    const da = result.earnings.find(e => e.headCode === 'DA');
    expect(da?.amount.toNumber()).toBe(27000);

    // Gross = 54000 + 27000 = 81,000
    expect(result.grossAmount.toNumber()).toBe(81000);

    // PT is not leave impacted, stays 200
    expect(result.deductionAmount.toNumber()).toBe(200);
    expect(result.netAmount.toNumber()).toBe(80800);
  });

  it('deducts active loan recovery installment and tracks remaining balance', () => {
    const input: CalculationInput = {
      employeeId: 'emp-102',
      employeeCode: 'EMP002',
      employeeName: 'Priya Patel',
      basicPay: 50000,
      workingDays: 30,
      payableDays: 30,
      leaveLossOfPayDays: 0,
      structureLines: [
        {
          salaryHeadId: 'sh-basic',
          headCode: 'BASIC',
          headName: 'Basic Pay',
          headType: 'EARNING',
          calculationType: 'FIXED',
          fixedAmount: 50000,
          isTaxable: true,
          isLeaveImpacted: true
        }
      ],
      activeLoanRecoveries: [
        {
          loanId: 'loan-festival-01',
          loanTypeCode: 'FESTIVAL_ADVANCE',
          loanTypeName: 'Festival Advance',
          installmentNumber: 2,
          monthlyInstallment: 5000,
          outstandingAmount: 25000
        }
      ],
      otherPayments: []
    };

    const result = PayrollEngine.calculate(input);

    expect(result.loanRecoveries.length).toBe(1);
    const recovery = result.loanRecoveries[0];
    expect(recovery.loanTypeCode).toBe('FESTIVAL_ADVANCE');
    expect(recovery.amountPaid.toNumber()).toBe(5000);
    expect(recovery.remainingBalance.toNumber()).toBe(20000);

    // Gross = 50,000
    // Deduction = 5,000 loan recovery
    // Net = 45,000
    expect(result.grossAmount.toNumber()).toBe(50000);
    expect(result.deductionAmount.toNumber()).toBe(5000);
    expect(result.netAmount.toNumber()).toBe(45000);
  });

  it('includes approved other taxable payments in gross earnings', () => {
    const input: CalculationInput = {
      employeeId: 'emp-103',
      employeeCode: 'EMP003',
      employeeName: 'Anil Kumar',
      basicPay: 40000,
      workingDays: 30,
      payableDays: 30,
      leaveLossOfPayDays: 0,
      structureLines: [
        {
          salaryHeadId: 'sh-basic',
          headCode: 'BASIC',
          headName: 'Basic Pay',
          headType: 'EARNING',
          calculationType: 'FIXED',
          fixedAmount: 40000,
          isTaxable: true,
          isLeaveImpacted: true
        }
      ],
      activeLoanRecoveries: [],
      otherPayments: [
        {
          typeCode: 'CEA',
          typeName: 'Children Education Allowance',
          amount: 27000,
          isTaxable: true
        }
      ]
    };

    const result = PayrollEngine.calculate(input);

    // Gross = 40,000 + 27,000 = 67,000
    expect(result.grossAmount.toNumber()).toBe(67000);
    expect(result.earnings.some(e => e.headCode === 'CEA')).toBe(true);
    expect(result.netAmount.toNumber()).toBe(67000);
  });

  it('produces identical deterministic snapshots across repeated executions', () => {
    const input: CalculationInput = {
      employeeId: 'emp-101',
      employeeCode: 'EMP001',
      employeeName: 'Dr. Vikram Sharma',
      basicPay: 56100,
      workingDays: 30,
      payableDays: 30,
      leaveLossOfPayDays: 0,
      structureLines: sampleStructureLines,
      activeLoanRecoveries: [],
      otherPayments: []
    };

    const run1 = PayrollEngine.calculate(input);
    const run2 = PayrollEngine.calculate(input);

    expect(run1.grossAmount.toString()).toEqual(run2.grossAmount.toString());
    expect(run1.netAmount.toString()).toEqual(run2.netAmount.toString());
    expect(run1.deductionAmount.toString()).toEqual(run2.deductionAmount.toString());
    expect(run1.calculationSnapshot.summary).toEqual(run2.calculationSnapshot.summary);
    expect(run1.calculationSnapshot.breakdown).toEqual(run2.calculationSnapshot.breakdown);
  });
});

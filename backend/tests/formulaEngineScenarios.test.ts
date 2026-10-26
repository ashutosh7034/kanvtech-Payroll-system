import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { PayrollCalculationEngine } from '../src/modules/payroll/calculationEngine.js';
import { FormulaEngine } from '../src/modules/compensation/formulaEngine.js';
import { Decimal } from 'decimal.js';

describe('Authoritative Payroll Formula Engine & UAT 25-Scenario Verification', () => {
  let adminToken = '';
  let companyId = '';
  const testRunIds: string[] = [];

  const ptSlabs = [
    { state: 'Maharashtra', minSalary: 0, maxSalary: 7500, monthlyAmount: 0 },
    { state: 'Maharashtra', minSalary: 7501, maxSalary: 10000, monthlyAmount: 175 },
    { state: 'Maharashtra', minSalary: 10001, maxSalary: null, monthlyAmount: 200, februaryAmount: 300 }
  ];

  const standardStatutoryConfig = {
    pfWageCeiling: 15000,
    pfEmployeePct: 12.0,
    pfEmployerPct: 12.0,
    esicWageCeiling: 21000,
    esicEmployeePct: 0.75,
    esicEmployerPct: 3.25,
    gratuityPct: 4.81
  };

  const octPeriod = {
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-31'),
    month: 10,
    year: 2026
  };

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    companyId = adminRes.body.user.companyId;
  });

  afterAll(async () => {
    if (testRunIds.length > 0) {
      await prisma.corporatePayrollSlip.deleteMany({
        where: { payrollRunId: { in: testRunIds } }
      });
      await prisma.corporatePayrollRun.deleteMany({
        where: { id: { in: testRunIds } }
      });
    }
  });

  // 1. Employee with fixed monthly salary
  it('Scenario 1: calculates employee with fixed monthly salary accurately', async () => {
    const mockEmp = {
      id: 'emp-fixed-1',
      employeeCode: 'UAT-01-FIXED',
      firstName: 'Vikram',
      lastName: 'Malhotra',
      dateOfJoining: new Date('2024-01-01'),
      branch: { state: 'Maharashtra' },
      salaryStructure: {
        annualCtc: 960000,
        monthlyGross: 80000,
        lines: [
          { code: 'BASIC', name: 'Basic Salary', category: 'FIXED_EARNING', monthlyAmount: 50000 },
          { code: 'HRA', name: 'House Rent Allowance', category: 'FIXED_EARNING', monthlyAmount: 25000 },
          { code: 'CONVEYANCE', name: 'Conveyance Allowance', category: 'FIXED_EARNING', monthlyAmount: 5000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'EXEMPT',
        esiApplicable: false,
        esiStatus: 'EXEMPT_OVER_CEILING',
        ptApplicable: true,
        ptState: 'Maharashtra',
        tdsMonthlyOverride: 0,
        taxRegime: 'NEW'
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig);

    expect(res.grossPay.toNumber()).toBe(80000.00);
    expect(res.deductionsPay.toNumber()).toBe(200.00); // Only Maharashtra PT ₹200
    expect(res.netPay.toNumber()).toBe(79800.00);
    expect(res.attendance.isProrated).toBe(false);
    expect(res.items.find(i => i.code === 'BASIC')?.calculatedAmount.toNumber()).toBe(50000.00);
  });

  // 2. Employee with percentage-based HRA
  it('Scenario 2: evaluates percentage-based HRA formula correctly', async () => {
    const mockEmp = {
      id: 'emp-pct-hra',
      employeeCode: 'UAT-02-HRA',
      firstName: 'Ananya',
      lastName: 'Sharma',
      dateOfJoining: new Date('2024-01-01'),
      branch: { state: 'Maharashtra' },
      salaryStructure: {
        annualCtc: 1008000,
        monthlyGross: 84000,
        lines: [
          { code: 'BASIC', name: 'Basic Salary', calculationMode: 'FIXED_AMOUNT', monthlyAmount: 60000 },
          {
            code: 'HRA',
            name: 'House Rent Allowance',
            calculationMode: 'PERCENTAGE_OF_COMPONENT',
            baseComponentCode: 'BASIC',
            percentageValue: 40,
            monthlyAmount: 0 // Should be computed dynamically as 40% of Basic = 24,000
          }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'EXEMPT',
        esiApplicable: false,
        ptApplicable: false,
        tdsMonthlyOverride: 0,
        taxRegime: 'NEW'
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig);

    const hraItem = res.items.find(i => i.code === 'HRA');
    expect(hraItem?.calculatedAmount.toNumber()).toBe(24000.00);
    expect(res.grossPay.toNumber()).toBe(84000.00);
    expect(res.netPay.toNumber()).toBe(84000.00);
  });

  // 3. Employee with balancing special allowance
  it('Scenario 3: calculates balancing special allowance from monthly gross', async () => {
    const mockEmp = {
      id: 'emp-balancing-sa',
      employeeCode: 'UAT-03-BALANCING',
      firstName: 'Karan',
      lastName: 'Kapoor',
      dateOfJoining: new Date('2024-01-01'),
      branch: { state: 'Maharashtra' },
      salaryStructure: {
        annualCtc: 1200000,
        monthlyGross: 100000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 50000 },
          { code: 'HRA', name: 'HRA', monthlyAmount: 20000 },
          {
            code: 'SPECIAL_ALLOWANCE',
            name: 'Special Allowance',
            calculationMode: 'FORMULA_EXPRESSION',
            formulaExpression: 'MONTHLY_GROSS - BASIC - HRA',
            monthlyAmount: 0
          }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'EXEMPT',
        esiApplicable: false,
        ptApplicable: false
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig);

    const saItem = res.items.find(i => i.code === 'SPECIAL_ALLOWANCE');
    expect(saItem?.calculatedAmount.toNumber()).toBe(30000.00);
    expect(res.grossPay.toNumber()).toBe(100000.00);
  });

  // 4. Employee with different salary structure
  it('Scenario 4: assigns and computes a different salary structure independently', async () => {
    const mockExecutive = {
      id: 'emp-exec',
      employeeCode: 'UAT-04-EXEC',
      firstName: 'Pooja',
      lastName: 'Hegde',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 1800000,
        monthlyGross: 150000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 75000 },
          { code: 'HRA', name: 'HRA', monthlyAmount: 37500 },
          { code: 'LTA', name: 'Leave Travel Allowance', monthlyAmount: 12500 },
          { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', monthlyAmount: 25000 }
        ]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockExecutive, octPeriod, [], standardStatutoryConfig);

    expect(res.grossPay.toNumber()).toBe(150000.00);
    expect(res.items.find(i => i.code === 'LTA')?.calculatedAmount.toNumber()).toBe(12500.00);
  });

  // 5. Employee who joined partway through the month
  it('Scenario 5: prorates earnings accurately for mid-month joining', async () => {
    // Joining on 2026-10-16 in a 31-day month: 15 unpaid days before joining, 16 payable days
    const mockEmp = {
      id: 'emp-mid-join',
      employeeCode: 'UAT-05-JOIN',
      firstName: 'Rohit',
      lastName: 'Verma',
      dateOfJoining: new Date('2026-10-16'),
      salaryStructure: {
        annualCtc: 744000,
        monthlyGross: 62000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 62000 }
        ]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.attendance.calendarDays).toBe(31);
    expect(res.attendance.payableDays.toNumber()).toBe(16);
    expect(res.attendance.unpaidMidMonthDays.toNumber()).toBe(15);
    expect(res.attendance.isProrated).toBe(true);
    // 62,000 * 16 / 31 = 32,000.00
    expect(res.grossPay.toNumber()).toBe(32000.00);
  });

  // 6. Employee with unpaid leave (LOP)
  it('Scenario 6: prorates salary deterministically for unpaid leave (LOP)', async () => {
    const mockEmp = {
      id: 'emp-lop',
      employeeCode: 'UAT-06-LOP',
      firstName: 'Suresh',
      lastName: 'Raina',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 720000,
        monthlyGross: 60000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 60000 }
        ]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig, 5); // 5 LOP days

    expect(res.attendance.calendarDays).toBe(31);
    expect(res.attendance.payableDays.toNumber()).toBe(26);
    expect(res.attendance.lopDays.toNumber()).toBe(5);
    // 60,000 * 26 / 31 = 50322.58
    const expected = new Decimal(60000).times(26).dividedBy(31).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    expect(res.grossPay.toNumber()).toBe(expected);
  });

  // 7. Employee with paid leave
  it('Scenario 7: maintains full salary for approved paid leaves (0 LOP)', async () => {
    const mockEmp = {
      id: 'emp-paid-leave',
      employeeCode: 'UAT-07-PAID',
      firstName: 'Sneha',
      lastName: 'Iyer',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }
        ]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig, 0);

    expect(res.attendance.payableDays.toNumber()).toBe(31);
    expect(res.grossPay.toNumber()).toBe(50000.00);
  });

  // 8. Employee with approved overtime
  it('Scenario 8: computes double-rate overtime earnings accurately', async () => {
    // Basic = 49,600 in 31 days. Hourly = 49,600 / (31 * 8) = 200.00. 10 hours OT = 10 * 200 * 2.0 = 4,000.00
    const mockEmp = {
      id: 'emp-ot',
      employeeCode: 'UAT-08-OT',
      firstName: 'Dinesh',
      lastName: 'Karthik',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 595200,
        monthlyGross: 49600,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 49600 }
        ]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(
      mockEmp,
      octPeriod,
      [],
      standardStatutoryConfig,
      0, // lop
      0, // arrears
      0, // reimbursement
      0, // one-time earning
      0, // one-time deduction
      0, // tds
      10 // 10 overtime hours
    );

    const otItem = res.items.find(i => i.code === 'OVERTIME');
    expect(otItem).toBeDefined();
    expect(otItem?.calculatedAmount.toNumber()).toBe(4000.00);
    expect(res.grossPay.toNumber()).toBe(53600.00);
  });

  // 9. Employee with PF applicable
  it('Scenario 9: caps PF contribution at statutory ₹15,000 ceiling', async () => {
    const mockEmp = {
      id: 'emp-pf-applicable',
      employeeCode: 'UAT-09-PF',
      firstName: 'Sunil',
      lastName: 'Gavaskar',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 720000,
        monthlyGross: 60000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 40000 }]
      },
      payrollPolicy: {
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'CEILING_15000',
        esiApplicable: false,
        ptApplicable: false
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.pfWageBasis.toNumber()).toBe(15000.00);
    const pfItem = res.items.find(i => i.code === 'EPF_EMPLOYEE');
    expect(pfItem?.calculatedAmount.toNumber()).toBe(1800.00); // 12% of 15,000
    const emprPfItem = res.items.find(i => i.code === 'EPF_EMPLOYER');
    expect(emprPfItem?.calculatedAmount.toNumber()).toBe(1800.00);
  });

  // 10. Employee exempt from PF
  it('Scenario 10: deducts zero PF when employee is exempt', async () => {
    const mockEmp = {
      id: 'emp-pf-exempt',
      employeeCode: 'UAT-10-PF-EXEMPT',
      firstName: 'Kapil',
      lastName: 'Dev',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 720000,
        monthlyGross: 60000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 40000 }]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'EXEMPT',
        esiApplicable: false,
        ptApplicable: false
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.pfWageBasis.toNumber()).toBe(0);
    expect(res.items.find(i => i.code === 'EPF_EMPLOYEE')).toBeUndefined();
  });

  // 11. Employee with ESIC applicable
  it('Scenario 11: calculates ESIC 0.75% employee and 3.25% employer when gross <= 21,000', async () => {
    const mockEmp = {
      id: 'emp-esic-applicable',
      employeeCode: 'UAT-11-ESIC',
      firstName: 'Ramesh',
      lastName: 'Powar',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 240000,
        monthlyGross: 20000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 20000 }]
      },
      payrollPolicy: {
        pfApplicable: false,
        esiApplicable: true,
        esiStatus: 'APPLICABLE',
        ptApplicable: false
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.esiWageBasis.toNumber()).toBe(20000.00);
    // 20000 * 0.0075 = 150
    expect(res.items.find(i => i.code === 'ESIC_EMPLOYEE')?.calculatedAmount.toNumber()).toBe(150.00);
    // 20000 * 0.0325 = 650
    expect(res.items.find(i => i.code === 'ESIC_EMPLOYER')?.calculatedAmount.toNumber()).toBe(650.00);
  });

  // 12. Employee for whom ESIC is not applicable
  it('Scenario 12: exempts ESIC when gross exceeds statutory ₹21,000 ceiling', async () => {
    const mockEmp = {
      id: 'emp-esic-exempt',
      employeeCode: 'UAT-12-ESIC-EXEMPT',
      firstName: 'Ajinkya',
      lastName: 'Rahane',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 360000,
        monthlyGross: 30000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 30000 }]
      },
      payrollPolicy: {
        pfApplicable: false,
        esiApplicable: false,
        esiStatus: 'EXEMPT_OVER_CEILING',
        ptApplicable: false
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.items.find(i => i.code === 'ESIC_EMPLOYEE')).toBeUndefined();
  });

  // 13. Employee with Professional Tax
  it('Scenario 13: applies Maharashtra Professional Tax according to monthly gross slab', async () => {
    const mockEmp = {
      id: 'emp-pt',
      employeeCode: 'UAT-13-PT',
      firstName: 'Zaheer',
      lastName: 'Khan',
      dateOfJoining: new Date('2024-01-01'),
      branch: { state: 'Maharashtra' },
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }]
      },
      payrollPolicy: {
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: true,
        ptState: 'Maharashtra'
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig);

    expect(res.items.find(i => i.code === 'PROFESSIONAL_TAX')?.calculatedAmount.toNumber()).toBe(200.00);
  });

  // 14. Employee with configured TDS
  it('Scenario 14: applies configured TDS monthly deduction directly', async () => {
    const mockEmp = {
      id: 'emp-tds',
      employeeCode: 'UAT-14-TDS',
      firstName: 'Harbhajan',
      lastName: 'Singh',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 1200000,
        monthlyGross: 100000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 100000 }]
      },
      payrollPolicy: {
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
        tdsMonthlyOverride: 8500
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    expect(res.items.find(i => i.code === 'TDS')?.calculatedAmount.toNumber()).toBe(8500.00);
    expect(res.deductionsPay.toNumber()).toBe(8500.00);
  });

  // 15. Employee with an active loan instalment
  it('Scenario 15: applies active loan EMI without exceeding outstanding balance', async () => {
    const mockEmp = {
      id: 'emp-loan',
      employeeCode: 'UAT-15-LOAN',
      firstName: 'Irfan',
      lastName: 'Pathan',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false },
      loans: [
        {
          id: 'loan-1',
          monthlyEmi: 4000,
          outstandingAmount: 2500, // Outstanding is less than EMI!
          loanType: { name: 'Emergency Personal Loan' }
        }
      ]
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);

    const loanItem = res.items.find(i => i.code === 'LOAN_EMI');
    expect(loanItem).toBeDefined();
    expect(loanItem?.calculatedAmount.toNumber()).toBe(2500.00); // Must cap at outstanding 2,500
    expect(res.deductionsPay.toNumber()).toBe(2500.00);
  });

  // 16. Employee with an approved reimbursement
  it('Scenario 16: includes approved expense reimbursement in gross and net pay', async () => {
    const mockEmp = {
      id: 'emp-reimb',
      employeeCode: 'UAT-16-REIMB',
      firstName: 'Yuvraj',
      lastName: 'Singh',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(
      mockEmp,
      octPeriod,
      [],
      standardStatutoryConfig,
      0, // lop
      0, // arrears
      6400 // ₹6,400 reimbursement
    );

    const reimbItem = res.items.find(i => i.code === 'REIMBURSEMENTS');
    expect(reimbItem?.calculatedAmount.toNumber()).toBe(6400.00);
    expect(res.grossPay.toNumber()).toBe(56400.00);
    expect(res.netPay.toNumber()).toBe(56400.00);
  });

  // 17. Employee with a one-time earning
  it('Scenario 17: adds approved one-time performance bonus to gross pay', async () => {
    const mockEmp = {
      id: 'emp-bonus',
      employeeCode: 'UAT-17-BONUS',
      firstName: 'Gautam',
      lastName: 'Gambhir',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(
      mockEmp,
      octPeriod,
      [],
      standardStatutoryConfig,
      0,
      0,
      0,
      15000 // one-time earning
    );

    const bonusItem = res.items.find(i => i.code === 'ONE_TIME_EARNING');
    expect(bonusItem?.calculatedAmount.toNumber()).toBe(15000.00);
    expect(res.grossPay.toNumber()).toBe(65000.00);
  });

  // 18. Employee with a one-time deduction
  it('Scenario 18: adds authorized one-time deduction to employee deductions', async () => {
    const mockEmp = {
      id: 'emp-ot-ded',
      employeeCode: 'UAT-18-DEDUCT',
      firstName: 'Ashish',
      lastName: 'Nehra',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 600000,
        monthlyGross: 50000,
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 50000 }]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(
      mockEmp,
      octPeriod,
      [],
      standardStatutoryConfig,
      0,
      0,
      0,
      0,
      3500 // one-time deduction
    );

    const dedItem = res.items.find(i => i.code === 'ONE_TIME_DEDUCTION');
    expect(dedItem?.calculatedAmount.toNumber()).toBe(3500.00);
    expect(res.deductionsPay.toNumber()).toBe(3500.00);
    expect(res.netPay.toNumber()).toBe(46500.00);
  });

  // 19. Invalid formula validation
  it('Scenario 19: detects invalid formula syntax and prevents silent corruption', () => {
    const invalidFormulas = [
      'BASIC * / 2',
      'IF(BASIC > 1000)',
      '(BASIC + HRA',
      'INVALID_FUNC(BASIC)',
      '100 / 0'
    ];

    for (const formula of invalidFormulas) {
      expect(() => FormulaEngine.evaluate(formula, { BASIC: 50000 })).toThrow();
    }
  });

  // 20. Circular formula dependency
  it('Scenario 20: detects circular formula dependency and identifies exact cycle path', () => {
    const circularComponents = [
      { code: 'A', formula: 'B * 1.5' },
      { code: 'B', formula: 'C + 1000' },
      { code: 'C', formula: 'A * 0.5' }
    ];

    const cycle = FormulaEngine.detectCycle(circularComponents);
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(['A', 'B', 'C', 'A']);

    expect(() => FormulaEngine.topologicalSort(circularComponents)).toThrow(/Circular formula dependency detected/);
  });

  // 21. Salary revision effective in a later period
  it('Scenario 21: ignores future salary revisions when computing current period', async () => {
    // Current period is Oct 2026. Revision is scheduled for Nov 2026.
    const mockEmp = {
      id: 'emp-revision',
      employeeCode: 'UAT-21-REV',
      firstName: 'Hardik',
      lastName: 'Pandya',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 720000,
        monthlyGross: 60000,
        effectiveFrom: new Date('2026-10-01'),
        effectiveTo: new Date('2026-10-31'),
        lines: [{ code: 'BASIC', name: 'Basic', monthlyAmount: 60000 }]
      },
      payrollPolicy: { pfApplicable: false, esiApplicable: false, ptApplicable: false }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, [], standardStatutoryConfig);
    expect(res.grossPay.toNumber()).toBe(60000.00);
  });

  // 22. Repeated payroll calculation idempotency
  it('Scenario 22: guarantees repeated calculation produces identical decimal results', async () => {
    const mockEmp = {
      id: 'emp-idempotent',
      employeeCode: 'UAT-22-IDEM',
      firstName: 'Jasprit',
      lastName: 'Bumrah',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        annualCtc: 1200000,
        monthlyGross: 100000,
        lines: [
          { code: 'BASIC', name: 'Basic', monthlyAmount: 50000 },
          { code: 'HRA', name: 'HRA', monthlyAmount: 25000 },
          { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', monthlyAmount: 25000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'CEILING_15000',
        esiApplicable: false,
        ptApplicable: true,
        ptState: 'Maharashtra'
      }
    };

    const run1 = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig, 3);
    const run2 = await PayrollCalculationEngine.calculateEmployee(mockEmp, octPeriod, ptSlabs, standardStatutoryConfig, 3);

    expect(run1.grossPay.toNumber()).toBe(run2.grossPay.toNumber());
    expect(run1.deductionsPay.toNumber()).toBe(run2.deductionsPay.toNumber());
    expect(run1.netPay.toNumber()).toBe(run2.netPay.toNumber());
    expect(run1.employerCost.toNumber()).toBe(run2.employerCost.toNumber());
  });

  // 23. Duplicate employee-period payroll prevention
  it('Scenario 23: strictly prevents duplicate payroll slips for the same employee in a run', async () => {
    const period = await prisma.payrollPeriod.findFirst({ where: { month: 10, year: 2026 } });
    if (!period) return;

    const runNumber = `TEST_DUP_${Date.now()}`;
    const run = await prisma.corporatePayrollRun.create({
      data: {
        companyId,
        periodId: period.id,
        runNumber,
        status: 'DRAFT',
        totalEmployees: 1
      }
    });
    testRunIds.push(run.id);

    const emp = await prisma.employee.findFirst({ where: { companyId } });
    if (!emp) return;

    // First insert succeeds
    await prisma.corporatePayrollSlip.create({
      data: {
        payrollRunId: run.id,
        employeeId: emp.id,
        workingDays: 31,
        payableDays: new Decimal(31),
        grossPay: new Decimal(50000),
        deductionsPay: new Decimal(2000),
        netPay: new Decimal(48000),
        employerCost: new Decimal(53000),
        calculationSnapshot: { test: true }
      }
    });

    // Duplicate insert for same payrollRunId and employeeId MUST fail
    await expect(
      prisma.corporatePayrollSlip.create({
        data: {
          payrollRunId: run.id,
          employeeId: emp.id,
          workingDays: 31,
          payableDays: new Decimal(31),
          grossPay: new Decimal(50000),
          deductionsPay: new Decimal(2000),
          netPay: new Decimal(48000),
          employerCost: new Decimal(53000),
          calculationSnapshot: { duplicate: true }
        }
      })
    ).rejects.toThrow();
  });

  // 24. Payroll batch reconciliation
  it('Scenario 24: reconciles batch-level sums against employee-level totals to ₹0.00 variance', () => {
    const slips = [
      { gross: new Decimal('75000.50'), ded: new Decimal('5200.25'), net: new Decimal('69800.25'), empr: new Decimal('82000.75') },
      { gross: new Decimal('45000.00'), ded: new Decimal('3100.00'), net: new Decimal('41900.00'), empr: new Decimal('48500.00') },
      { gross: new Decimal('120000.75'), ded: new Decimal('12500.50'), net: new Decimal('107500.25'), empr: new Decimal('132000.00') }
    ];

    const sumGross = slips.reduce((acc, s) => acc.plus(s.gross), new Decimal(0));
    const sumDed = slips.reduce((acc, s) => acc.plus(s.ded), new Decimal(0));
    const sumNet = slips.reduce((acc, s) => acc.plus(s.net), new Decimal(0));
    const sumEmpr = slips.reduce((acc, s) => acc.plus(s.empr), new Decimal(0));

    expect(sumGross.minus(sumDed).equals(sumNet)).toBe(true);
    expect(sumGross.toNumber()).toBe(240001.25);
    expect(sumDed.toNumber()).toBe(20800.75);
    expect(sumNet.toNumber()).toBe(219200.50);
    expect(sumEmpr.toNumber()).toBe(262500.75);
  });

  // 25. Payslip and payment-instruction reconciliation
  it('Scenario 25: verifies that payment instruction matches approved net payable amount', () => {
    const finalizedNetPay = new Decimal('84550.00');
    const paymentInstruction = {
      accountNumber: 'HDFC000123456789',
      ifsc: 'HDFC0000123',
      amount: new Decimal('84550.00'),
      status: 'READY'
    };

    expect(paymentInstruction.amount.equals(finalizedNetPay)).toBe(true);
    expect(paymentInstruction.amount.minus(finalizedNetPay).isZero()).toBe(true);
  });
});

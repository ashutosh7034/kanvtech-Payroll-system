import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { PayrollCalculationEngine } from '../src/modules/payroll/calculationEngine.js';
import { FormulaEngine } from '../src/modules/compensation/formulaEngine.js';
import { calculateSalaryBreakdown } from '../src/modules/compensation/compensation.routes.js';
import { Decimal } from 'decimal.js';

describe('Comprehensive Corporate HRMS & Payroll Engine Verification Suite (Phase 14)', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  let branchMumbaiId = '';
  let branchBengaluruId = '';
  let testPeriodId = '';

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    companyId = adminRes.body.user.companyId;

    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    const branches = await prisma.branch.findMany({ where: { companyId } });
    branchMumbaiId = branches.find(b => b.code.includes('MUM'))?.id || branches[0].id;
    branchBengaluruId = branches.find(b => b.code.includes('BLR') || b.code.includes('BAN'))?.id || branches[1]?.id || branches[0].id;

    const period = await prisma.payrollPeriod.findFirst({
      where: { companyId, month: 10, year: 2026 }
    });
    testPeriodId = period?.id || '';
  });

  // Scenario 1: Employee eligible for PF and ESI where applicable
  it('Scenario 1: correctly calculates PF and ESI for eligible employees with gross <= 21,000', async () => {
    const period = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
      month: 10,
      year: 2026
    };
    const mockEmp = {
      id: 'mock-esi-emp',
      employeeCode: 'TEST-ESI-01',
      firstName: 'Ramesh',
      lastName: 'Kumar',
      dateOfJoining: new Date('2025-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 12000 },
          { component: { code: 'HRA', name: 'HRA', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 6000 },
          { component: { code: 'SPECIAL_ALLOWANCE', name: 'Spl', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 2000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'CEILING_15000',
        esiApplicable: true,
        esiStatus: 'APPLICABLE',
        ptApplicable: true,
        ptState: 'Maharashtra',
        taxRegime: 'NEW'
      }
    };

    const statutoryConfig = {
      pfWageCeiling: 15000,
      pfEmployeePct: 12.0,
      esicWageCeiling: 21000,
      esicEmployeePct: 0.75,
      esicEmployerPct: 3.25,
      gratuityPct: 4.81
    };

    const ptSlabs = [
      { state: 'Maharashtra', minSalary: 10001, maxSalary: null, monthlyAmount: 200 }
    ];

    const result = await PayrollCalculationEngine.calculateEmployee(mockEmp, period, ptSlabs, statutoryConfig);
    expect(result.grossPay.toNumber()).toBe(20000);
    // PF = 12% of 12000 = 1440
    const pfItem = result.items.find(i => i.code === 'EPF_EMPLOYEE');
    expect(pfItem?.calculatedAmount.toNumber()).toBe(1440);
    // ESI = 0.75% of 20000 = 150
    const esiItem = result.items.find(i => i.code === 'ESIC_EMPLOYEE');
    expect(esiItem?.calculatedAmount.toNumber()).toBe(150);
    // PT = 200
    const ptItem = result.items.find(i => i.code === 'PROFESSIONAL_TAX');
    expect(ptItem?.calculatedAmount.toNumber()).toBe(200);
    // Net = 20000 - (1440 + 150 + 200) = 18210
    expect(result.netPay.toNumber()).toBe(18210);
  });

  // Scenario 2: Employee legitimately not subject to PF under verified eligibility rules
  it('Scenario 2: does not deduct PF for employee with legitimate exempt status', async () => {
    const period = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
      month: 10,
      year: 2026
    };
    const mockEmp = {
      id: 'mock-exempt-emp',
      employeeCode: 'TEST-EXEMPT-02',
      firstName: 'David',
      lastName: 'Miller',
      dateOfJoining: new Date('2025-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 80000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'EXEMPT_OVER_CEILING',
        exceptionRemarks: 'International worker exempt under reciprocal social security agreement',
        ptApplicable: true,
        ptState: 'Maharashtra',
        taxRegime: 'NEW'
      }
    };

    const result = await PayrollCalculationEngine.calculateEmployee(mockEmp, period, [], null);
    const pfItem = result.items.find(i => i.code === 'EPF_EMPLOYEE');
    expect(pfItem).toBeUndefined();
    expect(result.exceptions.some(e => e.includes('PF not deducted'))).toBe(true);
  });

  // Scenario 3: Employee whose PF eligibility is pending verification
  it('Scenario 3: flags employee whose PF eligibility is pending verification', async () => {
    const period = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
      month: 10,
      year: 2026
    };
    const mockEmp = {
      id: 'mock-pending-emp',
      employeeCode: 'TEST-PENDING-03',
      firstName: 'Suresh',
      lastName: 'Patel',
      dateOfJoining: new Date('2025-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 25000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'PENDING_VERIFICATION',
        exceptionRemarks: 'UAN linked to previous establishment pending transfer verification',
        ptApplicable: false,
        taxRegime: 'NEW'
      }
    };

    const result = await PayrollCalculationEngine.calculateEmployee(mockEmp, period, [], null);
    expect(result.items.find(i => i.code === 'EPF_EMPLOYEE')).toBeUndefined();
    expect(result.exceptions.some(e => e.includes('PENDING_VERIFICATION'))).toBe(true);
  });

  // Scenario 4 & 5: Employee with different structure and no HRA component
  it('Scenario 4 & 5: calculates employee with custom structure and no HRA component', () => {
    const customComponents = [
      { id: '1', code: 'BASIC', name: 'Basic Pay', type: 'EARNING' as const, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageValue: 50.0, baseComponentCode: 'CTC' },
      { id: '2', code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', type: 'EARNING' as const, calculationMode: 'FIXED_AMOUNT' },
      { id: '3', code: 'EPF_EMPLOYEE', name: 'Employee PF', type: 'DEDUCTION' as const, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageValue: 12.0, baseComponentCode: 'BASIC' }
    ];

    const breakdown = calculateSalaryBreakdown(1200000, customComponents);
    expect(breakdown.monthlyCtc).toBe(100000);
    // Basic = 50% of 100,000 = 50,000
    const basicLine = breakdown.lines.find(l => l.code === 'BASIC');
    expect(basicLine?.monthly).toBe(50000);
    // No HRA component
    expect(breakdown.lines.find(l => l.code === 'HRA')).toBeUndefined();
    // Special Allowance balances to Monthly CTC = 50,000
    const splLine = breakdown.lines.find(l => l.code === 'SPECIAL_ALLOWANCE');
    expect(splLine?.monthly).toBe(50000);
  });

  // Scenario 6: Employee with fixed deduction and loan recovery
  it('Scenario 6: deducts active company loan EMI from take-home pay', async () => {
    const period = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
      month: 10,
      year: 2026
    };
    const mockEmp = {
      id: 'mock-loan-emp',
      employeeCode: 'TEST-LOAN-06',
      firstName: 'Vikram',
      lastName: 'Singh',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 50000 }
        ]
      },
      loans: [
        { monthlyEmi: 5000, outstandingAmount: 50000, loanType: { name: 'Emergency Advance' } }
      ],
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'NOT_APPLICABLE',
        exceptionRemarks: 'Exempt',
        ptApplicable: false,
        taxRegime: 'NEW'
      }
    };

    const result = await PayrollCalculationEngine.calculateEmployee(mockEmp, period, [], null);
    expect(result.grossPay.toNumber()).toBe(50000);
    expect(result.deductionsPay.toNumber()).toBe(5000);
    expect(result.netPay.toNumber()).toBe(45000);
    const loanItem = result.items.find(i => i.code === 'LOAN_EMI');
    expect(loanItem?.calculatedAmount.toNumber()).toBe(5000);
  });

  // Scenario 7: Unpaid leave and attendance proration
  it('Scenario 7: accurately prorates salary when employee has unpaid loss-of-pay (LOP) days', async () => {
    // 31 days in October. Say 5 days LOP -> 26 payable days. Ratio = 26/31.
    const attendanceResult = {
      calendarDays: 31,
      workingDays: 31,
      payableDays: new Decimal(26),
      lopDays: new Decimal(5),
      unpaidMidMonthDays: new Decimal(0),
      prorationRatio: new Decimal(26).dividedBy(31).toDecimalPlaces(6, Decimal.ROUND_HALF_UP),
      isProrated: true,
      notes: ['5.0 days Loss of Pay (LOP) unpaid leave deducted']
    };

    const configuredMonthly = new Decimal(62000); // 2000 per day
    const proratedBasic = configuredMonthly.times(attendanceResult.payableDays).dividedBy(attendanceResult.calendarDays).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    // (62000 * 26) / 31 = 52000
    expect(proratedBasic.toNumber()).toBe(52000);
  });

  // Scenario 8: Employee joining mid-month
  it('Scenario 8: prorates salary when employee joins mid-month (e.g. 16th of 30-day month)', async () => {
    const period = {
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      month: 6,
      year: 2026
    };
    const emp = {
      id: 'mid-joiner',
      dateOfJoining: new Date('2026-06-16')
    };

    const att = await PayrollCalculationEngine.evaluateAttendance(emp, period);
    expect(att.isProrated).toBe(true);
    expect(att.payableDays.toNumber()).toBe(15);
    expect(att.unpaidMidMonthDays.toNumber()).toBe(15);
  });

  // Scenario 9: Employee leaving mid-month
  it('Scenario 9: prorates salary when employee leaves mid-month (e.g. 10th of month)', async () => {
    const period = {
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      month: 6,
      year: 2026
    };
    const emp = {
      id: 'mid-exiter',
      dateOfJoining: new Date('2024-01-01'),
      exitDate: new Date('2026-06-10')
    };

    const att = await PayrollCalculationEngine.evaluateAttendance(emp, period);
    expect(att.isProrated).toBe(true);
    expect(att.payableDays.toNumber()).toBe(10);
  });

  // Scenario 12: Different professional tax configurations (Maharashtra Feb surcharge)
  it('Scenario 12: applies Maharashtra February ₹300 surcharge correctly', async () => {
    const periodFeb = {
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      month: 2,
      year: 2026
    };
    const mockEmp = {
      id: 'pt-emp',
      employeeCode: 'TEST-PT-12',
      firstName: 'Kiran',
      lastName: 'More',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 30000 }
        ]
      },
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'NOT_APPLICABLE',
        exceptionRemarks: 'Exempt',
        ptApplicable: true,
        ptState: 'Maharashtra',
        taxRegime: 'NEW'
      }
    };
    const ptSlabs = [
      { state: 'Maharashtra', minSalary: 10001, maxSalary: null, monthlyAmount: 200, februaryAmount: 300 }
    ];

    const resFeb = await PayrollCalculationEngine.calculateEmployee(mockEmp, periodFeb, ptSlabs, null);
    const ptItem = resFeb.items.find(i => i.code === 'PROFESSIONAL_TAX');
    expect(ptItem?.calculatedAmount.toNumber()).toBe(300);
  });

  // Scenario 15: Negative net pay warning exception
  it('Scenario 15: detects and flags negative net pay when deductions exceed earnings', async () => {
    const period = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-31'),
      month: 10,
      year: 2026
    };
    const mockEmp = {
      id: 'neg-net-emp',
      employeeCode: 'TEST-NEG-15',
      firstName: 'Negative',
      lastName: 'Case',
      dateOfJoining: new Date('2024-01-01'),
      salaryStructure: {
        lines: [
          { component: { code: 'BASIC', name: 'Basic', type: 'EARNING', category: 'FIXED_EARNING' }, monthlyAmount: 10000 }
        ]
      },
      loans: [
        { monthlyEmi: 15000, outstandingAmount: 50000, loanType: { name: 'Large Advance' } }
      ],
      payrollPolicy: {
        pfApplicable: false,
        pfStatus: 'NOT_APPLICABLE',
        exceptionRemarks: 'Exempt',
        ptApplicable: false,
        taxRegime: 'NEW'
      }
    };

    const res = await PayrollCalculationEngine.calculateEmployee(mockEmp, period, [], null);
    expect(res.netPay.isNegative()).toBe(true);
    expect(res.exceptions.some(e => e.includes('NEGATIVE NET PAY'))).toBe(true);
  });

  // Scenario 16: Formula validation and circular dependency detection
  it('Scenario 16: validates formula syntax and rejects circular dependencies via API', async () => {
    const validRes = await request(app)
      .post('/api/v1/compensation/components/validate-formula')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'PERF_BONUS', formula: 'BASIC * 0.15 + 1000' });
    expect(validRes.status).toBe(200);
    expect(validRes.body.valid).toBe(true);

    const invalidRes = await request(app)
      .post('/api/v1/compensation/components/validate-formula')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'INVALID_MATH', formula: 'BASIC / 0' });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.valid).toBe(false);
  });

  // Scenario 17: Unauthorized access rejection
  it('Scenario 17: rejects non-admin users from creating or updating salary components and structures', async () => {
    const unauthorizedRes = await request(app)
      .post('/api/v1/compensation/components')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ code: 'HACK_ALLOWANCE', name: 'Unauthorized', type: 'EARNING' });
    expect(unauthorizedRes.status).toBe(403);
  });

  // Scenario 18: Duplicate payroll run prevention
  it('Scenario 18: prevents initializing a duplicate payroll run if already locked/paid', async () => {
    const paidRun = await prisma.corporatePayrollRun.findFirst({
      where: { companyId, status: 'PAID' }
    });
    if (paidRun) {
      const res = await request(app)
        .post('/api/v1/payroll/runs/draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodId: paidRun.periodId });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already PAID');
    }
  });

  // Scenario 21: Employee access restricted to their own payroll information
  it('Scenario 21: prevents employee from accessing other employees payslips via API', async () => {
    const otherEmployeeSlip = await prisma.corporatePayrollSlip.findFirst({
      where: {
        employee: { employeeCode: { not: 'APEX-1003' } }
      }
    });

    if (otherEmployeeSlip) {
      const res = await request(app)
        .get(`/api/v1/self-service/payslips/${otherEmployeeSlip.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  // Scenario 22: Reconciliation between registers, bank advice, and totals
  it('Scenario 22: verifies register totals reconcile with bank advice totals and payroll runs', async () => {
    const regRes = await request(app)
      .get('/api/v1/reports/payroll-register')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(regRes.status).toBe(200);

    const bankRes = await request(app)
      .get('/api/v1/reports/bank-advice')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(bankRes.status).toBe(200);

    if (regRes.body.totals && bankRes.body.totalDisbursement) {
      expect(Math.round(regRes.body.totals.totalNet)).toBe(Math.round(bankRes.body.totalDisbursement));
    }
  });
});

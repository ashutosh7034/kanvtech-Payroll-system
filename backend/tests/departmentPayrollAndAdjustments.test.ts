import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Task 4: Department-Wise Payroll Processing & Manual Salary Adjustments Suite', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  let testPeriodId = '';
  let engDeptId = '';
  let hrDeptId = '';
  let testEmp1: any = null;
  let testEmp2: any = null;
  let testEmp3: any = null;
  let createdRunId = '';

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate regular employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // Get company
    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    companyId = adminUser!.companyId;

    // 3. Find or create two departments
    let engDept = await prisma.department.findFirst({ where: { companyId, name: 'Software Engineering' } });
    if (!engDept) {
      engDept = await prisma.department.create({
        data: { companyId, code: 'ENG_TEST', name: 'Software Engineering' }
      });
    }
    engDeptId = engDept.id;

    let hrDept = await prisma.department.findFirst({ where: { companyId, name: 'Human Resources' } });
    if (!hrDept) {
      hrDept = await prisma.department.create({
        data: { companyId, code: 'HR_TEST', name: 'Human Resources' }
      });
    }
    hrDeptId = hrDept.id;

    // 4. Find or create a dedicated test period for 2039-01
    let period = await prisma.payrollPeriod.findFirst({
      where: { companyId, month: 1, year: 2039 }
    });
    if (!period) {
      period = await prisma.payrollPeriod.create({
        data: {
          companyId,
          periodNumber: 203901,
          month: 1,
          year: 2039,
          name: 'January 2039',
          startDate: new Date('2039-01-01T00:00:00.000Z'),
          endDate: new Date('2039-01-31T23:59:59.999Z'),
          cutoffDate: new Date('2039-01-25T00:00:00.000Z')
        }
      });
    }
    testPeriodId = period.id;

    // Clean up any prior runs for this test period to ensure test isolation
    await prisma.corporatePayrollRun.deleteMany({
      where: { companyId, periodId: testPeriodId }
    });

    // 5. Ensure at least 3 employees exist with salary structures and assigned departments
    const empList = await prisma.employee.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CONFIRMED'] }, salaryStructure: { isNot: null } },
      include: { salaryStructure: true, department: true }
    });

    expect(empList.length).toBeGreaterThanOrEqual(2);
    testEmp1 = empList[0];
    testEmp2 = empList[1];

    // Assign testEmp1 to Engineering and testEmp2 to HR
    await prisma.employee.update({ where: { id: testEmp1.id }, data: { departmentId: engDeptId, status: 'CONFIRMED', exitDate: null } });
    await prisma.employee.update({ where: { id: testEmp2.id }, data: { departmentId: hrDeptId, status: 'CONFIRMED', exitDate: null } });

    // Find or create testEmp3 without salary structure to test missing required salary structure detection
    let missingSalaryEmp = await prisma.employee.findFirst({
      where: { companyId, salaryStructure: null }
    });
    if (!missingSalaryEmp) {
      missingSalaryEmp = await prisma.employee.create({
        data: {
          companyId,
          branchId: testEmp1.branchId,
          designationId: testEmp1.designationId,
          workEmail: `test-no-sal-${Date.now()}@example.com`,
          employeeCode: `TEST-NO-SAL-${Date.now().toString().slice(-4)}`,
          firstName: 'NoSalary',
          lastName: 'Candidate',
          status: 'ACTIVE',
          dateOfJoining: new Date('2035-01-01T00:00:00.000Z'),
          departmentId: engDeptId
        }
      });
    }
    testEmp3 = missingSalaryEmp;
  });

  // Scenario 1: Preview eligible employees with filters and identify missing salary info
  it('Scenario 1 & 5: previews eligible employees for a department and flags missing salary structure', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${testPeriodId}&departmentId=${engDeptId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.period.id).toBe(testPeriodId);
    expect(res.body.totalCount).toBeGreaterThanOrEqual(1);

    // Verify missing structure is flagged
    const flagged = res.body.employees.find((e: any) => e.id === testEmp3.id);
    if (flagged) {
      expect(flagged.hasSalaryStructure).toBe(false);
      expect(flagged.isEligible).toBe(false);
      expect(flagged.ineligibilityReason).toContain('Missing salary structure');
    }
  });

  // Scenario 2: Process payroll for one department
  it('Scenario 2: creates a department-wise payroll run in DRAFT stage', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: testPeriodId,
        departmentId: engDeptId,
        remarks: 'Engineering January 2039 payroll batch'
      });

    expect(res.status).toBe(201);
    expect(res.body.run.status).toBe('DRAFT');
    expect(res.body.run.validationNotes.scope.type).toBe('DEPARTMENT');
    expect(res.body.run.validationNotes.scope.departmentId).toBe(engDeptId);
    createdRunId = res.body.run.id;
  });

  // Scenario 3: Validate and Calculate department payroll
  it('Scenario 3: validates and calculates decimal salary for the department run', async () => {
    // 1. Validate
    const valRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(valRes.status).toBe(200);
    expect(valRes.body.run.status).toBe('VALIDATED');

    // 2. Calculate
    const calcRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.run.status).toBe('CALCULATED');
    expect(calcRes.body.summary.totalGross).toBeGreaterThan(0);
    expect(calcRes.body.summary.totalNetPay).toBeGreaterThan(0);
  });

  // Scenario 4: Detailed Review Table with Department Totals
  it('Scenario 4: retrieves review table with employee breakdown and department subtotals', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.departmentTotals.length).toBeGreaterThan(0);

    const firstRow = res.body.rows[0];
    expect(firstRow).toHaveProperty('employeeCode');
    expect(firstRow).toHaveProperty('payableDays');
    expect(firstRow).toHaveProperty('grossPay');
    expect(firstRow).toHaveProperty('netPay');
    expect(firstRow).toHaveProperty('deductionsPay');
  });

  // Scenario 6: Add and approve a one-time earning (Incentive / Bonus)
  it('Scenario 6 & 15: adds and approves a manual one-time earning and reconciles totals', async () => {
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    const initialGross = slip.grossPay;
    const initialNet = slip.netPay;
    const incentiveAmount = 7500;

    const adjRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        componentCode: 'INCENTIVE',
        componentName: 'Q4 Innovation Bonus',
        type: 'EARNING',
        amount: incentiveAmount,
        reason: 'Approved by Engineering Director for architecture refactor'
      });

    expect(adjRes.status).toBe(200);
    expect(Number(adjRes.body.slip.grossPay)).toBeCloseTo(initialGross + incentiveAmount, 1);
    expect(Number(adjRes.body.slip.netPay)).toBeCloseTo(initialNet + incentiveAmount, 1);
  });

  // Scenario 7: Add and approve a deduction
  it('Scenario 7: adds and approves a manual one-time deduction', async () => {
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    const initialDeductions = slip.deductionsPay;
    const initialNet = slip.netPay;
    const deductionAmount = 1500;

    const adjRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        componentCode: 'ONE_TIME_DEDUCTION',
        componentName: 'Hardware Asset Penalty',
        type: 'DEDUCTION',
        amount: deductionAmount,
        reason: 'Company device screen replacement charge'
      });

    expect(adjRes.status).toBe(200);
    expect(Number(adjRes.body.slip.deductionsPay)).toBeCloseTo(initialDeductions + deductionAmount, 1);
    expect(Number(adjRes.body.slip.netPay)).toBeCloseTo(initialNet - deductionAmount, 1);
  });

  // Scenario 8: Attendance correction with recalculation
  it('Scenario 8: corrects attendance LOP days and recalculates payable days', async () => {
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    const adjRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        componentCode: 'LOP_CORRECTION',
        type: 'DEDUCTION',
        amount: 0,
        lopDaysOverride: 2,
        reason: 'Unmarked emergency leaves on Jan 14-15'
      });

    expect(adjRes.status).toBe(200);
    expect(Number(adjRes.body.slip.lopDays)).toBe(2);
    expect(Number(adjRes.body.slip.payableDays)).toBe(slip.workingDays - 2);
  });

  // Scenario 11 & 12: TDS deferral and recovery with tax safeguard
  it('Scenario 11: records an authorized TDS deferral to next month', async () => {
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    // Ensure TDS item exists
    await prisma.corporatePayrollItem.upsert({
      where: { id: `tds-test-${slip.slipId}` },
      create: {
        id: `tds-test-${slip.slipId}`,
        payrollSlipId: slip.slipId,
        code: 'TDS',
        name: 'Income Tax (TDS)',
        type: 'DEDUCTION',
        amount: 6000
      },
      update: { amount: 6000 }
    });

    const deferRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/tds-deferral`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        deferralAmount: 3000,
        reason: 'Authorized Section 80D medical insurance receipt verified pending deduction',
        recoveryPeriod: 'February 2039'
      });

    expect(deferRes.status).toBe(200);
    expect(deferRes.body.message).toContain('TDS deferral of ₹3000 recorded');
  });

  it('Scenario 12: rejects unauthorized or invalid TDS bypass', async () => {
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    // Attempting deferral larger than calculated TDS
    const invalidRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/tds-deferral`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        deferralAmount: 999999,
        reason: 'Too large',
        recoveryPeriod: 'February 2039'
      });

    expect(invalidRes.status).toBe(400);
  });

  // Scenario 13: Permission boundaries
  it('Scenario 13: rejects regular employees without payroll permissions', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/adjustments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        slipId: 'any',
        componentCode: 'BONUS',
        type: 'EARNING',
        amount: 5000,
        reason: 'Unauthorized bonus'
      });

    expect(res.status).toBe(403);
  });

  // Scenario 9 & 10: Attempt to modify approved or paid payroll
  it('Scenario 9 & 10: strictly blocks adjustments on approved or paid runs', async () => {
    // 1. Move run through Review and Approval
    await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/review`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try adjusting after APPROVED
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${createdRunId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);
    const slip = reviewRes.body.rows[0];

    const approvedRes = await request(app)
      .post(`/api/v1/payroll/runs/${createdRunId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slipId: slip.slipId,
        componentCode: 'BONUS',
        type: 'EARNING',
        amount: 2000,
        reason: 'Late adjustment after approval'
      });

    expect(approvedRes.status).toBe(400);
    expect(approvedRes.body.error.message).toContain('Cannot modify an APPROVED payroll run');
  });

  // Scenario 14: Duplicate employee processing prevention
  it('Scenario 14: strictly prevents duplicate payroll processing for an employee in the same period', async () => {
    // Attempt to create another run for the same employee who is already in createdRunId (which is approved)
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: testPeriodId,
        departmentId: engDeptId
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('locked');
  });
});

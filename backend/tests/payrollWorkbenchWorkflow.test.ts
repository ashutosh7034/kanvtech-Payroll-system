import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('PAYFLOW Task 8: 7-Stage Payroll Workbench & Salary Editor Suite', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  let testPeriodId = '';
  let testDeptId = '';
  let testEmployee: any = null;
  let testEmployeeHighDed: any = null;
  let runId = '';

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

    // 3. Create or find department
    let dept = await prisma.department.findFirst({ where: { companyId, name: 'Workbench Ops Test' } });
    if (!dept) {
      dept = await prisma.department.create({
        data: { companyId, code: 'WBOPS_TEST', name: 'Workbench Ops Test' }
      });
    }
    testDeptId = dept.id;

    // 4. Create or find test period for 2040-02 (29 days in leap year)
    let period = await prisma.payrollPeriod.findFirst({
      where: { companyId, month: 2, year: 2040 }
    });
    if (!period) {
      period = await prisma.payrollPeriod.create({
        data: {
          companyId,
          periodNumber: 204002,
          month: 2,
          year: 2040,
          name: 'February 2040 (Leap Year Test)',
          startDate: new Date('2040-02-01T00:00:00.000Z'),
          endDate: new Date('2040-02-29T23:59:59.999Z'),
          cutoffDate: new Date('2040-02-25T00:00:00.000Z')
        }
      });
    }
    testPeriodId = period.id;

    // 5. Clean up any existing runs for this period
    await prisma.corporatePayrollRun.deleteMany({
      where: { periodId: testPeriodId }
    });

    // 6. Select 2 existing active employees with salary structure and assign to test department
    const empList = await prisma.employee.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CONFIRMED'] }, salaryStructure: { isNot: null } },
      include: { salaryStructure: true, department: true }
    });
    expect(empList.length).toBeGreaterThanOrEqual(2);

    testEmployee = empList[0];
    testEmployeeHighDed = empList[1];

    await prisma.employee.update({
      where: { id: testEmployee.id },
      data: { departmentId: testDeptId, status: 'ACTIVE', exitDate: null }
    });
    await prisma.employee.update({
      where: { id: testEmployeeHighDed.id },
      data: { departmentId: testDeptId, status: 'ACTIVE', exitDate: null }
    });
  });

  it('1. Initializes a department-scoped payroll run in Stage 1 DRAFT', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: testPeriodId,
        name: 'Workbench Feb 2040 Run',
        runType: 'REGULAR',
        scope: {
          type: 'DEPARTMENT',
          departmentId: testDeptId,
          targetCount: 2
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.run).toBeDefined();
    expect(res.body.run.status).toBe('DRAFT');
    expect(res.body.run.periodId).toBe(testPeriodId);
    runId = res.body.run.id;
  });

  it('2. Pre-calculation Editor: returns candidate preview rows when run.slips is empty', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/editor`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Backward compatibility: both rows and employees keys exist
    expect(res.body.rows).toBeDefined();
    expect(res.body.employees).toBeDefined();
    expect(res.body.rows.length).toBeGreaterThanOrEqual(2);

    const empRow = res.body.rows.find((r: any) => r.staffCode === testEmployee.employeeCode);
    expect(empRow).toBeDefined();
    expect(empRow.employeeName).toContain(testEmployee.firstName);
    expect(empRow.department).toBe('Workbench Ops Test');
    expect(empRow.totalWorkingDays).toBe(30); // 30-day corporate payroll basis
    expect(empRow.payableDays).toBe(30);
    expect(empRow.lopDays).toBe(0);
    expect(empRow.hasStructure).toBe(true);
    expect(empRow.calculationStatus).toBe('DRAFT');
    expect(empRow.isNetLessThan25Percent).toBe(false);
  });

  it('3. Pre-calculation Editor: saves draft adjustments into run.validationNotes', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adjustments: [
          {
            employeeId: testEmployee.id,
            lopDays: 2,
            otHours: 10,
            arrears: 5000,
            variablePay: 7500,
            manualDeduction: 1000
          },
          {
            employeeId: testEmployeeHighDed.id,
            lopDays: 0,
            otHours: 0,
            arrears: 0,
            variablePay: 0,
            manualDeduction: 75000 // Huge deduction to trigger <25% net pay warning
          }
        ]
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.count).toBe(2);

    // Verify stored draft adjustments in editor view
    const editorRes = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/editor`)
      .set('Authorization', `Bearer ${adminToken}`);

    const empRow = editorRes.body.rows.find((r: any) => r.staffCode === testEmployee.employeeCode);
    expect(empRow.lopDays).toBe(2);
    expect(empRow.otHours).toBe(10);
    expect(empRow.arrears).toBe(5000);
    expect(empRow.variablePay).toBe(7500);
    expect(empRow.manualDeduction).toBe(1000);
  });

  it('4. Advances to Stage 2 VALIDATE and runs pre-flight validation', async () => {
    const valRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(valRes.status).toBe(200);
    expect(valRes.body.run).toBeDefined();
    expect(valRes.body.run.status).toBe('VALIDATED');
  });

  it('5. Executes Stage 3 CALCULATE and absorbs draft adjustments', async () => {
    const calcRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.run).toBeDefined();
    expect(calcRes.body.run.status).toBe('CALCULATED');

    // Verify slips generated
    const slips = await prisma.corporatePayrollSlip.findMany({
      where: { payrollRunId: runId }
    });
    expect(slips.length).toBeGreaterThanOrEqual(2);

    // Verify testEmployee's slip received the draft adjustments
    const empSlip = slips.find(s => s.employeeId === testEmployee.id);
    expect(empSlip).toBeDefined();
    expect(Number(empSlip!.lopDays)).toBe(2);
    expect(Number(empSlip!.payableDays)).toBe(28); // 30 - 2 LOP
    expect(Number(empSlip!.arrearsAmount)).toBe(5000);
    expect(Number(empSlip!.variableEarnings)).toBe(7500);

    // Verify items generated
    const items = await prisma.corporatePayrollItem.findMany({
      where: { payrollSlipId: empSlip!.id }
    });
    const arrearsItem = items.find(i => i.code === 'ARREARS');
    const varItem = items.find(i => i.code === 'VARIABLE_PAY' || i.code === 'ONE_TIME_EARNING');
    const manDedItem = items.find(i => i.code === 'MANUAL_DED' || i.code === 'ONE_TIME_DEDUCTION');
    expect(arrearsItem).toBeDefined();
    expect(varItem).toBeDefined();
    expect(manDedItem).toBeDefined();
  });

  it('6. Post-calculation Editor: returns calculated values and flags net pay < 25%', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/editor`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(2);

    const empRow = res.body.rows.find((r: any) => r.staffCode === testEmployee.employeeCode);
    expect(empRow).toBeDefined();
    expect(empRow.calculationStatus).toBe('CALCULATED');
    expect(empRow.grossSalary).toBeGreaterThan(0);
    expect(empRow.netSalary).toBeGreaterThan(0);
    expect(empRow.slipId).toBeDefined();
    expect(empRow.isNetLessThan25Percent).toBe(false);

    // Verify high deduction employee has isNetLessThan25Percent = true
    const highDedRow = res.body.rows.find((r: any) => r.staffCode === testEmployeeHighDed.employeeCode);
    expect(highDedRow).toBeDefined();
    expect(highDedRow.validationErrors.some((e: string) => e.includes('Take-home net pay is less than 25%'))).toBe(true);
  });

  it('7. Post-calculation Adjustment: modifies values and updates slip/run totals via slipId/employeeId', async () => {
    const editorRes = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/editor`)
      .set('Authorization', `Bearer ${adminToken}`);
    const empRow = editorRes.body.rows.find((r: any) => r.staffCode === testEmployee.employeeCode);
    expect(empRow).toBeDefined();

    // Modify overtime hours and variable pay post-calc
    const patchRes = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adjustments: [
          {
            slipId: empRow.slipId,
            employeeId: empRow.employeeId,
            lopDays: 1, // Reduced LOP
            otHours: 15,
            arrears: 6000,
            variablePay: 10000,
            manualDeduction: 500
          }
        ]
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);

    // Verify slip was updated in DB
    const updatedSlip = await prisma.corporatePayrollSlip.findUnique({
      where: { id: empRow.slipId }
    });
    expect(Number(updatedSlip!.lopDays)).toBe(1);
    expect(Number(updatedSlip!.payableDays)).toBe(29); // 30 - 1 LOP
    expect(Number(updatedSlip!.arrearsAmount)).toBe(6000);
    expect(Number(updatedSlip!.variableEarnings)).toBe(10000);

    // Verify audit record logged in calculationSnapshot
    const snapshot: any = updatedSlip!.calculationSnapshot;
    expect(snapshot.adjustments).toBeDefined();
    expect(snapshot.adjustments.length).toBeGreaterThan(0);
  });

  it('8. Advances through Stages 4 to 7: REVIEW -> APPROVE -> PAYMENT_READY -> PAID', async () => {
    // Stage 4: REVIEW
    const reviewRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNotes: 'Verified all employee salaries and adjustments.' });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.run.status).toBe('REVIEWED');

    // Stage 5: APPROVE
    const approveRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.run.status).toBe('APPROVED');
    expect(approveRes.body.run.approvedBy).toBeDefined();

    // Stage 6: PAYMENT_READY
    const readyRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/payment-ready`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.run.status).toBe('PAYMENT_READY');

    // Stage 7: PAID
    const payRes = await request(app)
      .post(`/api/v1/payroll/runs/${runId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentReference: 'NEFT-2040-02-EXEC-001' });
    expect(payRes.status).toBe(200);
    expect(payRes.body.run.status).toBe('PAID');
  });

  it('9. Security & Immutability: Prevents adjustments to PAID payroll runs', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adjustments: [
          {
            employeeId: testEmployee.id,
            lopDays: 5
          }
        ]
      });

    // Should be rejected because run is already PAID
    expect(patchRes.status).toBe(400);
    const errText = patchRes.body.error?.message || patchRes.body.error || patchRes.body.message || '';
    expect(errText).toContain('Cannot modify adjustments');
  });

  it('10. RBAC: Unauthorized regular employee cannot access or edit payroll workbench', async () => {
    const getRes = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/editor`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/v1/payroll/runs/${runId}/adjustments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ adjustments: [] });
    expect(patchRes.status).toBe(403);
  });
});

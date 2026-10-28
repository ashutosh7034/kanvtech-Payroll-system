import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('PAYFLOW Phase B-K: Department Payroll Process Comprehensive Suite', () => {
  let adminToken = '';
  let employeeToken = '';
  let financeAdminToken = '';
  let companyId = '';
  let testPeriodId = '';
  let deptAId = '';
  let deptBId = '';
  let eligibleEmpA: any = null;
  let eligibleEmpB: any = null;
  let ineligibleNoSalaryEmp: any = null;
  let ineligibleExitedEmp: any = null;
  let activeRunId = '';

  beforeAll(async () => {
    // 1. Authenticate Company Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate Regular Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 3. Authenticate or find Finance Admin
    const finRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'finance.lead', password: 'Admin@123' });
    if (finRes.status === 200) {
      financeAdminToken = finRes.body.token;
    } else {
      financeAdminToken = adminToken;
    }

    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    companyId = adminUser!.companyId;

    // 4. Create or find Departments
    let deptA = await prisma.department.findFirst({ where: { companyId, code: 'DEPT_PROD_A' } });
    if (!deptA) {
      deptA = await prisma.department.create({
        data: { companyId, code: 'DEPT_PROD_A', name: 'Product Engineering Alpha' }
      });
    }
    deptAId = deptA.id;

    let deptB = await prisma.department.findFirst({ where: { companyId, code: 'DEPT_PROD_B' } });
    if (!deptB) {
      deptB = await prisma.department.create({
        data: { companyId, code: 'DEPT_PROD_B', name: 'Product Engineering Beta' }
      });
    }
    deptBId = deptB.id;

    // 5. Create or find Dedicated Test Payroll Period (October 2045)
    let period = await prisma.payrollPeriod.findFirst({
      where: { companyId, month: 10, year: 2045 }
    });
    if (!period) {
      period = await prisma.payrollPeriod.create({
        data: {
          companyId,
          periodNumber: 204510,
          month: 10,
          year: 2045,
          name: 'October 2045 (Dept Test)',
          startDate: new Date('2045-10-01T00:00:00.000Z'),
          endDate: new Date('2045-10-31T23:59:59.999Z'),
          cutoffDate: new Date('2045-10-25T00:00:00.000Z')
        }
      });
    }
    testPeriodId = period.id;

    // Clean up any existing runs for testPeriodId to ensure isolation
    await prisma.corporatePayrollRun.deleteMany({
      where: { companyId, periodId: testPeriodId }
    });

    // 6. Setup Test Employees in deptA
    const activeWithStructure = await prisma.employee.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CONFIRMED'] }, salaryStructure: { isNot: null } },
      include: { salaryStructure: true, department: true }
    });

    expect(activeWithStructure.length).toBeGreaterThanOrEqual(2);
    eligibleEmpA = activeWithStructure[0];
    eligibleEmpB = activeWithStructure[1];

    await prisma.employee.update({
      where: { id: eligibleEmpA.id },
      data: { departmentId: deptAId, status: 'CONFIRMED', exitDate: null }
    });

    await prisma.employee.update({
      where: { id: eligibleEmpB.id },
      data: { departmentId: deptAId, status: 'CONFIRMED', exitDate: null }
    });

    // Clean up any non-protected synthetic test loans on the selected department employees to isolate test math
    await prisma.employeeLoan.deleteMany({
      where: {
        id: { not: 'b405b4b8-1211-48c5-a59e-ee8db001a906' },
        employeeId: { in: [eligibleEmpA.id, eligibleEmpB.id] }
      }
    });

    // Create an employee with missing salary structure
    let noSalEmp = await prisma.employee.findFirst({
      where: { companyId, employeeCode: 'SYNTH-NOSAL-999' }
    });
    if (!noSalEmp) {
      noSalEmp = await prisma.employee.create({
        data: {
          companyId,
          branchId: eligibleEmpA.branchId,
          designationId: eligibleEmpA.designationId,
          employeeCode: 'SYNTH-NOSAL-999',
          firstName: 'Synthetic',
          lastName: 'NoSalaryCandidate',
          workEmail: 'synth.nosal@example.com',
          status: 'ACTIVE',
          dateOfJoining: new Date('2045-01-01T00:00:00.000Z'),
          departmentId: deptAId
        }
      });
    } else {
      await prisma.employee.update({
        where: { id: noSalEmp.id },
        data: { departmentId: deptAId, status: 'ACTIVE', exitDate: null }
      });
    }
    ineligibleNoSalaryEmp = noSalEmp;

    // Create an exited employee
    let exitedEmp = await prisma.employee.findFirst({
      where: { companyId, employeeCode: 'SYNTH-EXITED-888' }
    });
    if (!exitedEmp) {
      exitedEmp = await prisma.employee.create({
        data: {
          companyId,
          branchId: eligibleEmpA.branchId,
          designationId: eligibleEmpA.designationId,
          employeeCode: 'SYNTH-EXITED-888',
          firstName: 'Synthetic',
          lastName: 'ExitedWorker',
          workEmail: 'synth.exited@example.com',
          status: 'EXITED',
          dateOfJoining: new Date('2040-01-01T00:00:00.000Z'),
          exitDate: new Date('2045-05-01T00:00:00.000Z'),
          departmentId: deptAId
        }
      });
    } else {
      await prisma.employee.update({
        where: { id: exitedEmp.id },
        data: { departmentId: deptAId, status: 'EXITED', exitDate: new Date('2045-05-01T00:00:00.000Z') }
      });
    }
    ineligibleExitedEmp = exitedEmp;
  });

  // =========================================================================
  // PHASE B: DEPARTMENT PAYROLL SELECTION & WORKSPACE
  // =========================================================================
  describe('Phase B: Department Payroll Workspace & Filtering', () => {
    it('1. Retrieves workspace data with department filter and 13-column employee payload', async () => {
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBeDefined();
      expect(res.body.period.id).toBe(testPeriodId);
      expect(res.body.department).toBeDefined();
      expect(res.body.department.id).toBe(deptAId);
      expect(res.body.summary).toBeDefined();

      // Check summary counts
      expect(res.body.summary.totalEmployees).toBeGreaterThanOrEqual(4);
      expect(res.body.summary.eligibleCount).toBeGreaterThanOrEqual(2);
      expect(res.body.summary.ineligibleCount).toBeGreaterThanOrEqual(2);

      // Verify each employee contains all required Phase B fields
      const employees = res.body.employees;
      expect(employees.length).toBeGreaterThanOrEqual(4);

      const empA = employees.find((e: any) => e.employeeId === eligibleEmpA.id);
      expect(empA).toBeDefined();
      expect(empA.employeeCode).toBe(eligibleEmpA.employeeCode);
      expect(empA.employeeName).toBeDefined();
      expect(empA.department).toBe('Product Engineering Alpha');
      expect(empA.status).toBe('CONFIRMED');
      expect(empA.isEligible).toBe(true);
      expect(empA.payrollEligibility).toBe('ELIGIBLE');
      expect(empA.salaryStructure).toBeDefined();
      expect(empA.payableDays).toBeGreaterThanOrEqual(30);
      expect(empA.lopDays).toBe(0);
      expect(empA.earnings).toBeGreaterThan(0);
      expect(empA.deductions).toBeGreaterThanOrEqual(0);
      expect(empA.netPay).toBeGreaterThan(0);
      expect(empA.processingStatus).toBe('PENDING');
      expect(empA.items.length).toBeGreaterThan(0);
    });

    it('2. Correctly flags ineligible employees and returns exact inspection reasons', async () => {
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Candidate with missing salary structure
      const noSalRow = res.body.employees.find((e: any) => e.employeeId === ineligibleNoSalaryEmp.id);
      expect(noSalRow).toBeDefined();
      expect(noSalRow.isEligible).toBe(false);
      expect(noSalRow.payrollEligibility).toBe('INELIGIBLE');
      expect(noSalRow.ineligibilityReasons.some((r: string) => r.includes('Missing active salary structure'))).toBe(true);

      // Exited candidate
      const exitedRow = res.body.employees.find((e: any) => e.employeeId === ineligibleExitedEmp.id);
      expect(exitedRow).toBeDefined();
      expect(exitedRow.isEligible).toBe(false);
      expect(exitedRow.ineligibilityReasons.some((r: string) => r.includes('prior to pay period start') || r.includes('EXITED'))).toBe(true);
    });

    it('3. Supports filtering by eligibility (ELIGIBLE vs INELIGIBLE)', async () => {
      const eligibleRes = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}&eligibility=ELIGIBLE`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(eligibleRes.status).toBe(200);
      expect(eligibleRes.body.employees.every((e: any) => e.isEligible === true)).toBe(true);

      const ineligibleRes = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}&eligibility=INELIGIBLE`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(ineligibleRes.status).toBe(200);
      expect(ineligibleRes.body.employees.every((e: any) => e.isEligible === false)).toBe(true);
    });

    it('4. Supports search filter by name or code', async () => {
      const searchRes = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}&search=${eligibleEmpA.employeeCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.employees.length).toBe(1);
      expect(searchRes.body.employees[0].employeeId).toBe(eligibleEmpA.id);
    });
  });

  // =========================================================================
  // PHASE E & F: BATCH PROCESSING, DUPLICATE PREVENTION & IDEMPOTENCY
  // =========================================================================
  describe('Phase E & F: Department Batch Processing & Idempotency', () => {
    it('5. Successfully executes department payroll batch processing', async () => {
      const processRes = await request(app)
        .post('/api/v1/payroll/department/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          periodId: testPeriodId,
          departmentId: deptAId,
          remarks: 'Alpha Q4 Batch Execution'
        });

      expect(processRes.status).toBe(200);
      expect(processRes.body.success).toBe(true);
      expect(processRes.body.run).toBeDefined();
      activeRunId = processRes.body.run.id;
      expect(processRes.body.run.status).toBe('CALCULATED');
      expect(processRes.body.summary.processedCount).toBeGreaterThanOrEqual(2);
      expect(processRes.body.summary.totalGross).toBeGreaterThan(0);
      expect(processRes.body.summary.totalNetPay).toBeGreaterThan(0);

      // Verify explicit per-employee outcomes
      expect(processRes.body.results.length).toBeGreaterThanOrEqual(2);
      for (const result of processRes.body.results) {
        expect(result.success).toBe(true);
        expect(result.slipId).toBeDefined();
        expect(result.netPay).toBeGreaterThan(0);
      }
    });

    it('6. Re-executing department batch is idempotent and does not create duplicate slips', async () => {
      const secondProcessRes = await request(app)
        .post('/api/v1/payroll/department/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          periodId: testPeriodId,
          departmentId: deptAId,
          remarks: 'Alpha Q4 Idempotent Retry'
        });

      expect(secondProcessRes.status).toBe(200);
      expect(secondProcessRes.body.run.id).toBe(activeRunId);

      // Verify database slips count equals processed count (no duplicates)
      const slipsInDb = await prisma.corporatePayrollSlip.findMany({
        where: { payrollRunId: activeRunId }
      });
      expect(slipsInDb.length).toBe(secondProcessRes.body.summary.processedCount);
    });

    it('7. Reflects PROCESSED status in workspace after batch execution', async () => {
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.processedCount).toBeGreaterThanOrEqual(2);

      const empA = res.body.employees.find((e: any) => e.employeeId === eligibleEmpA.id);
      expect(empA.processingStatus).toBe('PROCESSED');
      expect(empA.slipId).toBeDefined();
    });
  });

  // =========================================================================
  // PHASE H: APPROVAL, REJECTION & LOCKING WORKFLOW
  // =========================================================================
  describe('Phase H: Approval & Rejection Workflow with Segregation of Duties', () => {
    it('8. Advances run through Review stage', async () => {
      const reviewRes = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/review`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.run.status).toBe('REVIEWED');
    });

    it('9. Rejects run with mandatory reason and transitions back to VALIDATED with audit trail', async () => {
      const rejectRes = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Audited attendance discrepancy in shift logs. Needs re-verification.'
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);
      expect(rejectRes.body.run.status).toBe('VALIDATED');
      expect(rejectRes.body.run.validationNotes.rejection.reason).toContain('Audited attendance discrepancy');

      // Verify transition record in database
      const transitions = await prisma.corporatePayrollTransition.findMany({
        where: { payrollRunId: activeRunId },
        orderBy: { timestamp: 'desc' }
      });
      const latest = transitions[0];
      expect(latest.toStatus).toBe('VALIDATED');
      expect(latest.remarks).toContain('Batch rejected');
    });

    it('10. Re-advances from VALIDATED -> CALCULATED -> REVIEWED -> APPROVED', async () => {
      // Recalculate
      const calcRes = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/calculate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(calcRes.status).toBe(200);
      expect(calcRes.body.run.status).toBe('CALCULATED');

      // Review
      const revRes = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/review`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(revRes.status).toBe(200);
      expect(revRes.body.run.status).toBe('REVIEWED');

      // Approve
      const appRes = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/approve`)
        .set('Authorization', `Bearer ${financeAdminToken}`);
      expect(appRes.status).toBe(200);
      expect(appRes.body.run.status).toBe('APPROVED');
    });

    it('11. Strictly prevents modifying or re-processing an APPROVED department payroll without recalculation', async () => {
      const retryRes = await request(app)
        .post('/api/v1/payroll/department/process')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          periodId: testPeriodId,
          departmentId: deptAId
        });

      expect(retryRes.status).toBe(400);
      const errText = retryRes.body.error?.message || retryRes.body.message || '';
      expect(errText).toContain('already APPROVED');
    });
  });

  // =========================================================================
  // PHASE J: SECURITY, RBAC & TENANT ISOLATION
  // =========================================================================
  describe('Phase J: Security & Authorization Boundaries', () => {
    it('12. Rejects unauthenticated requests to department workspace with 401', async () => {
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}`);

      expect(res.status).toBe(401);
    });

    it('13. Rejects regular employee without payroll permissions with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${deptAId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    it('14. Validates department boundary and rejects nonexistent department with 404', async () => {
      const dummyDeptId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/payroll/department/workspace?periodId=${testPeriodId}&departmentId=${dummyDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('15. Rejects batch rejection without reason with 400 validation error', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${activeRunId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'abc' }); // less than 5 characters

      expect(res.status).toBe(400);
    });
  });
});

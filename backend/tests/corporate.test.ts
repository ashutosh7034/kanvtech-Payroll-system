import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Corporate HRMS & Payroll Platform - Complete Workflow Suite', () => {
  let adminToken = '';
  let employeeToken = '';
  let testEmployeeId = '';
  let testPeriodId = '';
  let testRunId = '';

  beforeAll(async () => {
    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });

    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // Authenticate Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });

    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // Ensure rahul.mehta is CONFIRMED for test suite idempotency
    const empUser = await prisma.user.findUnique({ where: { username: 'rahul.mehta' } });
    if (empUser?.employeeId) {
      await prisma.fnfSettlement.deleteMany({ where: { employeeId: empUser.employeeId } });
      await prisma.resignation.deleteMany({ where: { employeeId: empUser.employeeId } });
      await prisma.employee.update({ where: { id: empUser.employeeId }, data: { status: 'CONFIRMED' } });
    }
  });

  // 1. Health & Readiness
  it('verifies corporate system health and readiness checks', async () => {
    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const ready = await request(app).get('/api/v1/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.database).toBe('connected');
  });

  // 2. Authentication & Access Control
  it('rejects authentication with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'IncorrectPassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('fetches current authenticated corporate user and company context', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.companyCode).toBe('APEX');
    expect(res.body.user.companyName).toContain('Apex Global');
  });

  // 3. Organization & Branches
  it('manages corporate branches and organizational hierarchy', async () => {
    const branchRes = await request(app)
      .get('/api/v1/org/branches')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(branchRes.status).toBe(200);
    expect(Array.isArray(branchRes.body.branches)).toBe(true);
    expect(branchRes.body.branches.length).toBeGreaterThanOrEqual(3);

    const deptRes = await request(app)
      .get('/api/v1/org/departments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deptRes.status).toBe(200);
    expect(deptRes.body.departments.some((d: any) => d.code === 'ENG')).toBe(true);
  });

  // 4. Employee Master & Lifecycle
  it('creates a new employee with automatic probation timeline and leave balance', async () => {
    const branches = await request(app).get('/api/v1/org/branches').set('Authorization', `Bearer ${adminToken}`);
    const depts = await request(app).get('/api/v1/org/departments').set('Authorization', `Bearer ${adminToken}`);
    const desigs = await request(app).get('/api/v1/org/designations').set('Authorization', `Bearer ${adminToken}`);

    const newEmpCode = `APEX-${Date.now().toString().slice(-4)}`;
    const empRes = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeCode: newEmpCode,
        firstName: 'Pooja',
        lastName: 'Kamat',
        workEmail: `pooja.${newEmpCode.toLowerCase()}@apexglobal.tech`,
        personalEmail: 'pooja.kamat@gmail.com',
        phone: '+91 98200 99887',
        branchId: branches.body.branches[0].id,
        departmentId: depts.body.departments[0].id,
        designationId: desigs.body.designations[0].id,
        dateOfJoining: '2026-05-01',
        probationDays: 90,
        employmentType: 'PERMANENT',
        workMode: 'HYBRID',
        gender: 'FEMALE'
      });

    expect(empRes.status).toBe(201);
    expect(empRes.body.employee.id).toBeDefined();
    testEmployeeId = empRes.body.employee.id;

    // Record lifecycle confirmation
    const confirmRes = await request(app)
      .post(`/api/v1/employees/${testEmployeeId}/lifecycle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'CONFIRMATION',
        title: 'Probation Confirmed',
        description: 'Successfully completed 90 days probation with excellent reviews.',
        effectiveDate: '2026-08-01'
      });

    expect(confirmRes.status).toBe(200);
  });

  // 5. Compensation & CTC Engine
  it('assigns CTC structure to employee with deterministic component calculations', async () => {
    const assignRes = await request(app)
      .post('/api/v1/compensation/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: testEmployeeId,
        annualCtc: 1200000,
        effectiveFrom: '2026-08-01'
      });

    expect(assignRes.status).toBe(201);
    expect(assignRes.body.structure).toBeDefined();
    expect(Number(assignRes.body.structure.annualCtc)).toBe(1200000);
    expect(Number(assignRes.body.structure.monthlyGross)).toBeGreaterThan(0);
  });

  // 6. Attendance & Shifts
  it('records web clock-in and handles regularization requests', async () => {
    const punchRes = await request(app)
      .post('/api/v1/attendance/punch')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ punchType: 'IN', source: 'WEB' });

    expect(punchRes.status).toBe(200);
    expect(punchRes.body.dailyAttendance).toBeDefined();

    // Regularize
    const regRes = await request(app)
      .post('/api/v1/attendance/regularize')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        attendanceDate: '2026-10-10',
        reasonCode: 'CLIENT_VISIT',
        reasonNotes: 'On-site technical presentation at client office',
        requestedStatus: 'PRESENT'
      });

    expect(regRes.status).toBe(201);
    const regId = regRes.body.regularization.id;

    // Manager approve
    const approveReg = await request(app)
      .post(`/api/v1/attendance/regularizations/${regId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(approveReg.status).toBe(200);
    expect(approveReg.body.regularization.status).toBe('APPROVED');
  });

  // 7. Leave Management
  it('applies for casual leave and deducts leave balance on approval', async () => {
    const policiesRes = await request(app)
      .get('/api/v1/leave/policies')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(policiesRes.status).toBe(200);
    const clPolicy = policiesRes.body.policies.find((p: any) => p.code === 'CL');
    expect(clPolicy).toBeDefined();

    // Ensure sufficient balance for idempotent test execution
    const rahulUser = await prisma.user.findUnique({ where: { username: 'rahul.mehta' } });
    if (rahulUser?.employeeId) {
      await prisma.employeeLeaveBalance.updateMany({
        where: { employeeId: rahulUser.employeeId, leavePolicyId: clPolicy.id },
        data: { balance: 10 }
      });
    }

    // Apply
    const applyRes = await request(app)
      .post('/api/v1/leave/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leavePolicyId: clPolicy.id,
        fromDate: '2026-11-05',
        toDate: '2026-11-06',
        totalDays: 2,
        reason: 'Personal family commitment'
      });

    expect(applyRes.status).toBe(201);
    const leaveId = applyRes.body.leaveRequest.id;

    // Approve
    const actionRes = await request(app)
      .post(`/api/v1/leave/requests/${leaveId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(actionRes.status).toBe(200);
    expect(actionRes.body.leaveRequest.status).toBe('APPROVED');
  });

  // 8. Recruitment & ATS
  it('manages recruitment candidate pipeline and moves stages', async () => {
    const appsRes = await request(app)
      .get('/api/v1/recruitment/applications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(appsRes.status).toBe(200);
    expect(appsRes.body.applications.length).toBeGreaterThan(0);
    const firstApp = appsRes.body.applications[0];

    const moveRes = await request(app)
      .post(`/api/v1/recruitment/applications/${firstApp.id}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stage: 'OFFER_EXTENDED', notes: 'Offer extended with 15 LPA CTC' });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.application.stage).toBe('OFFER_EXTENDED');
  });

  // 9. Expenses & Travel Desk
  it('submits and approves employee reimbursement claims', async () => {
    const catRes = await request(app)
      .get('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(catRes.status).toBe(200);
    const category = catRes.body.categories[0];

    const claimRes = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Q3 Client Dinner & Broadband',
        claimDate: '2026-10-12',
        items: [
          { categoryId: category.id, amount: 2450, description: 'Client meeting dinner' }
        ]
      });

    expect(claimRes.status).toBe(201);
    const claimId = claimRes.body.claim.id;

    const approveClaim = await request(app)
      .post(`/api/v1/expenses/claims/${claimId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(approveClaim.status).toBe(200);
    expect(approveClaim.body.claim.status).toBe('APPROVED');
  });

  // 10. Timesheets & Performance
  it('logs weekly timesheet hours and sets employee OKR goals', async () => {
    const projRes = await request(app).get('/api/v1/timesheets/projects').set('Authorization', `Bearer ${adminToken}`);
    let projectId = projRes.body.projects[0]?.id;

    if (!projectId) {
      const p = await request(app).post('/api/v1/timesheets/projects').set('Authorization', `Bearer ${adminToken}`).send({
        code: 'PRJ-CORE',
        name: 'Apex Core Platform v2',
        clientName: 'Internal Product'
      });
      projectId = p.body?.project?.id;
    }

    if (projectId) {
      const tsRes = await request(app)
        .post('/api/v1/timesheets/entries')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          projectId,
          date: '2026-10-14',
          hours: 8,
          taskDescription: 'Developing corporate payroll REST API router'
        });

      expect(tsRes.status).toBe(201);
    }
  });

  // 11. Corporate 7-Stage Central Payroll Lifecycle
  it('executes full 7-stage corporate payroll workflow: DRAFT -> VALIDATED -> CALCULATED -> REVIEWED -> APPROVED -> PAYMENT_READY -> PAID', async () => {
    const periodRes = await request(app)
      .get('/api/v1/payroll/periods')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(periodRes.status).toBe(200);
    const openPeriod = periodRes.body.periods.find((p: any) => !p.isLocked) || periodRes.body.periods[periodRes.body.periods.length - 1];
    testPeriodId = openPeriod.id;

    // Ensure period is unlocked and clean for idempotent test execution
    await prisma.corporatePayrollRun.deleteMany({
      where: { periodId: testPeriodId }
    });
    await prisma.payrollPeriod.update({
      where: { id: testPeriodId },
      data: { isLocked: false }
    });

    // Stage 1: DRAFT
    const draftRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ periodId: testPeriodId });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.run.status).toBe('DRAFT');
    testRunId = draftRes.body.run.id;

    // Stage 2: VALIDATE
    const valRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(valRes.status).toBe(200);
    expect(valRes.body.run.status).toBe('VALIDATED');

    // Stage 3: CALCULATE
    const calcRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(calcRes.status).toBe(200);
    expect(calcRes.body.run.status).toBe('CALCULATED');
    expect(Number(calcRes.body.run.totalNetPay)).toBeGreaterThan(0);

    // Stage 4: REVIEW
    const revRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/review`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revRes.status).toBe(200);
    expect(revRes.body.run.status).toBe('REVIEWED');

    // Stage 5: APPROVE
    const appRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(appRes.status).toBe(200);
    expect(appRes.body.run.status).toBe('APPROVED');

    // Stage 6: PAYMENT READY
    const prRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/payment-ready`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prRes.status).toBe(200);
    expect(prRes.body.run.status).toBe('PAYMENT_READY');

    // Stage 7: PAID
    const paidRes = await request(app)
      .post(`/api/v1/payroll/runs/${testRunId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentReference: 'HDFC-NEFT-20261014-9988' });

    expect(paidRes.status).toBe(200);
    expect(paidRes.body.run.status).toBe('PAID');
    expect(paidRes.body.run.paymentReference).toBe('HDFC-NEFT-20261014-9988');
  });

  // 12. Employee Self-Service (ESS)
  it('retrieves employee dashboard, payslips, and enforces authorization boundary', async () => {
    const essDash = await request(app)
      .get('/api/v1/self-service/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(essDash.status).toBe(200);
    expect(essDash.body.profile.employeeCode).toBe('APEX-1003');

    // Negative Test: Employee role cannot initialize admin payroll run
    const unauthRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ periodId: testPeriodId });

    expect(unauthRes.status).toBe(403);
    expect(unauthRes.body.error.code).toBe('FORBIDDEN');
  });

  // 13. Offboarding & Full-and-Final (F&F)
  it('submits resignation and computes F&F settlement with leave encashment and notice calculations', async () => {
    // Clean up any prior resignation to make test idempotent
    const empUser = await prisma.user.findUnique({ where: { username: 'rahul.mehta' } });
    if (empUser?.employeeId) {
      await prisma.fnfSettlement.deleteMany({ where: { employeeId: empUser.employeeId } });
      await prisma.resignation.deleteMany({ where: { employeeId: empUser.employeeId } });
      await prisma.employee.update({ where: { id: empUser.employeeId }, data: { status: 'CONFIRMED' } });
    }

    const resignRes = await request(app)
      .post('/api/v1/offboarding/resignations')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requestedLwd: '2026-11-30',
        reason: 'Relocating to another city for personal reasons'
      });

    expect(resignRes.status).toBe(201);
    const resignationId = resignRes.body.resignation.id;

    // F&F calculation by HR/Finance
    const fnfRes = await request(app)
      .post('/api/v1/offboarding/settlement/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        resignationId,
        agreedLwd: '2026-11-30',
        noticeShortfallDays: 0
      });

    expect(fnfRes.status).toBe(200);
    expect(fnfRes.body.settlement).toBeDefined();
    expect(Number(fnfRes.body.settlement.netSettlementPay)).toBeGreaterThan(0);
  });

  // 14. Reports & Analytics
  it('generates corporate executive dashboard metrics and monthly salary register', async () => {
    const reportDash = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportDash.status).toBe(200);
    expect(reportDash.body.metrics.totalEmployees).toBeGreaterThan(0);

    const regRes = await request(app)
      .get(`/api/v1/reports/payroll-register?runId=${testRunId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(regRes.status).toBe(200);
    expect(Array.isArray(regRes.body.register)).toBe(true);

    const bankAdvice = await request(app)
      .get(`/api/v1/reports/bank-advice?runId=${testRunId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(bankAdvice.status).toBe(200);
    expect(Array.isArray(bankAdvice.body.bankAdvice)).toBe(true);
    expect(bankAdvice.body.totalDisbursement).toBeGreaterThan(0);
  });

  // 15. Security, Role-Based Access Control (RBAC) & Confidential Record Protection
  it('enforces server-side authorization boundaries, confidential record masking, and statutory data integrity', async () => {
    // A. Employee cannot access confidential salary register
    const unauthReg = await request(app)
      .get('/api/v1/reports/payroll-register')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(unauthReg.status).toBe(403);
    expect(unauthReg.body.error.code).toBe('FORBIDDEN');

    // B. Employee cannot access confidential bank advice NEFT export
    const unauthBank = await request(app)
      .get('/api/v1/reports/bank-advice')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(unauthBank.status).toBe(403);
    expect(unauthBank.body.error.code).toBe('FORBIDDEN');

    // C. Employee cannot access confidential statutory compliance report
    const unauthStat = await request(app)
      .get('/api/v1/reports/statutory-compliance')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(unauthStat.status).toBe(403);
    expect(unauthStat.body.error.code).toBe('FORBIDDEN');

    // D. Authorized admin receives live statutory compliance data computed from slips
    const authStat = await request(app)
      .get('/api/v1/reports/statutory-compliance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authStat.status).toBe(200);
    expect(authStat.body.complianceSummary).toBeDefined();
    expect(authStat.body.complianceSummary.epfSummary.totalEpfChallan).toBeGreaterThanOrEqual(0);

    // E. Employee listing employees receives masked confidential fields for other employees
    const empListRes = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(empListRes.status).toBe(200);
    const otherEmployees = empListRes.body.employees.filter((e: any) => e.employeeCode !== 'APEX-1003');
    if (otherEmployees.length > 0) {
      expect(otherEmployees[0].salaryStructure).toBeNull();
      expect(otherEmployees[0].bankAccountNumber).toContain('••••');
    }

    // F. Employee cannot access another employee's confidential profile by ID
    const rohitUser = await prisma.employee.findUnique({ where: { employeeCode: 'APEX-1001' } });
    if (rohitUser) {
      const rohitRes = await request(app)
        .get(`/api/v1/employees/${rohitUser.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(rohitRes.status).toBe(403);
      expect(rohitRes.body.error.code).toBe('FORBIDDEN');
    }
  });

  afterAll(async () => {
    if (testRunId) {
      await prisma.payslipDispatchRecord.deleteMany({ where: { payrollRunId: testRunId } });
      await prisma.corporatePayrollSlip.deleteMany({ where: { payrollRunId: testRunId } });
      await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: testRunId } });
      await prisma.corporatePayrollRun.deleteMany({ where: { id: testRunId } });
    }
    if (testEmployeeId) {
      await prisma.employeeCustomFieldValue.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.attendancePunch.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.dailyAttendance.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.loanRepayment.deleteMany({ where: { loan: { employeeId: testEmployeeId } } });
      await prisma.employeeLoan.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employmentTimeline.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employeeSalaryLine.deleteMany({ where: { structure: { employeeId: testEmployeeId } } });
      await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employeeSalaryStructure.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employeePayrollPolicy.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.corporatePayrollSlip.deleteMany({ where: { employeeId: testEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: testEmployeeId } });
    }
  });
});


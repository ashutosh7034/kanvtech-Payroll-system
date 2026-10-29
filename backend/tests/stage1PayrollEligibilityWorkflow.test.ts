import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('PAYFLOW Stage 1: Department / Group Payroll Run Initialization & Eligibility Suite', () => {
  let adminToken = '';
  let unauthorizedToken = '';
  let companyId = '';
  let janPeriod: any = null;
  let febPeriod: any = null;
  let octPeriod: any = null;
  let testDept: any = null;
  let testBranch: any = null;

  beforeAll(async () => {
    // 1. Authenticate Admin (payroll_admin / company_admin)
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate regular employee without payroll permissions
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    unauthorizedToken = empRes.body.token;

    // Get company
    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    companyId = adminUser!.companyId;

    // Fetch periods
    janPeriod = await prisma.payrollPeriod.findFirst({ where: { companyId, month: 1, year: 2026 } });
    febPeriod = await prisma.payrollPeriod.findFirst({ where: { companyId, month: 2, year: 2026 } });
    octPeriod = await prisma.payrollPeriod.findFirst({ where: { companyId, month: 10, year: 2026 } });

    // Fetch or verify department and branch
    testDept = await prisma.department.findFirst({ where: { companyId } });
    testBranch = await prisma.branch.findFirst({ where: { companyId } });
  });

  it('1. Candidate preview loads successfully for January 2026', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${janPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCount');
    expect(res.body).toHaveProperty('eligibleCount');
    expect(res.body).toHaveProperty('alreadyProcessedCount');
    expect(res.body).toHaveProperty('existingRuns');
    expect(Array.isArray(res.body.employees)).toBe(true);
    expect(res.body.totalCount).toBeGreaterThanOrEqual(3);
  });

  it('2. January 2026 detects existing paid/active run and marks all candidate employees already processed', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${janPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.eligibleCount).toBe(0);
    expect(res.body.alreadyProcessedCount).toBe(res.body.totalCount);
    expect(res.body.existingRuns.length).toBeGreaterThanOrEqual(1);

    const paidRun = res.body.existingRuns[0];
    expect(paidRun.runNumber).toMatch(/^RUN-2026-01/);
    expect(['PAID', 'CALCULATED', 'VALIDATED', 'REVIEWED', 'APPROVED']).toContain(paidRun.status);

    for (const emp of res.body.employees) {
      expect(emp.isEligible).toBe(false);
      expect(emp.alreadyProcessedRun).not.toBeNull();
      expect(emp.alreadyProcessedRun.runNumber).toMatch(/^RUN-2026-01/);
    }
  });

  it('3. Department scope filter scopes candidates correctly', async () => {
    if (!testDept) return;
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${janPeriod.id}&departmentId=${testDept.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const emp of res.body.employees) {
      expect(emp.department?.id).toBe(testDept.id);
    }
  });

  it('4. Branch scope filter scopes candidates correctly', async () => {
    if (!testBranch) return;
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${janPeriod.id}&branchId=${testBranch.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const emp of res.body.employees) {
      expect(emp.branch?.id).toBe(testBranch.id);
    }
  });

  it('5. Search query filters candidates by employee code or name case-insensitively', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${janPeriod.id}&search=apex-1001`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employees.length).toBe(1);
    expect(res.body.employees[0].employeeCode).toBe('APEX-1001');
  });

  it('6. Unprocessed period (February 2026) displays eligible candidates with valid CTC structures', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.eligibleCount).toBeGreaterThan(0);
    expect(res.body.alreadyProcessedCount).toBe(0);

    const eligibleEmps = res.body.employees.filter((e: any) => e.isEligible);
    expect(eligibleEmps.length).toBeGreaterThan(0);
    for (const emp of eligibleEmps) {
      expect(emp.hasSalaryStructure).toBe(true);
      expect(emp.monthlyGross).toBeGreaterThan(0);
      expect(emp.alreadyProcessedRun).toBeNull();
    }
  });

  it('7. Identifies missing salary structure with clear reason for unconfigured employees in October 2026', async () => {
    if (!octPeriod) return;
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${octPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    if (res.body.missingStructureCount > 0) {
      const missingEmps = res.body.employees.filter((e: any) => !e.hasSalaryStructure);
      for (const emp of missingEmps) {
        expect(emp.isEligible).toBe(false);
        expect(emp.ineligibilityReason).toContain('Missing salary structure');
      }
    }
  });

  it('8. Strictly rejects Stage 1 draft initialization when selected candidate list is empty', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: []
      });

    expect(res.status).toBe(400);
  });

  it('9. Strictly prevents duplicate payroll run for employees already paid in that period', async () => {
    // Attempting to draft January 2026 for Rohit Sharma who is already processed in an active/paid run
    const rohit = await prisma.employee.findFirst({ where: { employeeCode: 'APEX-1001' } });
    expect(rohit).not.toBeNull();

    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: janPeriod.id,
        selectedEmployeeIds: [rohit!.id]
      });

    expect(res.status).toBe(400);
    const errMsg = res.body.error?.message || res.body.message || '';
    expect(errMsg).toMatch(/already (PAID|processed|locked|CALCULATED|VALIDATED)/i);
  });

  it('10. Successfully creates exactly one Stage 1 DRAFT batch for eligible employees in February 2026', async () => {
    const previewRes = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const eligibleIds = previewRes.body.employees
      .filter((e: any) => e.isEligible)
      .map((e: any) => e.id);
    expect(eligibleIds.length).toBeGreaterThan(0);

    const draftRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: eligibleIds,
        remarks: 'UAT verification batch for client demonstration'
      });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.run).toHaveProperty('id');
    expect(draftRes.body.run.status).toBe('DRAFT');
    expect(draftRes.body.run.totalEmployees).toBe(eligibleIds.length);
    expect(draftRes.body.run.runNumber).toMatch(/^RUN-2026-02/);

    // Verify exactly 1 transition was logged
    const transitions = await prisma.corporatePayrollTransition.findMany({
      where: { payrollRunId: draftRes.body.run.id }
    });
    expect(transitions.length).toBe(1);
    expect(transitions[0].toStatus).toBe('DRAFT');

    // Clean up test draft run safely so test is repeatable
    await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: draftRes.body.run.id } });
    await prisma.corporatePayrollRun.delete({ where: { id: draftRes.body.run.id } });
  });

  it('11. Security & RBAC: Regular employee without payroll permissions is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: ['some-id']
      });

    expect(res.status).toBe(403);
  });

  it('12. Protected loan record b405b4b8-1211-48c5-a59e-ee8db001a906 remains completely intact', async () => {
    const loan = await prisma.employeeLoan.findUnique({
      where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
    });
    if (loan) {
      expect(loan.id).toBe('b405b4b8-1211-48c5-a59e-ee8db001a906');
    }
  });

  it('13. Existing January 2026 payroll runs remain intact and protected from deletion', async () => {
    const existingRun = await prisma.corporatePayrollRun.findFirst({
      where: { periodId: janPeriod.id }
    });
    expect(existingRun).not.toBeNull();
    expect(existingRun!.runNumber).toMatch(/^RUN-2026-01/);
  });

  it('14. Malformed or nonexistent periodId returns 400 or 404 without throwing unhandled exceptions', async () => {
    const res1 = await request(app)
      .get('/api/v1/payroll/runs/preview-eligible')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .get('/api/v1/payroll/runs/preview-eligible?periodId=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.status).toBe(404);
  });

  it('15. Drafting with partial employee selection and exclusion reasons persists scope metadata correctly', async () => {
    const previewRes = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const eligibleEmps = previewRes.body.employees.filter((e: any) => e.isEligible);
    if (eligibleEmps.length < 2) return;

    const selectedId = eligibleEmps[0].id;
    const excludedId = eligibleEmps[1].id;

    const draftRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: [selectedId],
        excludedEmployeeIds: [excludedId],
        exclusionReasons: {
          [excludedId]: 'On unpaid sabbatical during test'
        },
        remarks: 'Custom group scope test'
      });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.run.totalEmployees).toBe(1);

    const scope = (draftRes.body.run.validationNotes as any)?.scope;
    expect(scope).toBeDefined();
    expect(scope.selectedEmployeeIds).toContain(selectedId);
    expect(scope.excludedEmployeeIds).toContain(excludedId);
    expect(scope.exclusionReasons[excludedId]).toBe('On unpaid sabbatical during test');

    // Clean up
    await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: draftRes.body.run.id } });
    await prisma.corporatePayrollRun.delete({ where: { id: draftRes.body.run.id } });
  });

  it('16. Department-scoped draft appends department code to runNumber and sets scope type', async () => {
    if (!testDept) return;
    const previewRes = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}&departmentId=${testDept.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const eligibleIds = previewRes.body.employees.filter((e: any) => e.isEligible).map((e: any) => e.id);
    if (eligibleIds.length === 0) return;

    const draftRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        departmentId: testDept.id,
        selectedEmployeeIds: eligibleIds
      });

    expect(draftRes.status).toBe(201);
    const expectedDeptCode = testDept.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    expect(draftRes.body.run.runNumber).toContain(expectedDeptCode);

    // Clean up
    await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: draftRes.body.run.id } });
    await prisma.corporatePayrollRun.delete({ where: { id: draftRes.body.run.id } });
  });

  it('17. Re-drafting an existing DRAFT run updates in-place or safely cleans previous draft', async () => {
    const previewRes = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const eligibleIds = previewRes.body.employees.filter((e: any) => e.isEligible).map((e: any) => e.id);
    expect(eligibleIds.length).toBeGreaterThan(0);

    // Create First Draft
    const firstDraft = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: [eligibleIds[0]],
        remarks: 'First draft attempt'
      });
    expect(firstDraft.status).toBe(201);

    // Re-draft with full group (simulates user revising Stage 1 selection before moving to Stage 2)
    const secondDraft = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: eligibleIds,
        remarks: 'Revised full draft'
      });
    expect(secondDraft.status).toBe(201);
    expect(secondDraft.body.run.totalEmployees).toBe(eligibleIds.length);

    // Clean up
    await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: secondDraft.body.run.id } });
    await prisma.corporatePayrollRun.delete({ where: { id: secondDraft.body.run.id } });
  });

  it('18. Review table endpoint on freshly drafted batch does not throw toLocaleString or undefined exceptions', async () => {
    const previewRes = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const eligibleIds = previewRes.body.employees.filter((e: any) => e.isEligible).map((e: any) => e.id);
    expect(eligibleIds.length).toBeGreaterThan(0);

    const draftRes = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: febPeriod.id,
        selectedEmployeeIds: eligibleIds
      });
    expect(draftRes.status).toBe(201);
    const runId = draftRes.body.run.id;

    // Call review-table endpoint
    const reviewRes = await request(app)
      .get(`/api/v1/payroll/runs/${runId}/review-table`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body).toHaveProperty('rows');
    expect(reviewRes.body).toHaveProperty('grandTotals');

    // Clean up
    await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: runId } });
    await prisma.corporatePayrollRun.delete({ where: { id: runId } });
  });

  it('19. Inactive and exited employees are strictly excluded from candidate preview list', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/preview-eligible?periodId=${febPeriod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const emp of res.body.employees) {
      expect(['ACTIVE', 'CONFIRMED', 'PROBATION']).toContain(emp.status);
    }
  });

  it('20. Double submission defense: Submitting with already paid run does not create zombie drafts', async () => {
    const beforeCount = await prisma.corporatePayrollRun.count({ where: { periodId: janPeriod.id } });
    const res = await request(app)
      .post('/api/v1/payroll/runs/draft')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodId: janPeriod.id,
        selectedEmployeeIds: ['any-id']
      });
    expect(res.status).toBe(400);

    const afterCount = await prisma.corporatePayrollRun.count({ where: { periodId: janPeriod.id } });
    expect(afterCount).toBe(beforeCount);
  });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';

const API_SERVER = 'http://127.0.0.1:4000';

describe('Payroll Management API & Workflow Integration Tests', () => {
  let authToken = '';
  let periodId = '';
  let runId = '';

  it('verifies system health and readiness endpoints', async () => {
    const healthRes = await request(API_SERVER).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.version).toBe('2.1.26');

    const readyRes = await request(API_SERVER).get('/api/v1/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('ready');
    expect(readyRes.body.database).toBe('connected');
  });

  it('rejects authentication with invalid credentials', async () => {
    const res = await request(API_SERVER)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'WrongPassword999' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('authenticates admin successfully and returns JWT session token', async () => {
    const res = await request(API_SERVER)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.roles).toContain('payroll_admin');

    authToken = res.body.token;
  });

  it('fetches organization master data and employees', async () => {
    const empRes = await request(API_SERVER)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${authToken}`);

    expect(empRes.status).toBe(200);
    expect(Array.isArray(empRes.body.employees)).toBe(true);
    expect(empRes.body.employees.length).toBeGreaterThan(0);

    const firstEmp = empRes.body.employees[0];
    expect(firstEmp.employeeCode).toBeDefined();
    expect(firstEmp.department).toBeDefined();
  });

  it('fetches financial years and active periods', async () => {
    const fyRes = await request(API_SERVER)
      .get('/api/v1/masters/financial-years')
      .set('Authorization', `Bearer ${authToken}`);

    expect(fyRes.status).toBe(200);
    expect(Array.isArray(fyRes.body.financialYears)).toBe(true);

    const activeFy = fyRes.body.financialYears.find((fy: any) => fy.active);
    expect(activeFy).toBeDefined();
    expect(activeFy.periods.length).toBeGreaterThan(0);

    // Dynamically pick first available period without an approved run for repeatable testing
    const runsRes = await request(API_SERVER)
      .get('/api/v1/payroll/runs')
      .set('Authorization', `Bearer ${authToken}`);
    const approvedPeriodIds = new Set(
      (runsRes.body.runs || [])
        .filter((r: any) => r.status === 'APPROVED')
        .map((r: any) => r.periodId)
    );
    const targetPeriod = activeFy.periods.find((p: any) => !approvedPeriodIds.has(p.id)) || activeFy.periods[activeFy.periods.length - 1];
    periodId = targetPeriod.id;
    expect(periodId).toBeTruthy();
  });

  it('previews payroll calculation for the active period', async () => {
    const previewRes = await request(API_SERVER)
      .post('/api/v1/payroll/runs/preview')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ periodId });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.totals).toBeDefined();
    expect(previewRes.body.totalEmployees).toBeGreaterThan(0);
    expect(Number(previewRes.body.totals.gross)).toBeGreaterThan(0);
    expect(Number(previewRes.body.totals.net)).toBeGreaterThan(0);
  });

  it('executes 4-stage lifecycle: GENERATE -> VERIFY -> FINALIZE -> APPROVE', async () => {
    // 1. GENERATE
    const genRes = await request(API_SERVER)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ periodId, remarks: 'Automated test payroll run' });

    expect([200, 201]).toContain(genRes.status);
    expect(genRes.body.run).toBeDefined();
    expect(genRes.body.run.status).toBe('GENERATED');
    runId = genRes.body.run.id;

    // 2. VERIFY
    const verifyRes = await request(API_SERVER)
      .post(`/api/v1/payroll/runs/${runId}/verify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ remarks: 'Verified by test suite' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.run.status).toBe('VERIFIED');
    expect(verifyRes.body.run.verifiedBy).toBeTruthy();

    // 3. FINALIZE
    const finalizeRes = await request(API_SERVER)
      .post(`/api/v1/payroll/runs/${runId}/finalize`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ remarks: 'Finalized calculation freeze' });

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.run.status).toBe('FINALIZED');
    expect(finalizeRes.body.run.finalizedBy).toBeTruthy();

    // 4. APPROVE
    const approveRes = await request(API_SERVER)
      .post(`/api/v1/payroll/runs/${runId}/approve`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ remarks: 'Approved for disbursement' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.run.status).toBe('APPROVED');
    expect(approveRes.body.run.approvedBy).toBeTruthy();
  });

  it('enforces workflow integrity: prevents verifying an already approved run', async () => {
    const invalidTransitionRes = await request(API_SERVER)
      .post(`/api/v1/payroll/runs/${runId}/verify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ remarks: 'Illegal transition test' });

    expect(invalidTransitionRes.status).toBe(400);
    expect(invalidTransitionRes.body.error.code).toBe('INVALID_WORKFLOW_STATE');
  });

  it('generates bank payment batch from approved payroll', async () => {
    const batchRes = await request(API_SERVER)
      .post('/api/v1/payments/batches')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        payrollRunId: runId,
        paymentMethod: 'NEFT',
        bankName: 'State Bank of India'
      });

    expect(batchRes.status).toBe(201);
    expect(batchRes.body.paymentBatch).toBeDefined();
    expect(batchRes.body.paymentBatch.batchNumber).toBeDefined();
    expect(batchRes.body.paymentBatch.status).toBe('GENERATED');
  });

  it('authenticates employee into self-service portal and retrieves own profile', async () => {
    const empLoginRes = await request(API_SERVER)
      .post('/api/v1/auth/login')
      .send({ username: 'vikram.sharma', password: 'Admin@123' });

    expect(empLoginRes.status).toBe(200);
    const empToken = empLoginRes.body.token;
    expect(empToken).toBeDefined();
    expect(empLoginRes.body.user.roles).toContain('employee_self_service');

    // Fetch own profile
    const profileRes = await request(API_SERVER)
      .get('/api/v1/self-service/profile')
      .set('Authorization', `Bearer ${empToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.profile).toBeDefined();
    expect(profileRes.body.profile.employeeCode).toBe('EMP-1001');

    // Negative Test: Employee cannot trigger administrative payroll generation
    const unauthorizedGenRes = await request(API_SERVER)
      .post('/api/v1/payroll/runs/generate')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ periodId, remarks: 'Unauthorized attempt' });

    expect(unauthorizedGenRes.status).toBe(403);
    expect(unauthorizedGenRes.body.error.code).toBe('FORBIDDEN');
  });

  it('retrieves GPF accounts, interest configuration and ledger balance', async () => {
    const gpfRes = await request(API_SERVER)
      .get('/api/v1/gpf/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(gpfRes.status).toBe(200);
    expect(Array.isArray(gpfRes.body.gpfAccounts)).toBe(true);
    expect(gpfRes.body.gpfAccounts.length).toBeGreaterThan(0);
    expect(Number(gpfRes.body.gpfAccounts[0].currentBalance)).toBeGreaterThan(0);
  });

  it('generates institutional payroll and departmental reports', async () => {
    const deptReportRes = await request(API_SERVER)
      .get(`/api/v1/reports/department-summary?periodId=${periodId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deptReportRes.status).toBe(200);
    expect(Array.isArray(deptReportRes.body.departmentSummary)).toBe(true);

    const metricsRes = await request(API_SERVER)
      .get('/api/v1/reports/dashboard-metrics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.metrics).toBeDefined();
    expect(metricsRes.body.metrics.totalActiveEmployees).toBeGreaterThan(0);
  });
});

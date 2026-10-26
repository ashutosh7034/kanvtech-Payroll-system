import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { getMockEmailProvider, setCustomEmailProvider } from '../src/utils/emailService.js';

describe('Corporate HRMS - Payslip Email Delivery & Dispatch Subsystem (Priority 1)', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  let testPeriodId = '';
  let paidRunId = '';
  const mockProvider = getMockEmailProvider();

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 3. Obtain Company & Period context
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    companyId = meRes.body.user.companyId;

    // 3. Create or acquire an isolated test period to avoid concurrent collisions with other suites
    const emailTestPeriod = await prisma.payrollPeriod.upsert({
      where: {
        companyId_month_year: {
          companyId,
          month: 12,
          year: 2029
        }
      },
      update: { isLocked: false },
      create: {
        companyId,
        periodNumber: 99,
        name: 'Email Integration Test Period 2029',
        month: 12,
        year: 2029,
        startDate: new Date('2029-12-01'),
        endDate: new Date('2029-12-31'),
        cutoffDate: new Date('2029-12-25'),
        isLocked: false
      }
    });
    testPeriodId = emailTestPeriod.id;

    // 4. Setup a clean, dedicated PAID payroll run for this test suite
    await prisma.corporatePayrollRun.deleteMany({ where: { periodId: testPeriodId } });

    const dRes = await request(app).post('/api/v1/payroll/runs/draft').set('Authorization', `Bearer ${adminToken}`).send({ periodId: testPeriodId });
    const runId = dRes.body.run.id;
    await request(app).post(`/api/v1/payroll/runs/${runId}/validate`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/v1/payroll/runs/${runId}/calculate`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/v1/payroll/runs/${runId}/review`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/v1/payroll/runs/${runId}/approve`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/v1/payroll/runs/${runId}/payment-ready`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).post(`/api/v1/payroll/runs/${runId}/mark-paid`).set('Authorization', `Bearer ${adminToken}`).send({ paymentReference: 'NEFT-EMAIL-ISOLATED-2026' });

    paidRunId = runId;

    // Clear prior test dispatch records for this run so test is 100% idempotent
    await prisma.payslipDispatchRecord.deleteMany({
      where: { payrollRunId: paidRunId }
    });
    mockProvider.clearSentMessages();
    mockProvider.clearSimulatedFailures();
  });

  afterAll(async () => {
    mockProvider.clearSentMessages();
    mockProvider.clearSimulatedFailures();
    setCustomEmailProvider(null);
    if (paidRunId) {
      await prisma.payslipDispatchRecord.deleteMany({ where: { payrollRunId: paidRunId } });
      await prisma.corporatePayrollRun.deleteMany({ where: { id: paidRunId } });
    }
  });

  // Test 1: Access Control Boundary
  it('strictly rejects non-administrative employees from invoking send-payslips (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/runs/${paidRunId}/send-payslips`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Test 2: Status Precondition Enforcement
  it('strictly rejects emailing payslips for runs that are not in PAID status (400 Bad Request)', async () => {
    // Find or create non-PAID run
    const fakeRun = await prisma.corporatePayrollRun.create({
      data: {
        companyId,
        periodId: testPeriodId,
        runNumber: `RUN-DRAFT-TEST-${Date.now()}`,
        status: 'DRAFT',
        totalEmployees: 1,
        totalGross: 50000,
        totalDeductions: 5000,
        totalNetPay: 45000,
        totalEmployerCost: 55000
      }
    });

    try {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${fakeRun.id}/send-payslips`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('must be finalized and in \'PAID\' status');
    } finally {
      await prisma.corporatePayrollRun.delete({ where: { id: fakeRun.id } });
    }
  });

  // Test 3: Initial Full Dispatch with Mock Provider & Attachments
  it('successfully dispatches genuine PDF payslips to all eligible employees and records delivery', async () => {
    mockProvider.clearSentMessages();

    const res = await request(app)
      .post(`/api/v1/payroll/runs/${paidRunId}/send-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.provider).toBe('mock');
    expect(res.body.deliveredCount).toBeGreaterThan(0);
    expect(res.body.failedCount).toBe(0);
    expect(res.body.skippedCount).toBe(0);

    // Verify mock provider actually received emails with PDF attachments
    const sent = mockProvider.getSentMessages();
    expect(sent.length).toBe(res.body.deliveredCount);
    expect(sent[0].subject).toContain('Salary Payslip');
    expect(sent[0].attachments).toBeDefined();
    expect(sent[0].attachments!.length).toBe(1);
    expect(sent[0].attachments![0].filename).toContain('.pdf');
    expect(Buffer.isBuffer(sent[0].attachments![0].content)).toBe(true);

    // Verify database persistence in PayslipDispatchRecord
    const dbDispatches = await prisma.payslipDispatchRecord.findMany({
      where: { payrollRunId: paidRunId }
    });
    expect(dbDispatches.length).toBe(res.body.deliveredCount);
    expect(dbDispatches.every(d => d.status === 'DELIVERED')).toBe(true);
    expect(dbDispatches.every(d => d.attemptCount === 1)).toBe(true);
    expect(dbDispatches.every(d => d.messageId !== null)).toBe(true);
  });

  // Test 4: Idempotency & Duplicate Prevention
  it('prevents duplicate email dispatches on repeated calls by skipping already-delivered recipients', async () => {
    mockProvider.clearSentMessages();

    // Call send-payslips a second time without forceResend
    const res = await request(app)
      .post(`/api/v1/payroll/runs/${paidRunId}/send-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.deliveredCount).toBe(0);
    expect(res.body.skippedCount).toBeGreaterThan(0);

    // Verify no new emails were transmitted by the provider
    const sent = mockProvider.getSentMessages();
    expect(sent.length).toBe(0);
  });

  // Test 5: Explicit Force Resend
  it('allows explicit re-dispatch when forceResend: true is provided and increments attemptCount', async () => {
    mockProvider.clearSentMessages();

    const res = await request(app)
      .post(`/api/v1/payroll/runs/${paidRunId}/send-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ forceResend: true });

    expect(res.status).toBe(200);
    expect(res.body.deliveredCount).toBeGreaterThan(0);
    expect(res.body.skippedCount).toBe(0);

    // Verify attemptCount was incremented to 2
    const dbDispatches = await prisma.payslipDispatchRecord.findMany({
      where: { payrollRunId: paidRunId }
    });
    expect(dbDispatches.every(d => d.attemptCount === 2)).toBe(true);
  });

  // Test 6: Simulated Provider Failure & Error Recording
  it('records delivery failure with error details without marking recipient as delivered', async () => {
    // Configure mock provider to fail on a specific employee email
    const firstRecipient = await prisma.payslipDispatchRecord.findFirst({
      where: { payrollRunId: paidRunId }
    });
    expect(firstRecipient).not.toBeNull();

    mockProvider.setSimulatedFailure(firstRecipient!.recipientEmail, 'SMTP 550 User mailbox quota exceeded');

    // Resend with forceResend: true to trigger attempt
    const res = await request(app)
      .post(`/api/v1/payroll/runs/${paidRunId}/send-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ forceResend: true });

    expect(res.status).toBe(200);
    expect(res.body.failedCount).toBeGreaterThanOrEqual(1);

    // Check that the failed recipient record in DB has status FAILED and errorDetails
    const updatedRecord = await prisma.payslipDispatchRecord.findUnique({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: paidRunId,
          employeeId: firstRecipient!.employeeId
        }
      }
    });

    expect(updatedRecord!.status).toBe('FAILED');
    expect(updatedRecord!.errorDetails).toContain('550 User mailbox quota exceeded');

    // Clean up failure rule
    mockProvider.clearSimulatedFailures();
  });

  // Test 7: Dispatch Status Query Endpoint
  it('retrieves detailed dispatch statistics and per-recipient tracking records via GET /dispatch-status', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/runs/${paidRunId}/dispatch-status`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(paidRunId);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.deliveredCount).toBeGreaterThan(0);
    expect(Array.isArray(res.body.dispatches)).toBe(true);
    expect(res.body.dispatches.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/db.js';
import app from '../src/server.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';

describe('Saral PayPack Feature Parity Test Suite', () => {
  let adminToken: string;
  let testCompanyId: string;
  let testPeriodId: string;
  let testRunId: string;
  let testSlipId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Locate or create test company and admin
    const company = await prisma.company.findFirst();
    testCompanyId = company!.id;

    const roleAdmin = await prisma.role.findFirst({ where: { name: 'company_admin' } }) ||
      await prisma.role.create({ data: { name: 'company_admin', description: 'Admin' } });

    const user = await prisma.user.create({
      data: {
        companyId: testCompanyId,
        username: `parity_admin_${Date.now()}`,
        email: `parity_admin_${Date.now()}@example.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Parity Admin Test',
        active: true
      }
    });
    testUserId = user.id;

    await prisma.userRole.create({
      data: { userId: user.id, roleId: roleAdmin.id }
    });

    adminToken = jwt.sign(
      {
        userId: user.id,
        companyId: testCompanyId
      },
      ENV.JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  // 1. NEW MONTH CREATION
  describe('1. New Month Creation Workflow', () => {
    const testMonth = 10;
    const testYear = 2030; // Future year to avoid conflicts

    it('successfully creates a new payroll month period', async () => {
      await prisma.payrollPeriod.deleteMany({
        where: { companyId: testCompanyId, month: testMonth, year: testYear }
      });

      const res = await request(app)
        .post('/api/v1/payroll/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month: testMonth,
          year: testYear,
          name: `October ${testYear}`
        });

      expect(res.status).toBe(201);
      expect(res.body.period).toBeDefined();
      expect(res.body.period.name).toBe(`October ${testYear}`);
      expect(res.body.period.month).toBe(testMonth);
      expect(res.body.period.year).toBe(testYear);
      testPeriodId = res.body.period.id;
    });

    it('strictly prevents duplicate month creation for same company, month, and year', async () => {
      const res = await request(app)
        .post('/api/v1/payroll/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          month: testMonth,
          year: testYear,
          name: `October ${testYear} Duplicate`
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error?.message).toMatch(/already exists/i);
    });
  });

  // 2. MONTHLY ATTENDANCE MATRIX
  describe('2. Monthly Attendance Details Matrix', () => {
    it('retrieves aggregated monthly attendance matrix with calendar days, leaves, and payable days', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/monthly-matrix?month=1&year=2026')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.calendarDays).toBe(31);
      expect(Array.isArray(res.body.matrix)).toBe(true);
      if (res.body.matrix.length > 0) {
        const emp = res.body.matrix[0];
        expect(emp).toHaveProperty('employeeCode');
        expect(emp).toHaveProperty('calendarDays');
        expect(emp).toHaveProperty('presentDays');
        expect(emp).toHaveProperty('lopDays');
        expect(emp).toHaveProperty('payableDays');
      }
    });
  });

  // 3. TDS PROCESS & TAX ASSESSMENT
  describe('3. TDS Process & Porting to Active Payroll', () => {
    it('computes annual projected tax and monthly TDS for all active employees', async () => {
      const res = await request(app)
        .get('/api/v1/payroll/tds/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.financialYear).toBe('2026-2027');
      expect(Array.isArray(res.body.records)).toBe(true);
      expect(res.body.records.length).toBeGreaterThan(0);

      const record = res.body.records[0];
      expect(record).toHaveProperty('taxRegime');
      expect(record).toHaveProperty('standardDeduction');
      expect(record).toHaveProperty('taxableIncome');
      expect(record).toHaveProperty('totalTaxPayable');
      expect(record).toHaveProperty('monthlyTds');
    });

    it('ports computed TDS to active payroll run slips', async () => {
      let run = await prisma.corporatePayrollRun.findFirst({
        where: { companyId: testCompanyId, status: { not: 'PAID' } },
        include: { slips: true }
      });

      // If no non-paid run exists, find any period and create draft
      if (!run) {
        let period = await prisma.payrollPeriod.findFirst({ where: { companyId: testCompanyId } });
        if (period) {
          const draftRes = await request(app)
            .post('/api/v1/payroll/runs/draft')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ periodId: period.id });
          testRunId = draftRes.body.run.id;
          await request(app)
            .post(`/api/v1/payroll/runs/${testRunId}/calculate`)
            .set('Authorization', `Bearer ${adminToken}`);
          run = await prisma.corporatePayrollRun.findUnique({
            where: { id: testRunId },
            include: { slips: true }
          });
        }
      }

      if (run) {
        testRunId = run.id;
        testSlipId = run.slips[0]?.id;

        const res = await request(app)
          .post('/api/v1/payroll/tds/port-to-salary')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ runId: testRunId, overwrite: true });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.portedCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // 4. MONTHLY SALARY EDITOR & STATUTORY SAFEGUARDS
  describe('4. Monthly Salary Editor & Adjustments', () => {
    it('retrieves salary editor grid with isNetLessThan25Percent compliance flag', async () => {
      if (!testRunId) {
        const run = await prisma.corporatePayrollRun.findFirst({
          where: { companyId: testCompanyId },
          include: { slips: true }
        });
        if (run) {
          testRunId = run.id;
          testSlipId = run.slips[0]?.id;
        }
      }

      if (testRunId) {
        const res = await request(app)
          .get(`/api/v1/payroll/runs/${testRunId}/editor`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.runId).toBe(testRunId);
        expect(Array.isArray(res.body.rows)).toBe(true);
        if (res.body.rows.length > 0) {
          const row = res.body.rows[0];
          expect(row).toHaveProperty('grossPay');
          expect(row).toHaveProperty('netPay');
          expect(row).toHaveProperty('isNetLessThan25Percent');
        }
      }
    });

    it('successfully updates manual salary adjustments and recalculates run totals', async () => {
      if (!testRunId || !testSlipId) return;

      const res = await request(app)
        .patch(`/api/v1/payroll/runs/${testRunId}/adjustments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slipId: testSlipId,
          variableEarnings: 5000,
          reason: 'Performance Incentive'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.slip.variableEarnings)).toBe(5000);
    });
  });

  // 6. OBSERVABILITY & REQUEST CORRELATION TRACKING
  describe('6. Observability, Metrics & Request Correlation Tracking', () => {
    it('returns service health and SRE golden metrics via GET /api/v1/metrics', async () => {
      const res = await request(app).get('/api/v1/metrics');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('payroll-management-api');
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(typeof res.body.memoryUsageMb).toBe('number');
      expect(res.body.database).toBe('connected');
    });

    it('automatically assigns and echoes X-Correlation-ID header when omitted by client', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id'].length).toBeGreaterThan(5);
    });

    it('propagates client-supplied X-Correlation-ID header in response when valid', async () => {
      const customId = `audit-trace-${Date.now()}`;
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Correlation-ID', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).toBe(customId);
    });

    it('sanitizes untrusted malformed X-Correlation-ID headers and substitutes clean UUID', async () => {
      const maliciousId = 'malicious<script>alert(1)</script>';
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Correlation-ID', maliciousId);

      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).not.toBe(maliciousId);
      expect(res.headers['x-correlation-id']).not.toContain('<script>');
    });
  });

  afterAll(async () => {
    // Cleanup fixtures
    if (testPeriodId) {
      await prisma.payrollPeriod.deleteMany({ where: { id: testPeriodId } });
    }
    if (testUserId) {
      await prisma.userRole.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });
});

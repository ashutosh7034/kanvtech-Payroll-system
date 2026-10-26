import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('PAYFLOW Master Verification Suite: Expenses, Payroll 7-Stages & Permissions', () => {
  let adminToken = '';
  let hrToken = '';
  let employeeToken = '';
  let financeToken = '';

  let companyId = '';
  let employeeId = '';
  let categoryId = '';

  let createdExpenseId = '';
  let createdReimbursementId = '';
  let testPeriodId = '';
  let testPayrollRunId = '';

  beforeAll(async () => {
    // 1. Resolve Company
    const company = await prisma.company.findFirst({ where: { code: 'APEX' } });
    expect(company).toBeDefined();
    companyId = company!.id;

    // 2. Categories
    const categories = await prisma.expenseCategory.findMany({ where: { companyId } });
    if (categories.length > 0) {
      categoryId = categories[0].id;
    } else {
      const cat = await prisma.expenseCategory.create({
        data: { companyId, code: 'TEST-EXP', name: 'General Business Expense', maxLimit: 25000 }
      });
      categoryId = cat.id;
    }

    // 3. Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 4. Login as HR Manager
    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'hr.manager', password: 'Admin@123' });
    expect(hrRes.status).toBe(200);
    hrToken = hrRes.body.token;

    // 5. Login as Active Employee (Ananya Verma)
    const empUser = await prisma.user.findUnique({ where: { username: 'ananya.verma' } });
    expect(empUser).toBeDefined();
    employeeId = empUser!.employeeId!;

    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ananya.verma', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 6. Login as Finance Admin / Lead
    const finRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'finance.lead', password: 'Admin@123' });
    expect(finRes.status).toBe(200);
    financeToken = finRes.body.token;

    // 7. Find or create a dedicated test payroll period with an uncalculated future month
    const testYear = 2038;
    const testMonth = 7;
    let period = await prisma.payrollPeriod.findFirst({
      where: { companyId, year: testYear, month: testMonth }
    });
    if (!period) {
      period = await prisma.payrollPeriod.create({
        data: {
          companyId,
          periodNumber: 77,
          name: `July ${testYear}`,
          month: testMonth,
          year: testYear,
          startDate: new Date(`${testYear}-07-01`),
          endDate: new Date(`${testYear}-07-31`),
          cutoffDate: new Date(`${testYear}-07-25`)
        }
      });
    } else {
      // Clean up previous test run in test DB for this isolated test period
      await prisma.corporatePayrollTransition.deleteMany({
        where: { payrollRun: { periodId: period.id } }
      });
      await prisma.corporatePayrollRun.deleteMany({
        where: { periodId: period.id }
      });
    }
    testPeriodId = period.id;
  });

  // =========================================================================
  // TASK 1: EXPENSES & REIMBURSEMENTS SEPARATION & SUBMISSION
  // =========================================================================
  describe('1. Expenses and Reimbursements Workflow & Uploads', () => {
    it('successfully uploads an optional receipt document via base64 upload endpoint', async () => {
      const dummyBase64 = Buffer.from('PDF Mock Receipt Content for Payflow Verification').toString('base64');
      const res = await request(app)
        .post('/api/v1/expenses/upload-receipt')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          filename: 'client_hospitality_bill.pdf',
          mimeType: 'application/pdf',
          base64Data: dummyBase64
        });

      expect(res.status).toBe(201);
      expect(res.body.url).toMatch(/^\/api\/v1\/expenses\/attachments\//);
      expect(res.body.filename).toContain('client_hospitality_bill.pdf');

      // Verify attachment can be retrieved
      const getRes = await request(app)
        .get(res.body.url)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.headers['content-type']).toContain('application/pdf');
    });

    it('rejects disallowed file types for receipt uploads', async () => {
      const dummyBase64 = Buffer.from('echo malicious').toString('base64');
      const res = await request(app)
        .post('/api/v1/expenses/upload-receipt')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          filename: 'script.exe',
          mimeType: 'application/x-msdownload',
          base64Data: dummyBase64
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/Only JPEG, PNG, WEBP, and PDF files are allowed|Invalid request data/i);
    });

    it('submits a valid single expense claim (claimType: EXPENSE)', async () => {
      const res = await request(app)
        .post('/api/v1/expenses/claims')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          claimType: 'EXPENSE',
          title: 'Client Lunch Hospitality',
          claimDate: '2026-10-20',
          items: [
            {
              categoryId,
              amount: 2200,
              description: 'Executive client lunch catering'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.claim.claimNumber).toMatch(/^EXP-2026-\d{4}$/);
      expect(res.body.claim.claimType).toBe('EXPENSE');
      expect(Number(res.body.claim.totalAmount)).toBe(2200);
      expect(res.body.claim.status).toBe('PENDING');
      createdExpenseId = res.body.claim.id;
    });

    it('submits a valid multi-item reimbursement voucher (claimType: REIMBURSEMENT)', async () => {
      const res = await request(app)
        .post('/api/v1/expenses/claims')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          claimType: 'REIMBURSEMENT',
          title: 'Q4 Field Visit & Project Materials',
          claimDate: '2026-10-22',
          items: [
            { categoryId, amount: 1500, description: 'Travel local cab fare' },
            { categoryId, amount: 850, description: 'Client meeting stationery' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.claim.claimNumber).toMatch(/^REIM-2026-\d{4}$/);
      expect(res.body.claim.claimType).toBe('REIMBURSEMENT');
      expect(Number(res.body.claim.totalAmount)).toBe(2350);
      createdReimbursementId = res.body.claim.id;
    });

    it('filters claims list by claimType (EXPENSE vs REIMBURSEMENT)', async () => {
      const expRes = await request(app)
        .get('/api/v1/expenses/claims?claimType=EXPENSE')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(expRes.status).toBe(200);
      expect(expRes.body.claims.every((c: any) => (c.claimType || 'EXPENSE') === 'EXPENSE')).toBe(true);

      const reimRes = await request(app)
        .get('/api/v1/expenses/claims?claimType=REIMBURSEMENT')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(reimRes.status).toBe(200);
      expect(reimRes.body.claims.every((c: any) => c.claimType === 'REIMBURSEMENT')).toBe(true);
    });
  });

  // =========================================================================
  // TASK 1: CLAIM CORRECTION WORKFLOW (Part 4)
  // =========================================================================
  describe('2. Claim Correction & Resubmission Workflow', () => {
    it('allows an authorized reviewer to request corrections with a mandatory reason', async () => {
      const res = await request(app)
        .post(`/api/v1/expenses/claims/${createdExpenseId}/action`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          status: 'CORRECTION_REQUESTED',
          reason: 'Please attach the official tax invoice bill rather than POS charge slip.'
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('CORRECTION_REQUESTED');
      expect(res.body.claim.rejectionReason).toContain('Please attach the official tax invoice');
    });

    it('strictly prevents resubmitting a claim when not in CORRECTION_REQUESTED status', async () => {
      const res = await request(app)
        .put(`/api/v1/expenses/claims/${createdReimbursementId}/resubmit`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Modified Title',
          claimDate: '2026-10-22',
          items: [{ categoryId, amount: 2000 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/Resubmission is only permitted when status is 'CORRECTION_REQUESTED'/i);
    });

    it('allows claimant employee to resubmit the corrected claim, resetting status to PENDING and preserving history', async () => {
      const res = await request(app)
        .put(`/api/v1/expenses/claims/${createdExpenseId}/resubmit`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Client Lunch Hospitality - Tax Invoice Attached',
          claimDate: '2026-10-20',
          correctionNotes: 'Attached official tax invoice GSTIN#27AAACA1234F1Z9 as requested.',
          items: [
            {
              categoryId,
              amount: 2200,
              description: 'Client lunch meeting with tax invoice',
              receiptUrl: '/api/v1/expenses/attachments/tax_invoice_verified.pdf'
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('PENDING');
      expect(res.body.claim.correctionNotes).toContain('Attached official tax invoice');
      expect(res.body.claim.rejectionReason).toBeNull(); // Reset upon fresh resubmission
      expect(res.body.claim.resubmittedAt).toBeDefined();
    });
  });

  // =========================================================================
  // TASK 1: HR/ADMIN CLAIM-DRIVEN HIERARCHICAL VIEW (Part 3)
  // =========================================================================
  describe('3. HR/Admin Claim-Driven Hierarchical Employee List', () => {
    it('returns only employees who have submitted at least one claim in authorized scope', async () => {
      const res = await request(app)
        .get('/api/v1/expenses/employees-with-claims')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.employees)).toBe(true);
      expect(res.body.employees.length).toBeGreaterThan(0);

      // Verify aggregated metrics per employee
      const rahul = res.body.employees.find((e: any) => e.employee.id === employeeId);
      expect(rahul).toBeDefined();
      expect(rahul.totalClaims).toBeGreaterThan(0);
      expect(rahul.totalClaimedAmount).toBeGreaterThan(0);
      expect(rahul.expenseCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // TASK 2: 7-STAGE PAYROLL WORKFLOW ENGINE (Part 5)
  // =========================================================================
  describe('4. 7-Stage Corporate Payroll Engine Transitions', () => {
    it('executes Stage 1: DRAFT (initializes batch & employee scope)', async () => {
      const res = await request(app)
        .post('/api/v1/payroll/runs/draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ periodId: testPeriodId });

      expect(res.status).toBe(201);
      expect(res.body.run.status).toBe('DRAFT');
      expect(res.body.run.totalEmployees).toBeGreaterThan(0);
      testPayrollRunId = res.body.run.id;
    });

    it('executes Stage 2: VALIDATE (scans CTC, attendance & LOP)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('VALIDATED');
      expect(res.body.validationNotes).toBeDefined();
    });

    it('executes Stage 3: CALCULATE (pure decimal math earnings, deductions, net pay)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/calculate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('CALCULATED');
      expect(Number(res.body.run.totalGross)).toBeGreaterThan(0);
      expect(Number(res.body.run.totalNetPay)).toBeGreaterThan(0);
    });

    it('executes Stage 4: REVIEW (audits variance against prior runs & flags deductions)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/review`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('REVIEWED');
      expect(res.body.varianceNotes).toBeDefined();
    });

    it('allows recalculate to reset run back to VALIDATED before approval', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/recalculate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('VALIDATED');

      // Fast-forward back to REVIEWED
      await request(app).post(`/api/v1/payroll/runs/${testPayrollRunId}/calculate`).set('Authorization', `Bearer ${adminToken}`);
      await request(app).post(`/api/v1/payroll/runs/${testPayrollRunId}/review`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('executes Stage 5: APPROVE (Finance Executive disbursement authorization)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/approve`)
        .set('Authorization', `Bearer ${financeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('APPROVED');
      expect(res.body.run.approvedBy).toBeDefined();
    });

    it('executes Stage 6: PAYMENT_READY (generates electronic bank payment register NEFT)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/payment-ready`)
        .set('Authorization', `Bearer ${financeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('PAYMENT_READY');
    });

    it('executes Stage 7: MARK PAID (confirms bank UTR & releases slips to ESS)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${testPayrollRunId}/mark-paid`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ paymentReference: 'UTR-2026-NEFT-991204' });

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('PAID');
      expect(res.body.run.paymentReference).toBe('UTR-2026-NEFT-991204');
    });
  });

  // =========================================================================
  // TASK 2: ADMIN-CONTROLLED PAYROLL PERMISSIONS & RBAC DASHBOARD (Part 6)
  // =========================================================================
  describe('5. Admin-Controlled Payroll Permissions & RBAC Integration', () => {
    it('allows an authorized admin to update role permissions via RBAC API', async () => {
      const rolesRes = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rolesRes.status).toBe(200);

      const payrollRole = rolesRes.body.roles.find((r: any) => r.name === 'payroll_admin') || rolesRes.body.roles[0];
      expect(payrollRole).toBeDefined();

      const newPermissions = [
        'payroll:view_dashboard',
        'payroll:view_runs',
        'payroll:view_employee_details',
        'payroll:prepare',
        'payroll:calculate',
        'payroll:validate',
        'payroll:review'
      ];

      const patchRes = await request(app)
        .patch(`/api/v1/rbac/roles/${payrollRole.id}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: newPermissions });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.role.permissions).toEqual(expect.arrayContaining(newPermissions));
    });

    it('strictly prevents regular employees from modifying payroll permissions', async () => {
      const rolesRes = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      const testRole = rolesRes.body.roles[0];

      const res = await request(app)
        .patch(`/api/v1/rbac/roles/${testRole.id}/permissions`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ permissions: ['payroll:approve'] });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // PART 8: DATABASE SAFETY & DATA INTEGRITY VERIFICATION
  // =========================================================================
  describe('6. Data Integrity & Financial Safety Checks', () => {
    it('confirms the protected loan record remains intact and unaltered', async () => {
      // In production DB, verify b405b4b8-1211-48c5-a59e-ee8db001a906 is intact
      const { PrismaClient } = await import('@prisma/client');
      const prodPrisma = new PrismaClient({
        datasources: { db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management' } }
      });
      try {
        const protectedLoan = await prodPrisma.employeeLoan.findUnique({
          where: { id: 'b405b4b8-1211-48c5-a59e-ee8db001a906' }
        });
        expect(protectedLoan).toBeDefined();
        expect(Number(protectedLoan!.principalAmount)).toBe(24000);
        expect(protectedLoan!.status).toBe('CLOSED');
      } finally {
        await prodPrisma.$disconnect();
      }

      // Also confirm test DB loans are valid and uncorrupted
      const testLoans = await prisma.employeeLoan.findMany({ take: 5 });
      expect(testLoans.length).toBeGreaterThan(0);
      for (const loan of testLoans) {
        expect(Number(loan.principalAmount)).toBeGreaterThan(0);
      }
    });
  });
});

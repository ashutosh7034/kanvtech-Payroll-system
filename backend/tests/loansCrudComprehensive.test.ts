import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Comprehensive Loans & Advances CRUD & Lifecycle Test Suite', () => {
  let adminToken: string;
  let testCompanyId: string;
  let testEmployeeId: string;
  let testLoanTypeId: string;
  let createdLoanId: string;

  beforeAll(async () => {
    // 1. Authenticate as Company Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    testCompanyId = adminRes.body.user.companyId;
    const adminEmpId = adminRes.body.user.employeeId;

    // 2. Fetch or create a test employee in testCompanyId that is NOT the admin
    let emp = await prisma.employee.findFirst({
      where: {
        companyId: testCompanyId,
        ...(adminEmpId ? { id: { not: adminEmpId } } : {})
      }
    });

    if (!emp) {
      const dept = await prisma.department.findFirst({ where: { companyId: testCompanyId } });
      const desig = await prisma.designation.findFirst({ where: { companyId: testCompanyId } });
      emp = await prisma.employee.create({
        data: {
          companyId: testCompanyId,
          employeeCode: `EMP_TEST_${Date.now().toString().slice(-4)}`,
          firstName: 'Beneficiary',
          lastName: 'Tester',
          workEmail: `beneficiary_${Date.now()}@example.com`,
          departmentId: dept?.id,
          designationId: desig?.id,
          dateOfJoining: new Date(),
          employmentStatus: 'ACTIVE'
        }
      });
    }
    testEmployeeId = emp.id;

    // 3. Create a dedicated test loan product with 12 months tenure
    const lType = await prisma.loanType.create({
      data: {
        companyId: testCompanyId,
        code: `TEST_LN_${Date.now().toString().slice(-4)}`,
        name: 'Annual Salary Advance Test',
        maxAmount: 100000,
        interestRatePct: 0,
        maxTenureMonths: 12
      }
    });
    testLoanTypeId = lType.id;
  });

  // ==========================================
  // 1. CREATE (POST /loans and POST /loans/apply)
  // ==========================================
  describe('Create / Sanction Operations', () => {
    it('creates a new loan via POST /api/v1/loans using totalInstallments', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 24000,
          totalInstallments: 12,
          sanctionOrderNumber: 'TEST-ORD-001'
        });

      expect(res.status).toBe(201);
      expect(res.body.loan).toBeDefined();
      expect(res.body.loan.principalAmount).toBe('24000');
      expect(res.body.loan.monthlyEmi).toBe('2000'); // 24000 / 12 = 2000
      expect(res.body.loan.tenureMonths).toBe(12);
      expect(res.body.loan.status).toBe('ACTIVE');
      createdLoanId = res.body.loan.id;
    });

    it('rejects loan creation when principal exceeds product limit', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 9999999, // Exceeds product maxAmount (100k)
          totalInstallments: 12
        });

      expect(res.status).toBe(400);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('exceeds maximum allowed limit');
    });

    it('rejects loan creation when tenure exceeds product limit', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 10000,
          totalInstallments: 50 // Product max is 12
        });

      expect(res.status).toBe(400);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('Tenure exceeds maximum');
    });
  });

  // ==========================================
  // 2. READ (GET /loans and GET /loans/:id/repayments)
  // ==========================================
  describe('Read Operations', () => {
    it('lists loans with decorated compatibility fields', async () => {
      const res = await request(app)
        .get('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.loans)).toBe(true);
      const found = res.body.loans.find((l: any) => l.id === createdLoanId);
      expect(found).toBeDefined();
      expect(found.sanctionOrderNumber).toBeDefined();
      expect(found.monthlyInstallment).toBe(2000);
      expect(found.recoveredInstallments).toBe(0);
      expect(found.totalInstallments).toBe(12);
    });

    it('retrieves repayment history for an advance', async () => {
      const res = await request(app)
        .get(`/api/v1/loans/${createdLoanId}/repayments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.loan).toBeDefined();
      expect(Array.isArray(res.body.loan.repayments)).toBe(true);
    });
  });

  // ==========================================
  // 3. UPDATE / AMEND (PATCH /loans/:id)
  // ==========================================
  describe('Update & Amendment Operations', () => {
    it('amends principal and tenure and recalculates EMI atomically', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          principalAmount: 36000,
          tenureMonths: 12
        });

      expect(res.status).toBe(200);
      expect(res.body.loan.principalAmount).toBe('36000');
      expect(res.body.loan.monthlyEmi).toBe('3000'); // 36000 / 12 = 3000
      expect(res.body.loan.outstandingAmount).toBe('36000');
    });

    it('strictly rejects closing a loan with outstanding balance when reason is omitted or too short (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CLOSED' });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/explicit reason/i);

      const resShort = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CLOSED', reason: '   ' });

      expect(resShort.status).toBe(400);
      expect(resShort.body.error?.message).toMatch(/explicit reason/i);
    });

    it('strictly rejects cancelling a loan with outstanding balance when reason is omitted (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/explicit reason/i);
    });

    it('updates loan status to CLOSED via PATCH /loans/:id/status when reason is provided', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CLOSED', reason: 'Prepaid in cash' });

      expect(res.status).toBe(200);
      expect(res.body.loan.status).toBe('CLOSED');
    });

    it('reactivates loan to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${createdLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.loan.status).toBe('ACTIVE');
    });
  });

  // ==========================================
  // 4. DELETE / CANCEL
  // ==========================================
  describe('Delete & Cancellation Operations', () => {
    it('strictly prevents deletion of a loan that has repayment history', async () => {
      // Create a loan and insert a synthetic repayment
      const loan = await prisma.employeeLoan.create({
        data: {
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 10000,
          monthlyEmi: 1000,
          tenureMonths: 10,
          recoveredAmount: 1000,
          outstandingAmount: 9000,
          status: 'ACTIVE'
        }
      });

      await prisma.loanRepayment.create({
        data: {
          loanId: loan.id,
          installmentNumber: 1,
          amountPaid: 1000
        }
      });

      const delRes = await request(app)
        .delete(`/api/v1/loans/${loan.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(400);
      const msg = delRes.body.error?.message || delRes.body.message;
      expect(msg).toContain('Cannot physically delete an advance with recorded repayment history');

      // Cleanup
      await prisma.loanRepayment.deleteMany({ where: { loanId: loan.id } });
      await prisma.employeeLoan.delete({ where: { id: loan.id } });
    });

    it('successfully deletes an unrecovered draft loan', async () => {
      const res = await request(app)
        .delete(`/api/v1/loans/${createdLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion from database
      const verify = await prisma.employeeLoan.findUnique({
        where: { id: createdLoanId }
      });
      expect(verify).toBeNull();
    });
  });

  // ==========================================
  // 5. TENANT ISOLATION
  // ==========================================
  describe('Cross-Tenant Security Boundaries', () => {
    it('prevents another tenant from viewing or modifying advances', async () => {
      // Create a temporary Tenant B with contactEmail
      const tenantB = await prisma.company.create({
        data: {
          name: `Tenant B Corp ${Date.now()}`,
          legalName: `Tenant B Legal Name ${Date.now()}`,
          code: `TB_${Date.now().toString().slice(-4)}`,
          contactEmail: `contact_${Date.now()}@tenantb.com`
        }
      });

      const roleAdmin = await prisma.role.findFirst({ where: { name: 'company_admin' } });

      const userB = await prisma.user.create({
        data: {
          companyId: tenantB.id,
          username: `admin_b_${Date.now()}`,
          email: `adminb_${Date.now()}@example.com`,
          passwordHash: 'dummy',
          fullName: 'Tenant B Admin',
          active: true,
          userRoles: {
            create: { roleId: roleAdmin!.id }
          }
        }
      });

      // Login as Tenant B
      const jwt = await import('jsonwebtoken');
      const tokenB = jwt.default.sign(
        { userId: userB.id, companyId: tenantB.id, roles: ['company_admin'] },
        process.env.JWT_SECRET || 'dev-insecure-secret-key-change-in-production-payroll-system-2026',
        { expiresIn: '1h' }
      );

      // Attempt to access a Loan from Tenant A
      const testLoanA = await prisma.employeeLoan.create({
        data: {
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 5000,
          monthlyEmi: 500,
          tenureMonths: 10,
          recoveredAmount: 0,
          outstandingAmount: 5000,
          status: 'ACTIVE'
        }
      });

      // Tenant B queries repayments of Tenant A loan -> 404
      const getRes = await request(app)
        .get(`/api/v1/loans/${testLoanA.id}/repayments`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getRes.status).toBe(404);

      // Tenant B attempts to amend Tenant A loan -> 404
      const patchRes = await request(app)
        .patch(`/api/v1/loans/${testLoanA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ principalAmount: 9000 });
      expect(patchRes.status).toBe(404);

      // Tenant B attempts to delete Tenant A loan -> 404
      const delRes = await request(app)
        .delete(`/api/v1/loans/${testLoanA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(delRes.status).toBe(404);

      // Cleanup
      await prisma.employeeLoan.delete({ where: { id: testLoanA.id } });
      await prisma.userRole.deleteMany({ where: { userId: userB.id } });
      await prisma.user.delete({ where: { id: userB.id } });
      await prisma.company.delete({ where: { id: tenantB.id } });
    });
  });

  afterAll(async () => {
    if (testLoanTypeId) {
      await prisma.employeeLoan.deleteMany({ where: { loanTypeId: testLoanTypeId } });
      await prisma.loanType.deleteMany({ where: { id: testLoanTypeId } });
    }
    await prisma.$disconnect();
  });
});

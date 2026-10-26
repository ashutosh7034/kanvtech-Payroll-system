import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Security Remediation & Authorization Enforcement Suite', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantACompanyId: string;
  let tenantBCompanyId: string;
  let tenantARunId: string;
  let tenantAEmployeeId: string;
  let tenantBEmployeeId: string;
  let tenantALoanTypeId: string;
  let tenantALoanId: string;
  let validatorToken: string;
  let approverToken: string;
  let userAId: string;

  beforeAll(async () => {
    // 1. Create Isolated Tenant A & Tenant B Fixtures
    const companyA = await prisma.company.create({
      data: {
        code: `SEC-CO-A-${Date.now()}`,
        name: 'Tenant Alpha Corp',
        legalName: 'Tenant Alpha Corp Ltd',
        contactEmail: `admin@alpha-${Date.now()}.com`
      }
    });
    tenantACompanyId = companyA.id;

    const companyB = await prisma.company.create({
      data: {
        code: `SEC-CO-B-${Date.now()}`,
        name: 'Tenant Beta Corp',
        legalName: 'Tenant Beta Corp Ltd',
        contactEmail: `admin@beta-${Date.now()}.com`
      }
    });
    tenantBCompanyId = companyB.id;

    // Branches & Departments
    const branchA = await prisma.branch.create({
      data: { companyId: tenantACompanyId, code: 'BR-A', name: 'Branch A', state: 'Maharashtra', city: 'Mumbai' }
    });
    const deptA = await prisma.department.create({
      data: { companyId: tenantACompanyId, code: 'D-A', name: 'Engineering' }
    });
    const desigA = await prisma.designation.create({
      data: { companyId: tenantACompanyId, code: 'DES-A', name: 'Engineer' }
    });

    const branchB = await prisma.branch.create({
      data: { companyId: tenantBCompanyId, code: 'BR-B', name: 'Branch B', state: 'Delhi', city: 'New Delhi' }
    });
    const deptB = await prisma.department.create({
      data: { companyId: tenantBCompanyId, code: 'D-B', name: 'Sales' }
    });
    const desigB = await prisma.designation.create({
      data: { companyId: tenantBCompanyId, code: 'DES-B', name: 'Executive' }
    });

    // Employees
    const empA = await prisma.employee.create({
      data: {
        companyId: tenantACompanyId,
        branchId: branchA.id,
        departmentId: deptA.id,
        designationId: desigA.id,
        employeeCode: `EMP-A-${Date.now()}`,
        firstName: 'Alice',
        lastName: 'Alpha',
        workEmail: `alice@alpha-${Date.now()}.com`,
        dateOfJoining: new Date('2025-01-01')
      }
    });
    tenantAEmployeeId = empA.id;

    const empB = await prisma.employee.create({
      data: {
        companyId: tenantBCompanyId,
        branchId: branchB.id,
        departmentId: deptB.id,
        designationId: desigB.id,
        employeeCode: `EMP-B-${Date.now()}`,
        firstName: 'Bob',
        lastName: 'Beta',
        workEmail: `bob@beta-${Date.now()}.com`,
        dateOfJoining: new Date('2025-01-01')
      }
    });
    tenantBEmployeeId = empB.id;

    // Admin Users with Roles
    const roleAdmin = await prisma.role.findFirst({ where: { name: 'company_admin' } }) ||
      await prisma.role.create({ data: { name: 'company_admin', description: 'Admin' } });
    const roleFinance = await prisma.role.findFirst({ where: { name: 'finance_admin' } }) ||
      await prisma.role.create({ data: { name: 'finance_admin', description: 'Finance' } });
    const rolePayroll = await prisma.role.findFirst({ where: { name: 'payroll_admin' } }) ||
      await prisma.role.create({ data: { name: 'payroll_admin', description: 'Payroll' } });

    // User A (Company Admin Tenant A)
    const userA = await prisma.user.create({
      data: {
        companyId: tenantACompanyId,
        employeeId: tenantAEmployeeId,
        username: `admin_a_${Date.now()}`,
        email: `admin_a_${Date.now()}@alpha.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h', // dummy
        fullName: 'Admin Alpha',
        active: true
      }
    });
    userAId = userA.id;
    await prisma.userRole.create({ data: { userId: userA.id, roleId: roleAdmin.id } });

    // User B (Company Admin Tenant B)
    const userB = await prisma.user.create({
      data: {
        companyId: tenantBCompanyId,
        employeeId: tenantBEmployeeId,
        username: `admin_b_${Date.now()}`,
        email: `admin_b_${Date.now()}@beta.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Admin Beta',
        active: true
      }
    });
    await prisma.userRole.create({ data: { userId: userB.id, roleId: roleAdmin.id } });

    // Distinct Validator and Approver for SOD Verification
    const validatorUser = await prisma.user.create({
      data: {
        companyId: tenantACompanyId,
        username: `validator_${Date.now()}`,
        email: `validator_${Date.now()}@alpha.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Priya Validator',
        active: true
      }
    });
    await prisma.userRole.create({ data: { userId: validatorUser.id, roleId: rolePayroll.id } });

    const approverUser = await prisma.user.create({
      data: {
        companyId: tenantACompanyId,
        username: `approver_${Date.now()}`,
        email: `approver_${Date.now()}@alpha.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Rajesh Finance Head',
        active: true
      }
    });
    await prisma.userRole.create({ data: { userId: approverUser.id, roleId: roleFinance.id } });

    // Create Tokens
    const jwt = (await import('jsonwebtoken')).default;
    const { ENV } = await import('../src/config/env.js');

    tenantAToken = jwt.sign({ userId: userA.id, companyId: tenantACompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });
    tenantBToken = jwt.sign({ userId: userB.id, companyId: tenantBCompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });
    validatorToken = jwt.sign({ userId: validatorUser.id, companyId: tenantACompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });
    approverToken = jwt.sign({ userId: approverUser.id, companyId: tenantACompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });

    // Create Payroll Period and Run for Tenant A
    const periodA = await prisma.payrollPeriod.create({
      data: {
        companyId: tenantACompanyId,
        periodNumber: 1,
        name: `Period-${Date.now()}`,
        month: 10,
        year: 2026,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        cutoffDate: new Date('2026-10-25')
      }
    });

    const runA = await prisma.corporatePayrollRun.create({
      data: {
        companyId: tenantACompanyId,
        periodId: periodA.id,
        runNumber: `RUN-A-${Date.now()}`,
        status: 'REVIEWED',
        totalEmployees: 1,
        totalGross: 50000,
        totalNetPay: 45000,
        validatedBy: 'Priya Validator',
        reviewedBy: 'Priya Validator'
      }
    });
    tenantARunId = runA.id;

    // Create Loan Type and Loan in Tenant A
    const lType = await prisma.loanType.create({
      data: {
        companyId: tenantACompanyId,
        code: `LT-${Date.now()}`,
        name: 'Relocation Loan',
        maxAmount: 100000,
        maxTenureMonths: 12,
        interestRatePct: 0
      }
    });
    tenantALoanTypeId = lType.id;

    const loanA = await prisma.employeeLoan.create({
      data: {
        employeeId: tenantAEmployeeId,
        loanTypeId: lType.id,
        principalAmount: 24000,
        monthlyEmi: 2000,
        tenureMonths: 12,
        recoveredAmount: 0,
        outstandingAmount: 24000,
        status: 'ACTIVE'
      }
    });
    tenantALoanId = loanA.id;
  });

  afterAll(async () => {
    // Isolated Cleanup: Delete only synthetic fixtures by companyId
    if (tenantACompanyId) {
      await prisma.company.delete({ where: { id: tenantACompanyId } }).catch(() => {});
    }
    if (tenantBCompanyId) {
      await prisma.company.delete({ where: { id: tenantBCompanyId } }).catch(() => {});
    }
  });

  describe('1. Cross-Tenant Boundaries (SEC-TEN-001 & SEC-TEN-002)', () => {
    it('strictly prevents Tenant B admin from validating Tenant A payroll run (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${tenantARunId}/validate`)
        .set('Authorization', `Bearer ${tenantBToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error?.message).toMatch(/not found/i);
    });

    it('strictly prevents Tenant B admin from calculating Tenant A payroll run (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${tenantARunId}/calculate`)
        .set('Authorization', `Bearer ${tenantBToken}`);
      expect(res.status).toBe(404);
    });

    it('strictly prevents Tenant B admin from approving Tenant A payroll run (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${tenantARunId}/approve`)
        .set('Authorization', `Bearer ${tenantBToken}`);
      expect(res.status).toBe(404);
    });

    it('strictly prevents Tenant B admin from updating Tenant A loan status (404)', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${tenantALoanId}/status`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBe(404);
    });

    it('strictly prevents Tenant B admin from querying Tenant A loan repayment schedule (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/loans/${tenantALoanId}/repayments`)
        .set('Authorization', `Bearer ${tenantBToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('2. Segregation of Duties (SEC-SOD-001)', () => {
    it('strictly rejects payroll approval if approving user also validated/reviewed the run when SOD is enforced', async () => {
      // Validator (Priya Validator) attempts to approve her own reviewed run
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${tenantARunId}/approve`)
        .set('Authorization', `Bearer ${validatorToken}`)
        .set('x-enforce-sod', 'true');

      // Either role rejection (since validator only has payroll_admin) or SOD violation
      expect([403, 400]).toContain(res.status);
    });

    it('allows independent finance executive to approve the reviewed run', async () => {
      const res = await request(app)
        .post(`/api/v1/payroll/runs/${tenantARunId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .set('x-enforce-sod', 'true');

      expect(res.status).toBe(200);
      expect(res.body.run.status).toBe('APPROVED');
      expect(res.body.run.approvedBy).toBe('Rajesh Finance Head');
    });
  });

  describe('3. Loan Self-Sanctioning Prevention (SEC-SOD-002)', () => {
    it('strictly prevents privileged user from creating/sanctioning an active loan for themselves', async () => {
      const res = await request(app)
        .post('/api/v1/loans/apply')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          employeeId: tenantAEmployeeId,
          loanTypeId: tenantALoanTypeId,
          principalAmount: 30000,
          tenureMonths: 6
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/self-sanctioning prohibited/i);
    });

    it('strictly prevents privileged user from activating their own loan via status patch (403)', async () => {
      // Create a pending loan for tenantAEmployeeId
      const pendingLoan = await prisma.employeeLoan.create({
        data: {
          employeeId: tenantAEmployeeId,
          loanTypeId: tenantALoanTypeId,
          principalAmount: 20000,
          monthlyEmi: 2000,
          tenureMonths: 10,
          recoveredAmount: 0,
          outstandingAmount: 20000,
          status: 'PENDING'
        }
      });

      const jwt = (await import('jsonwebtoken')).default;
      const { ENV } = await import('../src/config/env.js');
      const adminSelfToken = jwt.sign(
        { userId: userAId, companyId: tenantACompanyId, employeeId: tenantAEmployeeId, roles: ['company_admin'] },
        ENV.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .patch(`/api/v1/loans/${pendingLoan.id}/status`)
        .set('Authorization', `Bearer ${adminSelfToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/self-sanctioning prohibited/i);
    });
  });

  describe('4. Self-Approval & Tenant Isolation in Leave Management (SEC-SOD-003)', () => {
    it('strictly prevents user from approving their own leave request (403)', async () => {
      const policyA = await prisma.leavePolicy.create({
        data: {
          companyId: tenantACompanyId,
          code: `LP-A-${Date.now()}`,
          name: 'Annual Paid Leave',
          annualQuota: 20,
          isPaid: true
        }
      });

      const leaveReq = await prisma.leaveRequest.create({
        data: {
          employeeId: tenantAEmployeeId,
          leavePolicyId: policyA.id,
          fromDate: new Date('2026-06-01'),
          toDate: new Date('2026-06-03'),
          totalDays: 3,
          reason: 'Personal vacation',
          status: 'PENDING'
        }
      });

      const jwt = (await import('jsonwebtoken')).default;
      const { ENV } = await import('../src/config/env.js');
      const adminSelfToken = jwt.sign(
        { userId: userAId, companyId: tenantACompanyId, employeeId: tenantAEmployeeId, roles: ['company_admin'] },
        ENV.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Tenant A admin (with employeeId = tenantAEmployeeId) attempts self-approval
      const res = await request(app)
        .post(`/api/v1/leave/requests/${leaveReq.id}/action`)
        .set('Authorization', `Bearer ${adminSelfToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/cannot approve your own leave/i);
    });

    it('strictly prevents Tenant B admin from approving Tenant A leave request (404)', async () => {
      const policyA = await prisma.leavePolicy.findFirst({ where: { companyId: tenantACompanyId } });
      const leaveReq = await prisma.leaveRequest.create({
        data: {
          employeeId: tenantAEmployeeId,
          leavePolicyId: policyA!.id,
          fromDate: new Date('2026-07-01'),
          toDate: new Date('2026-07-02'),
          totalDays: 2,
          reason: 'Sick leave',
          status: 'PENDING'
        }
      });

      const res = await request(app)
        .post(`/api/v1/leave/requests/${leaveReq.id}/action`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(404);
    });
  });

  describe('5. Self-Approval & Tenant Isolation in Expense Claims (SEC-SOD-004)', () => {
    it('strictly prevents user from approving their own expense claim (403)', async () => {
      const claim = await prisma.expenseClaim.create({
        data: {
          employeeId: tenantAEmployeeId,
          title: 'Client Lunch',
          claimDate: new Date('2026-06-15'),
          totalAmount: 1500,
          status: 'PENDING'
        }
      });

      const jwt = (await import('jsonwebtoken')).default;
      const { ENV } = await import('../src/config/env.js');
      const adminSelfToken = jwt.sign(
        { userId: userAId, companyId: tenantACompanyId, employeeId: tenantAEmployeeId, roles: ['company_admin'] },
        ENV.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post(`/api/v1/expenses/claims/${claim.id}/action`)
        .set('Authorization', `Bearer ${adminSelfToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/cannot approve your own expense/i);
    });

    it('strictly prevents Tenant B admin from approving Tenant A expense claim (404)', async () => {
      const claim = await prisma.expenseClaim.create({
        data: {
          employeeId: tenantAEmployeeId,
          title: 'Office Supplies',
          claimDate: new Date('2026-06-16'),
          totalAmount: 3200,
          status: 'PENDING'
        }
      });

      const res = await request(app)
        .post(`/api/v1/expenses/claims/${claim.id}/action`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(404);
    });
  });
});

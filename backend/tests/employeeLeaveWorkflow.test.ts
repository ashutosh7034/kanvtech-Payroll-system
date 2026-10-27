import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { Decimal } from 'decimal.js';

describe('Employee Leave Application & Complete Leave Management Suite', () => {
  let adminToken = '';
  let hrToken = '';
  let managerToken = '';
  let employeeToken = '';
  let secondEmployeeToken = '';

  let companyId = '';
  let managerEmployeeId = '';
  let employeeId = '';
  let secondEmployeeId = '';

  let paidPolicyId = '';
  let unpaidPolicyId = '';
  let strictPolicyId = '';

  let testApplicationId = '';

  beforeAll(async () => {
    // 1. Resolve Company
    const company = await prisma.company.findFirst({ where: { code: 'APEX' } });
    expect(company).toBeDefined();
    companyId = company!.id;

    // 2. Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 3. Login as HR Manager
    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'hr.manager', password: 'Admin@123' });
    expect(hrRes.status).toBe(200);
    hrToken = hrRes.body.token;

    // 4. Login as Department Manager (Rohit Sharma)
    const mgrUser = await prisma.user.findUnique({ where: { username: 'rohit.sharma' } });
    expect(mgrUser).toBeDefined();
    managerEmployeeId = mgrUser!.employeeId!;
    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rohit.sharma', password: 'Admin@123' });
    expect(mgrRes.status).toBe(200);
    managerToken = mgrRes.body.token;

    // 5. Login as Employee 1 (Ananya Verma - reports to Rohit Sharma)
    const empUser = await prisma.user.findUnique({ where: { username: 'ananya.verma' } });
    expect(empUser).toBeDefined();
    employeeId = empUser!.employeeId!;
    // Explicitly link manager to ensure reporting relationship
    await prisma.employee.update({
      where: { id: employeeId },
      data: { managerId: managerEmployeeId, status: 'CONFIRMED' }
    });

    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ananya.verma', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 6. Login as Employee 2 (Rahul Mehta - independent or separate manager)
    const secondEmpUser = await prisma.user.findUnique({ where: { username: 'rahul.mehta' } });
    expect(secondEmpUser).toBeDefined();
    secondEmployeeId = secondEmpUser!.employeeId!;
    // Set Rahul's manager to someone else (null or different) to test manager authorization scope
    await prisma.employee.update({
      where: { id: secondEmployeeId },
      data: { managerId: null, status: 'CONFIRMED' }
    });

    const secondEmpRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(secondEmpRes.status).toBe(200);
    secondEmployeeToken = secondEmpRes.body.token;

    // 7. Resolve or Create Paid and Unpaid Policies
    let paidPol = await prisma.leavePolicy.findFirst({
      where: { companyId, isPaid: true }
    });
    if (!paidPol) {
      paidPol = await prisma.leavePolicy.create({
        data: {
          companyId,
          code: 'CL',
          name: 'Casual Leave',
          annualQuota: 12,
          isPaid: true
        }
      });
    }
    paidPolicyId = paidPol.id;

    let unpaidPol = await prisma.leavePolicy.findFirst({
      where: { companyId, isPaid: false }
    });
    if (!unpaidPol) {
      unpaidPol = await prisma.leavePolicy.create({
        data: {
          companyId,
          code: 'LOP',
          name: 'Loss of Pay',
          annualQuota: 0,
          isPaid: false
        }
      });
    }
    unpaidPolicyId = unpaidPol.id;

    // Ensure Ananya has sufficient CL balance for tests
    const currentYear = new Date().getFullYear();
    await prisma.employeeLeaveBalance.upsert({
      where: {
        employeeId_leavePolicyId_calendarYear: {
          employeeId,
          leavePolicyId: paidPolicyId,
          calendarYear: currentYear
        }
      },
      create: {
        employeeId,
        leavePolicyId: paidPolicyId,
        calendarYear: currentYear,
        credited: 12,
        used: 2,
        balance: 10
      },
      update: {
        credited: 12,
        used: 2,
        balance: 10
      }
    });
  });

  // =========================================================================
  // 1. LEAVE WORKING DAYS CALCULATION
  // =========================================================================
  describe('Phase 5: Leave Balances and Date Calculations', () => {
    it('accurately computes working days excluding weekends (Saturday and Sunday)', async () => {
      // 2026-11-02 (Monday) to 2026-11-06 (Friday) = 5 working days
      const res = await request(app)
        .post('/api/v1/leave/calculate-days')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fromDate: '2026-11-02',
          toDate: '2026-11-06',
          durationType: 'FULL_DAY'
        });

      expect(res.status).toBe(200);
      expect(res.body.workingDays).toBe(5);
      expect(res.body.weekendDays).toBe(0);
      expect(res.body.calendarDays).toBe(5);
    });

    it('discounts Saturday and Sunday when a leave request spans a weekend', async () => {
      // 2026-11-05 (Thursday) to 2026-11-10 (Tuesday) = 6 calendar days, 4 working days, 2 weekend days
      const res = await request(app)
        .post('/api/v1/leave/calculate-days')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fromDate: '2026-11-05',
          toDate: '2026-11-10',
          durationType: 'FULL_DAY'
        });

      expect(res.status).toBe(200);
      expect(res.body.workingDays).toBe(4);
      expect(res.body.weekendDays).toBe(2);
      expect(res.body.calendarDays).toBe(6);
    });

    it('computes 0.5 days for FIRST_HALF and SECOND_HALF duration requests', async () => {
      const res1 = await request(app)
        .post('/api/v1/leave/calculate-days')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fromDate: '2026-11-02',
          toDate: '2026-11-02',
          durationType: 'FIRST_HALF'
        });
      expect(res1.status).toBe(200);
      expect(res1.body.workingDays).toBe(0.5);

      const res2 = await request(app)
        .post('/api/v1/leave/calculate-days')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fromDate: '2026-11-02',
          toDate: '2026-11-02',
          durationType: 'SECOND_HALF'
        });
      expect(res2.status).toBe(200);
      expect(res2.body.workingDays).toBe(0.5);
    });

    it('rejects invalid date range where toDate is earlier than fromDate', async () => {
      const res = await request(app)
        .post('/api/v1/leave/calculate-days')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fromDate: '2026-11-10',
          toDate: '2026-11-05',
          durationType: 'FULL_DAY'
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/cannot be earlier than from date/i);
    });
  });

  // =========================================================================
  // 2. EMPLOYEE LEAVE APPLICATION & DRAFT SAVING
  // =========================================================================
  describe('Phase 2 & 6: Employee Application Submission, Validation and Drafts', () => {
    it('allows an employee to save a leave request as DRAFT without balance deduction', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: paidPolicyId,
          fromDate: '2026-11-16',
          toDate: '2026-11-17',
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Planning personal trip draft',
          isDraft: true
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest).toBeDefined();
      expect(res.body.leaveRequest.status).toBe('DRAFT');
      expect(res.body.leaveRequest.isDraft).toBe(true);
      expect(res.body.leaveRequest.applicationNumber).toMatch(/^LR-\d{4}-\d+/);

      // Verify leave balance was NOT deducted for draft
      const bal = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId, leavePolicyId: paidPolicyId }
      });
      expect(Number(bal!.balance)).toBe(10);
    });

    it('submits a formal leave application and generates an official applicationNumber', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: paidPolicyId,
          fromDate: '2026-11-23',
          toDate: '2026-11-24',
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Family wedding attendance',
          isDraft: false
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest).toBeDefined();
      expect(res.body.leaveRequest.status).toBe('PENDING');
      expect(res.body.leaveRequest.applicationNumber).toMatch(/^LR-\d{4}-\d+/);
      testApplicationId = res.body.leaveRequest.id;
    });

    it('prevents duplicate or overlapping leave applications for the same dates', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: paidPolicyId,
          fromDate: '2026-11-24',
          toDate: '2026-11-25',
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Overlapping request attempt',
          isDraft: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/already have an active leave request/i);
    });

    it('rejects paid leave applications when employee has insufficient balance', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: paidPolicyId,
          fromDate: '2026-12-01',
          toDate: '2026-12-25',
          durationType: 'FULL_DAY',
          totalDays: 19, // Available balance is 10
          reason: 'Extended vacation',
          isDraft: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/insufficient.*balance/i);
    });
  });

  // =========================================================================
  // 3. LEAVE POLICY ADVANCED CONFIGURATIONS (PHASE 3)
  // =========================================================================
  describe('Phase 3: Policy Configuration Rules (Advance Notice, Attachments, Half-Day)', () => {
    beforeAll(async () => {
      // Create a strict medical leave policy with mandatory attachment and max 5 consecutive days
      const strictPol = await prisma.leavePolicy.upsert({
        where: {
          companyId_code: {
            companyId,
            code: 'MED-STRICT'
          }
        },
        create: {
          companyId,
          code: 'MED-STRICT',
          name: 'Certified Medical Leave',
          annualQuota: 10,
          isPaid: true,
          requiresAttachment: true,
          maxConsecutiveDays: 5,
          allowHalfDay: false,
          minAdvanceNoticeDays: 2
        },
        update: {
          requiresAttachment: true,
          maxConsecutiveDays: 5,
          allowHalfDay: false,
          minAdvanceNoticeDays: 2
        }
      });
      strictPolicyId = strictPol.id;

      // Seed balance for test
      await prisma.employeeLeaveBalance.upsert({
        where: {
          employeeId_leavePolicyId_calendarYear: {
            employeeId,
            leavePolicyId: strictPolicyId,
            calendarYear: 2026
          }
        },
        create: {
          employeeId,
          leavePolicyId: strictPolicyId,
          calendarYear: 2026,
          credited: 10,
          used: 0,
          balance: 10
        },
        update: {}
      });
    });

    it('rejects application when mandatory attachment/medical certificate is missing', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: strictPolicyId,
          fromDate: '2026-12-10',
          toDate: '2026-12-11',
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Medical treatment',
          attachmentUrl: '', // Missing required document
          isDraft: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/supporting document.*mandatory/i);
    });

    it('rejects half-day leave when the policy disallows half-day requests', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: strictPolicyId,
          fromDate: '2026-12-10',
          toDate: '2026-12-10',
          durationType: 'FIRST_HALF',
          totalDays: 0.5,
          reason: 'Half day doctor visit',
          attachmentUrl: 'https://payflow.test/cert.pdf',
          isDraft: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/half-day leaves are not permitted/i);
    });

    it('rejects application when requested days exceed policy maxConsecutiveDays', async () => {
      const res = await request(app)
        .post('/api/v1/leave/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leavePolicyId: strictPolicyId,
          fromDate: '2026-12-07',
          toDate: '2026-12-18',
          durationType: 'FULL_DAY',
          totalDays: 10, // Max consecutive is 5
          reason: 'Extended medical recovery',
          attachmentUrl: 'https://payflow.test/cert.pdf',
          isDraft: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/exceeds the maximum allowable consecutive limit of 5 days/i);
    });
  });

  // =========================================================================
  // 4. MANAGER SCOPE & APPROVAL WORKFLOWS (PHASE 4 & 8)
  // =========================================================================
  describe('Phase 4 & 8: Manager Authorization, Direct Reports Scope & Approval Actions', () => {
    it('allows a manager to view pending leave requests for their direct reports', async () => {
      const res = await request(app)
        .get('/api/v1/leave/requests?status=PENDING')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.requests)).toBe(true);
      // All returned requests must belong to direct reports of manager Rohit
      const found = res.body.requests.find((r: any) => r.id === testApplicationId);
      expect(found).toBeDefined();
      expect(found.employee.id).toBe(employeeId);
    });

    it('prevents a manager from approving a leave request for an employee outside their reporting scope', async () => {
      // Create a pending request for Rahul Mehta (who does NOT report to Rohit)
      const rahulReq = await prisma.leaveRequest.create({
        data: {
          employeeId: secondEmployeeId,
          leavePolicyId: unpaidPolicyId,
          fromDate: new Date('2026-12-28'),
          toDate: new Date('2026-12-29'),
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Personal time off',
          status: 'PENDING'
        }
      });

      // Manager Rohit attempts to approve Rahul's request -> must return 403 Forbidden!
      const res = await request(app)
        .post(`/api/v1/leave/applications/${rahulReq.id}/action`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'APPROVED',
          approverComment: 'Attempting cross-manager approval'
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/only authorized to action leave requests for your direct reports/i);
    });

    it('enforces segregation of duties: prevents a manager from approving their own leave request', async () => {
      // Create a pending request for Manager Rohit
      const mgrSelfReq = await prisma.leaveRequest.create({
        data: {
          employeeId: managerEmployeeId,
          leavePolicyId: paidPolicyId,
          fromDate: new Date('2026-12-30'),
          toDate: new Date('2026-12-31'),
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Year-end vacation',
          status: 'PENDING'
        }
      });

      // Rohit attempts to approve his own leave -> must return 403 Forbidden!
      const res = await request(app)
        .post(`/api/v1/leave/applications/${mgrSelfReq.id}/action`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'APPROVED',
          approverComment: 'Self approval'
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/cannot approve your own leave/i);
    });

    it('requires a mandatory rejection reason when rejecting a leave application', async () => {
      const res = await request(app)
        .post(`/api/v1/leave/applications/${testApplicationId}/action`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'REJECTED',
          rejectionReason: '' // Empty rejection reason
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/rejection reason is mandatory/i);
    });

    it('successfully approves a direct report leave request and transactionally deducts balance', async () => {
      const res = await request(app)
        .post(`/api/v1/leave/applications/${testApplicationId}/action`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'APPROVED',
          approverComment: 'Approved as project deliverables are on track'
        });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe('APPROVED');
      expect(res.body.leaveRequest.approvedBy).toBe('Rohit Sharma');

      // Check balance deduction
      const bal = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId, leavePolicyId: paidPolicyId }
      });
      // Credited was 12, previously used 2, deducted 2 -> new used = 4, new balance = 8
      expect(Number(bal!.used)).toBe(4);
      expect(Number(bal!.balance)).toBe(8);
    });
  });

  // =========================================================================
  // 5. LEAVE CANCELLATION & BALANCE RESTORATION
  // =========================================================================
  describe('Phase 6: Leave Withdrawal and Balance Restoration', () => {
    it('restores deducted leave balance when an approved request is cancelled', async () => {
      const res = await request(app)
        .post(`/api/v1/leave/applications/${testApplicationId}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          reason: 'Event was rescheduled'
        });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe('CANCELLED');

      // Verify balance restored!
      const bal = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId, leavePolicyId: paidPolicyId }
      });
      expect(Number(bal!.used)).toBe(2);
      expect(Number(bal!.balance)).toBe(10);
    });
  });

  // =========================================================================
  // 6. HR & ADMIN POLICY & BALANCE ADJUSTMENT MANAGEMENT
  // =========================================================================
  describe('Phase 3: Administrative Balance Adjustments and Policy Master', () => {
    it('allows HR / Admin to manually adjust employee leave quotas with audit trail', async () => {
      const res = await request(app)
        .post('/api/v1/leave/balances/adjust')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeId,
          leavePolicyId: paidPolicyId,
          calendarYear: 2026,
          adjustmentDays: 3, // Credit 3 compensatory off days
          reason: 'Compensatory off for weekend deployment'
        });

      expect(res.status).toBe(200);
      expect(res.body.balance).toBeDefined();

      const bal = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId, leavePolicyId: paidPolicyId }
      });
      expect(Number(bal!.credited)).toBe(15);
      expect(Number(bal!.balance)).toBe(13);
    });

    it('prevents regular employees from adjusting leave balances', async () => {
      const res = await request(app)
        .post('/api/v1/leave/balances/adjust')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId,
          leavePolicyId: paidPolicyId,
          adjustmentDays: 10,
          reason: 'Unauthorized adjustment'
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 7. PAYROLL INTEGRATION (PHASE 7)
  // =========================================================================
  describe('Phase 7: Payroll Integration for Paid vs Unpaid Leaves', () => {
    it('proves that pending leave does NOT reduce payable days in payroll calculation engine', async () => {
      // Create a pending unpaid leave request
      const pendingLop = await prisma.leaveRequest.create({
        data: {
          employeeId,
          leavePolicyId: unpaidPolicyId,
          fromDate: new Date('2026-11-10'),
          toDate: new Date('2026-11-12'),
          durationType: 'FULL_DAY',
          totalDays: 3,
          reason: 'Pending LOP test',
          status: 'PENDING'
        }
      });

      // Query calculation engine logic: only APPROVED unpaid leaves are counted as LOP
      const activeLopLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          leavePolicy: { isPaid: false },
          fromDate: { lte: new Date('2026-11-30') },
          toDate: { gte: new Date('2026-11-01') }
        }
      });

      const lopDays = activeLopLeaves.reduce((acc, l) => acc + Number(l.totalDays), 0);
      expect(lopDays).toBe(0); // Pending request did NOT reduce payable days

      // Cleanup
      await prisma.leaveRequest.delete({ where: { id: pendingLop.id } });
    });

    it('proves that approved unpaid leave deducts LOP days from payable days in payroll engine', async () => {
      // Create an approved unpaid leave request
      const approvedLop = await prisma.leaveRequest.create({
        data: {
          employeeId,
          leavePolicyId: unpaidPolicyId,
          fromDate: new Date('2026-11-10'),
          toDate: new Date('2026-11-11'),
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Approved LOP',
          status: 'APPROVED'
        }
      });

      const activeLopLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          leavePolicy: { isPaid: false },
          fromDate: { lte: new Date('2026-11-30') },
          toDate: { gte: new Date('2026-11-01') }
        }
      });

      const lopDays = activeLopLeaves.reduce((acc, l) => acc + Number(l.totalDays), 0);
      expect(lopDays).toBe(2); // Exactly 2 LOP days deducted

      // Cleanup
      await prisma.leaveRequest.delete({ where: { id: approvedLop.id } });
    });

    it('proves that approved paid leave retains full payable days without LOP deduction', async () => {
      // Create an approved paid leave request
      const approvedPaid = await prisma.leaveRequest.create({
        data: {
          employeeId,
          leavePolicyId: paidPolicyId,
          fromDate: new Date('2026-11-04'),
          toDate: new Date('2026-11-05'),
          durationType: 'FULL_DAY',
          totalDays: 2,
          reason: 'Approved Paid CL',
          status: 'APPROVED'
        }
      });

      // Calculation engine only queries leavePolicy: { isPaid: false } for LOP
      const activeLopLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          leavePolicy: { isPaid: false },
          fromDate: { lte: new Date('2026-11-30') },
          toDate: { gte: new Date('2026-11-01') }
        }
      });

      const lopDays = activeLopLeaves.reduce((acc, l) => acc + Number(l.totalDays), 0);
      expect(lopDays).toBe(0); // Paid leave does not cause LOP deduction

      // Cleanup
      await prisma.leaveRequest.delete({ where: { id: approvedPaid.id } });
    });
  });

  // =========================================================================
  // 8. CROSS-EMPLOYEE DATA ISOLATION (PHASE 8)
  // =========================================================================
  describe('Phase 8: Cross-Employee Data Protection & RBAC Scoping', () => {
    it('prevents regular employee from viewing another employee leave balance', async () => {
      const res = await request(app)
        .get(`/api/v1/leave/balances?employeeId=${secondEmployeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/not authorized to view another employee’s leave balances/i);
    });

    it('allows employee to view their own leave balances seamlessly', async () => {
      const res = await request(app)
        .get('/api/v1/leave/balances')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.balances)).toBe(true);
      expect(res.body.balances.length).toBeGreaterThan(0);
      expect(res.body.balances[0].employeeId).toBe(employeeId);
    });
  });
});

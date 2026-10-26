import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

describe('Corporate Expense Management, Reimbursements & HR/Admin Visibility Suite', () => {
  let adminToken = '';
  let hrToken = '';
  let employeeToken = '';
  let secondEmployeeToken = '';
  let unlinkedAdminToken = '';

  let companyId = '';
  let tenantBCompanyId = '';
  let tenantBAdminToken = '';

  let employeeId = '';
  let secondEmployeeId = '';
  let unlinkedUserId = '';

  let categoryTravelId = '';
  let categoryMealsId = '';

  let createdClaimId = '';
  let createdClaimNumber = '';

  beforeAll(async () => {
    // 1. Resolve Company
    const company = await prisma.company.findFirst({ where: { code: 'APEX' } });
    expect(company).toBeDefined();
    companyId = company!.id;

    // 2. Resolve or create categories
    const categories = await prisma.expenseCategory.findMany({ where: { companyId } });
    if (categories.length > 0) {
      categoryTravelId = categories[0].id;
      categoryMealsId = categories.length > 1 ? categories[1].id : categories[0].id;
    } else {
      const cat1 = await prisma.expenseCategory.create({
        data: { companyId, code: 'TEST-TRAVEL', name: 'Business Travel', maxLimit: 50000 }
      });
      const cat2 = await prisma.expenseCategory.create({
        data: { companyId, code: 'TEST-MEAL', name: 'Client Meal', maxLimit: 5000 }
      });
      categoryTravelId = cat1.id;
      categoryMealsId = cat2.id;
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

    // 5. Login as Employee (Rahul Mehta)
    const empUser = await prisma.user.findUnique({ where: { username: 'rahul.mehta' } });
    expect(empUser).toBeDefined();
    employeeId = empUser!.employeeId!;
    // Ensure Rahul is CONFIRMED
    await prisma.employee.update({ where: { id: employeeId }, data: { status: 'CONFIRMED' } });

    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 6. Login as Second Employee (Ananya Verma)
    const secondEmpUser = await prisma.user.findUnique({ where: { username: 'ananya.verma' } });
    expect(secondEmpUser).toBeDefined();
    secondEmployeeId = secondEmpUser!.employeeId!;
    await prisma.employee.update({ where: { id: secondEmployeeId }, data: { status: 'CONFIRMED' } });

    const secondEmpRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ananya.verma', password: 'Admin@123' });
    expect(secondEmpRes.status).toBe(200);
    secondEmployeeToken = secondEmpRes.body.token;

    // 7. Create an unlinked user for association testing
    const pwHash = await bcrypt.hash('Admin@123', 10);
    const unlinkedUser = await prisma.user.upsert({
      where: { username: 'contractor.advisor' },
      update: { employeeId: null },
      create: {
        companyId,
        username: 'contractor.advisor',
        email: 'contractor.advisor@external.apexglobal.tech',
        fullName: 'Independent Advisor',
        passwordHash: pwHash,
        active: true
      }
    });
    unlinkedUserId = unlinkedUser.id;

    const unlinkedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'contractor.advisor', password: 'Admin@123' });
    unlinkedAdminToken = unlinkedLogin.body.token;

    // 8. Create Tenant B for cross-tenant isolation testing
    const tenantB = await prisma.company.upsert({
      where: { code: 'TENANT-B-TEST' },
      update: {},
      create: {
        code: 'TENANT-B-TEST',
        name: 'Tenant B Technologies Ltd',
        legalName: 'Tenant B Legal Entity',
        contactEmail: 'admin@tenantb.test',
        active: true
      }
    });
    tenantBCompanyId = tenantB.id;

    const roleAdmin = await prisma.role.findUnique({ where: { name: 'company_admin' } });
    const userTenantB = await prisma.user.upsert({
      where: { username: 'admin.tenantb' },
      update: {},
      create: {
        companyId: tenantBCompanyId,
        username: 'admin.tenantb',
        email: 'admin@tenantb.test',
        fullName: 'Tenant B Administrator',
        passwordHash: pwHash,
        active: true,
        userRoles: {
          create: [{ roleId: roleAdmin!.id }]
        }
      }
    });

    const tenantBLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin.tenantb', password: 'Admin@123' });
    tenantBAdminToken = tenantBLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup synthetic test records
    await prisma.inAppNotification.deleteMany({
      where: { companyId: { in: [companyId, tenantBCompanyId] } }
    });
    await prisma.expenseClaim.deleteMany({
      where: { title: { startsWith: '[TEST]' } }
    });
    await prisma.user.deleteMany({
      where: { username: { in: ['contractor.advisor', 'admin.tenantb'] } }
    });
    await prisma.company.deleteMany({
      where: { code: 'TENANT-B-TEST' }
    });
  });

  // ============================================================================
  // PHASE 2 & 3: User-to-Employee Association & Expense Submission
  // ============================================================================

  it('rejects reimbursement submission from an unlinked user with a clear, actionable error (400)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${unlinkedAdminToken}`)
      .send({
        title: '[TEST] Unlinked Contractor Submission',
        claimDate: '2026-10-26',
        items: [{ categoryId: categoryTravelId, amount: 2500, description: 'Consulting cab' }]
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('UNLINKED_EMPLOYEE');
    expect(res.body.error?.message).toMatch(/not associated with an employee profile/i);
    expect(res.body.error?.message).toMatch(/Administrative Resolution/i);
  });

  it('rejects submission when employee record is inactive (e.g. EXITED or SUSPENDED) (403)', async () => {
    // Temporarily mark Rahul as EXITED
    await prisma.employee.update({ where: { id: employeeId }, data: { status: 'EXITED' } });

    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Exited Employee Claim',
        claimDate: '2026-10-26',
        items: [{ categoryId: categoryTravelId, amount: 1200 }]
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('INACTIVE_EMPLOYEE');
    expect(res.body.error?.message).toMatch(/inactive/i);

    // Restore to CONFIRMED
    await prisma.employee.update({ where: { id: employeeId }, data: { status: 'CONFIRMED' } });
  });

  it('submits a valid expense claim with multiple line items, calculates total deterministically on server (201)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Q4 Client Meeting & Travel',
        claimDate: '2026-10-20',
        totalAmount: 999999, // Tampered client total - server MUST ignore and compute from line items!
        items: [
          {
            categoryId: categoryTravelId,
            amount: 3200,
            description: 'Airport taxi',
            receiptUrl: 'https://storage.apexglobal.tech/receipts/taxi-001.pdf'
          },
          {
            categoryId: categoryMealsId,
            amount: 1800,
            description: 'Client team dinner',
            receiptUrl: 'https://storage.apexglobal.tech/receipts/dinner-002.pdf'
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.claim).toBeDefined();
    expect(res.body.claim.title).toBe('[TEST] Q4 Client Meeting & Travel');
    expect(Number(res.body.claim.totalAmount)).toBe(5000); // 3200 + 1800 = 5000 exactly
    expect(res.body.claim.items.length).toBe(2);
    expect(res.body.claim.status).toBe('PENDING');
    expect(res.body.claim.claimNumber).toBeDefined();

    createdClaimId = res.body.claim.id;
    createdClaimNumber = res.body.claim.claimNumber;
  });

  it('rejects claim with invalid or negative amounts (400)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Negative Amount Claim',
        claimDate: '2026-10-26',
        items: [{ categoryId: categoryTravelId, amount: -500 }]
      });

    expect(res.status).toBe(400);
  });

  it('rejects claim with category belonging to a different tenant (400)', async () => {
    // Create category in Tenant B
    const catB = await prisma.expenseCategory.create({
      data: { companyId: tenantBCompanyId, code: 'TB-TRAVEL', name: 'Tenant B Travel' }
    });

    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Cross-Tenant Category Tampering',
        claimDate: '2026-10-26',
        items: [{ categoryId: catB.id, amount: 1500 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/invalid or belong to a different company/i);
  });

  it('acknowledges duplicate submission cleanly without crashing or corrupting data (201)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Q4 Client Meeting & Travel',
        claimDate: '2026-10-20',
        items: [
          { categoryId: categoryTravelId, amount: 3200 },
          { categoryId: categoryMealsId, amount: 1800 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.claim.id).toBe(createdClaimId);
    expect(res.body.message).toMatch(/duplicate/i);
  });

  // ============================================================================
  // PHASE 4: Consolidated HR/Admin Expense List & Access Control
  // ============================================================================

  it('allows HR and Admin to access consolidated expense list with pagination and metrics (200)', async () => {
    const res = await request(app)
      .get('/api/v1/expenses/claims?page=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.claims)).toBe(true);
    expect(res.body.claims.some((c: any) => c.id === createdClaimId)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalCount).toBeGreaterThan(0);
    expect(res.body.userContext.isApprover).toBe(true);
  });

  it('supports searching claims by employee name, code, title or claim reference', async () => {
    const res = await request(app)
      .get(`/api/v1/expenses/claims?search=${encodeURIComponent(createdClaimNumber)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.claims.length).toBeGreaterThanOrEqual(1);
    expect(res.body.claims[0].claimNumber).toBe(createdClaimNumber);
  });

  it('filters claims by status (PENDING, APPROVED, REJECTED)', async () => {
    const res = await request(app)
      .get('/api/v1/expenses/claims?status=PENDING')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.claims.every((c: any) => c.status === 'PENDING')).toBe(true);
  });

  it('allows regular employee to see only their own claims (strict boundary enforcement)', async () => {
    const res = await request(app)
      .get('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${secondEmployeeToken}`); // Ananya Verma

    expect(res.status).toBe(200);
    // Ananya should NOT see Rahul's claim
    expect(res.body.claims.some((c: any) => c.id === createdClaimId)).toBe(false);
  });

  it('prevents regular employee from viewing another employee’s claim by direct ID (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/expenses/claims/${createdClaimId}`)
      .set('Authorization', `Bearer ${secondEmployeeToken}`); // Ananya viewing Rahul's claim

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('strictly isolates claims across tenants (Tenant B admin receives 404 when querying Tenant A claim)', async () => {
    const res = await request(app)
      .get(`/api/v1/expenses/claims/${createdClaimId}`)
      .set('Authorization', `Bearer ${tenantBAdminToken}`);

    expect(res.status).toBe(404);
  });

  // ============================================================================
  // PHASE 5: In-App & Email Notifications Verification
  // ============================================================================

  it('creates in-app notifications for eligible HR/Admin reviewers when a claim is submitted', async () => {
    // Check notifications for Admin
    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    expect(adminUser).toBeDefined();

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(notifRes.status).toBe(200);
    expect(Array.isArray(notifRes.body.notifications)).toBe(true);

    const match = notifRes.body.notifications.find(
      (n: any) => n.entityId === createdClaimId
    );
    expect(match).toBeDefined();
    expect(match.title).toMatch(/New Reimbursement Claim/i);
    expect(match.message).toContain('Rahul Mehta');
  });

  it('allows user to mark notifications as read', async () => {
    const listRes = await request(app)
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${adminToken}`);

    if (listRes.body.notifications.length > 0) {
      const first = listRes.body.notifications[0];
      const readRes = await request(app)
        .patch(`/api/v1/notifications/${first.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.notification.isRead).toBe(true);
    }
  });

  // ============================================================================
  // PHASE 6: Review & Approval Workflow
  // ============================================================================

  it('enforces segregation of duties: user cannot approve their own claim (403)', async () => {
    // Rahul attempting to approve his own claim
    const res = await request(app)
      .post(`/api/v1/expenses/claims/${createdClaimId}/action`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'APPROVED' });

    // Rahul has role 'employee', so he is denied by role check or SOD
    expect([403]).toContain(res.status);
  });

  it('requires a clear justification/reason when rejecting a claim (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/expenses/claims/${createdClaimId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED', reason: '' });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/justification or rejection reason is required/i);
  });

  it('allows HR/Admin to approve claim and updates status to APPROVED (200)', async () => {
    const res = await request(app)
      .post(`/api/v1/expenses/claims/${createdClaimId}/action`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe('APPROVED');
    expect(res.body.claim.approvedBy).toBeDefined();

    // Verify claimant received approval notification
    const empNotif = await prisma.inAppNotification.findFirst({
      where: {
        entityId: createdClaimId,
        type: 'EXPENSE_CLAIM_APPROVED'
      }
    });
    expect(empNotif).toBeDefined();
    expect(empNotif?.message).toMatch(/has been approved/i);
  });

  it('supports PATCH /api/v1/expenses/claims/:id/status for frontend parity', async () => {
    // Create a new claim to reject
    const newClaimRes = await request(app)
      .post('/api/v1/expenses/claims')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: '[TEST] Taxi without receipt',
        claimDate: '2026-10-22',
        items: [{ categoryId: categoryTravelId, amount: 650, description: 'Local auto' }]
      });

    expect(newClaimRes.status).toBe(201);
    const claimToRejectId = newClaimRes.body.claim.id;

    const patchRes = await request(app)
      .patch(`/api/v1/expenses/claims/${claimToRejectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'REJECTED',
        reason: 'Original tax invoice not attached; bank screenshot not permitted.'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.claim.status).toBe('REJECTED');
    expect(patchRes.body.claim.rejectionReason).toContain('Original tax invoice');
  });

  // ============================================================================
  // Administrative Resolution Path: Link User to Employee
  // ============================================================================

  it('prevents linking an employee who is already linked to another user account (409)', async () => {
    // secondEmployeeId (Ananya Verma) is already linked to user 'ananya.verma'
    const linkConflictRes = await request(app)
      .post('/api/v1/expenses/link-user-employee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: unlinkedUserId,
        employeeId: secondEmployeeId
      });

    expect(linkConflictRes.status).toBe(409);
    expect(linkConflictRes.body.error?.message).toMatch(/already linked/i);
  });

  it('allows HR/Admin to link an unlinked user to an eligible unlinked employee record (200)', async () => {
    // Create an unlinked employee in the company
    const existingEmp = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const freshEmployee = await prisma.employee.create({
      data: {
        companyId,
        branchId: existingEmp.branchId,
        departmentId: existingEmp.departmentId,
        designationId: existingEmp.designationId,
        employeeCode: `EMP-UNLINKED-${Date.now()}`,
        firstName: 'Standalone',
        lastName: 'Specialist',
        workEmail: `standalone-${Date.now()}@apexglobal.tech`,
        dateOfJoining: new Date('2026-01-01'),
        status: 'CONFIRMED'
      }
    });

    const linkRes = await request(app)
      .post('/api/v1/expenses/link-user-employee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: unlinkedUserId,
        employeeId: freshEmployee.id
      });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.user.employeeId).toBe(freshEmployee.id);
    expect(linkRes.body.message).toMatch(/successfully linked/i);

    // Clean up
    await prisma.user.update({
      where: { id: unlinkedUserId },
      data: { employeeId: null }
    });
    await prisma.employee.delete({ where: { id: freshEmployee.id } });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

describe('Security Defects & Access Boundary Regression Suite (DEF-01 to DEF-06)', () => {
  let companyId: string;
  let branchId: string;
  let departmentId: string;
  let designationId: string;

  let employee1Id: string;
  let employee2Id: string;

  let employee1Token: string;
  let employee2Token: string;
  let managerToken: string;
  let unassociatedUserToken: string;

  let createdProjectId: string;
  let createdCycleId: string;

  beforeAll(async () => {
    // 1. Create dedicated isolated company
    const uniqueSuffix = Date.now().toString();
    const company = await prisma.company.create({
      data: {
        code: `DEF-CO-${uniqueSuffix}`,
        name: 'Defect Audit Testing Corp',
        legalName: 'Defect Audit Testing Corp Pvt Ltd',
        contactEmail: `audit-${uniqueSuffix}@defecttest.com`
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { companyId, code: `BR-${uniqueSuffix}`, name: 'HQ Tech Park', state: 'Karnataka', city: 'Bengaluru' }
    });
    branchId = branch.id;

    const department = await prisma.department.create({
      data: { companyId, code: `DEP-${uniqueSuffix}`, name: 'Engineering' }
    });
    departmentId = department.id;

    const designation = await prisma.designation.create({
      data: { companyId, code: `DES-${uniqueSuffix}`, name: 'Full Stack Engineer' }
    });
    designationId = designation.id;

    // 2. Create Employee 1 & Employee 2
    const emp1 = await prisma.employee.create({
      data: {
        companyId,
        branchId,
        departmentId,
        designationId,
        employeeCode: `EMP-DEF-1-${uniqueSuffix}`,
        firstName: 'Alice',
        lastName: 'Developer',
        workEmail: `alice.${uniqueSuffix}@defecttest.com`,
        status: 'CONFIRMED',
        dateOfJoining: new Date('2025-01-01')
      }
    });
    employee1Id = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        companyId,
        branchId,
        departmentId,
        designationId,
        employeeCode: `EMP-DEF-2-${uniqueSuffix}`,
        firstName: 'Bob',
        lastName: 'Engineer',
        workEmail: `bob.${uniqueSuffix}@defecttest.com`,
        status: 'CONFIRMED',
        dateOfJoining: new Date('2025-02-01')
      }
    });
    employee2Id = emp2.id;

    const passwordHash = await bcrypt.hash('Admin@123', 10);

    // 3. Create Users
    // Alice User (Employee role)
    const user1 = await prisma.user.create({
      data: {
        companyId,
        employeeId: employee1Id,
        username: `alice.${uniqueSuffix}`,
        email: `alice.${uniqueSuffix}@defecttest.com`,
        fullName: 'Alice Developer',
        passwordHash,
        active: true
      }
    });
    const roleEmp = await prisma.role.findFirst({ where: { name: 'employee' } });
    if (roleEmp) {
      await prisma.userRole.create({ data: { userId: user1.id, roleId: roleEmp.id } });
    }

    // Bob User (Employee role)
    const user2 = await prisma.user.create({
      data: {
        companyId,
        employeeId: employee2Id,
        username: `bob.${uniqueSuffix}`,
        email: `bob.${uniqueSuffix}@defecttest.com`,
        fullName: 'Bob Engineer',
        passwordHash,
        active: true
      }
    });
    if (roleEmp) {
      await prisma.userRole.create({ data: { userId: user2.id, roleId: roleEmp.id } });
    }

    // Manager User
    const userMgr = await prisma.user.create({
      data: {
        companyId,
        username: `manager.${uniqueSuffix}`,
        email: `mgr.${uniqueSuffix}@defecttest.com`,
        fullName: 'Engineering Manager',
        passwordHash,
        active: true
      }
    });
    const roleMgr = await prisma.role.findFirst({ where: { name: 'department_manager' } });
    if (roleMgr) {
      await prisma.userRole.create({ data: { userId: userMgr.id, roleId: roleMgr.id } });
    }

    // Unassociated User (Contractor / Guest with no employeeId record)
    const userUnassoc = await prisma.user.create({
      data: {
        companyId,
        employeeId: null,
        username: `external.${uniqueSuffix}`,
        email: `external.${uniqueSuffix}@defecttest.com`,
        fullName: 'External Consultant',
        passwordHash,
        active: true
      }
    });
    if (roleEmp) {
      await prisma.userRole.create({ data: { userId: userUnassoc.id, roleId: roleEmp.id } });
    }

    // 4. Authenticate & Obtain Tokens
    const res1 = await request(app).post('/api/v1/auth/login').send({ username: `alice.${uniqueSuffix}`, password: 'Admin@123' });
    employee1Token = res1.body.token;

    const res2 = await request(app).post('/api/v1/auth/login').send({ username: `bob.${uniqueSuffix}`, password: 'Admin@123' });
    employee2Token = res2.body.token;

    const resMgr = await request(app).post('/api/v1/auth/login').send({ username: `manager.${uniqueSuffix}`, password: 'Admin@123' });
    managerToken = resMgr.body.token;

    const resUnassoc = await request(app).post('/api/v1/auth/login').send({ username: `external.${uniqueSuffix}`, password: 'Admin@123' });
    unassociatedUserToken = resUnassoc.body.token;

    // 5. Seed auxiliary project, cycle, and entries
    const project = await prisma.project.create({
      data: { companyId, code: `PRJ-${uniqueSuffix}`, name: 'Security Hardening', clientName: 'Internal' }
    });
    createdProjectId = project.id;

    await prisma.timesheetEntry.create({
      data: {
        employeeId: employee1Id,
        projectId: createdProjectId,
        date: new Date('2026-10-15'),
        hours: 8,
        taskDescription: 'Alice confidential security audit',
        isBillable: true,
        status: 'PENDING'
      }
    });

    const cycle = await prisma.performanceCycle.create({
      data: {
        companyId,
        name: `FY26-Q3-${uniqueSuffix}`,
        year: 2026,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-09-30'),
        status: 'ACTIVE'
      }
    });
    createdCycleId = cycle.id;

    await prisma.employeeGoal.create({
      data: {
        employeeId: employee1Id,
        cycleId: createdCycleId,
        title: 'Alice confidential target: Refactor authentication engine',
        weightage: 50
      }
    });

    await prisma.performanceReview.create({
      data: {
        employeeId: employee1Id,
        cycleId: createdCycleId,
        selfScore: 4,
        status: 'SUBMITTED'
      }
    });
  });

  afterAll(async () => {
    // Teardown test fixtures
    await prisma.timesheetEntry.deleteMany({ where: { projectId: createdProjectId } });
    await prisma.project.deleteMany({ where: { id: createdProjectId } });
    await prisma.performanceReview.deleteMany({ where: { cycleId: createdCycleId } });
    await prisma.employeeGoal.deleteMany({ where: { cycleId: createdCycleId } });
    await prisma.performanceCycle.deleteMany({ where: { id: createdCycleId } });

    await prisma.userRole.deleteMany({
      where: { user: { companyId } }
    });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.department.deleteMany({ where: { companyId } });
    await prisma.designation.deleteMany({ where: { companyId } });
    await prisma.branch.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  // -------------------------------------------------------------
  // DEF-01: Timesheet Entries IDOR
  // -------------------------------------------------------------
  describe('DEF-01: Timesheet Entries IDOR Protection', () => {
    it('strictly prevents a regular employee from querying another employee timesheets via query parameter (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/timesheets/entries?employeeId=${employee1Id}`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to view another employee’s timesheet/i);
    });

    it('allows a regular employee to query their own timesheets (200)', async () => {
      const res = await request(app)
        .get('/api/v1/timesheets/entries')
        .set('Authorization', `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body.entries.length).toBe(1);
      expect(res.body.entries[0].taskDescription).toBe('Alice confidential security audit');
    });

    it('allows an authorized manager to query an employee timesheets (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/timesheets/entries?employeeId=${employee1Id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body.entries.length).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // DEF-02: Performance Goals IDOR & Reviews Leakage
  // -------------------------------------------------------------
  describe('DEF-02: Performance Module Boundary Enforcement', () => {
    it('strictly prevents a regular employee from snooping another employee performance goals (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/goals?employeeId=${employee1Id}`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to view another employee’s goals/i);
    });

    it('allows employee to view their own performance goals (200)', async () => {
      const res = await request(app)
        .get('/api/v1/performance/goals')
        .set('Authorization', `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.goals.length).toBe(1);
      expect(res.body.goals[0].title).toContain('Alice confidential target');
    });

    it('prevents unassociated non-manager user from seeing company performance reviews (returns empty list, 0 leaks)', async () => {
      const res = await request(app)
        .get('/api/v1/performance/reviews')
        .set('Authorization', `Bearer ${unassociatedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toEqual([]);
    });

    it('allows authorized manager to view company performance reviews (200)', async () => {
      const res = await request(app)
        .get('/api/v1/performance/reviews')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // DEF-03: Offboarding Resignations Unassociated Leakage
  // -------------------------------------------------------------
  describe('DEF-03: Offboarding Resignation Data Isolation', () => {
    it('prevents unassociated non-HR user from viewing all company resignations (returns empty list, 0 leaks)', async () => {
      const res = await request(app)
        .get('/api/v1/offboarding/resignations')
        .set('Authorization', `Bearer ${unassociatedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resignations).toEqual([]);
    });
  });

  // -------------------------------------------------------------
  // DEF-04: Helpdesk Tickets Unassociated Leakage
  // -------------------------------------------------------------
  describe('DEF-04: Helpdesk Tickets Boundary Protection', () => {
    it('prevents unassociated non-staff user from viewing company helpdesk tickets (returns empty list, 0 leaks)', async () => {
      const res = await request(app)
        .get('/api/v1/helpdesk/tickets')
        .set('Authorization', `Bearer ${unassociatedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([]);
    });
  });

  // -------------------------------------------------------------
  // DEF-05: Attendance Regularizations Unassociated Leakage
  // -------------------------------------------------------------
  describe('DEF-05: Attendance Regularization Boundary Protection', () => {
    it('prevents unassociated non-manager from viewing company attendance regularizations (returns empty list, 0 leaks)', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/regularizations')
        .set('Authorization', `Bearer ${unassociatedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.regularizations).toEqual([]);
    });
  });

  // -------------------------------------------------------------
  // DEF-06: Leave Balances Cross-Employee IDOR
  // -------------------------------------------------------------
  describe('DEF-06: Leave Balances Cross-Employee IDOR Protection', () => {
    it('strictly prevents a regular employee from querying another employee leave balances (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/leave/balances?employeeId=${employee1Id}`)
        .set('Authorization', `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to view another employee’s leave balances/i);
    });

    it('allows a regular employee to query their own leave balances (200)', async () => {
      const res = await request(app)
        .get('/api/v1/leave/balances')
        .set('Authorization', `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.balances)).toBe(true);
    });

    it('allows manager to query leave balances for an employee (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/leave/balances?employeeId=${employee1Id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.balances)).toBe(true);
    });

    it('returns empty array when unassociated user queries leave balances (200)', async () => {
      const res = await request(app)
        .get('/api/v1/leave/balances')
        .set('Authorization', `Bearer ${unassociatedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances).toEqual([]);
    });
  });
});

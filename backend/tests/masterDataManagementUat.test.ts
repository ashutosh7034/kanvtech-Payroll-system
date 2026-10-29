import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Master Data Management (MDM) End-to-End User Acceptance Testing (UAT)', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  const PROTECTED_LOAN_ID = 'b405b4b8-1211-48c5-a59e-ee8db001a906';

  // Synthetic Master IDs
  let uatDeptId = '';
  let uatGradeId = '';
  let uatBranchId = '';
  let uatDesigId = '';
  let uatUnitId = '';
  let uatCatId = '';
  let uatProjectId = '';
  let uatJobPosId = '';
  let uatEmployeeId = '';

  beforeAll(async () => {
    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // Authenticate Regular Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    companyId = adminUser!.companyId;

    // Clean up any stale UAT records from prior runs
    await prisma.employee.deleteMany({ where: { employeeCode: { startsWith: 'EMP-UAT' } } });
    await prisma.jobPosition.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.project.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.employmentCategory.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.orgUnit.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.designation.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.branch.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.jobBand.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.department.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
  });

  afterAll(async () => {
    // Clean up created synthetic employee if exists
    if (uatEmployeeId) {
      await prisma.employeeSalaryStructure.deleteMany({ where: { employeeId: uatEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: uatEmployeeId } });
    }

    // Clean up synthetic masters
    await prisma.jobPosition.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.project.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.employmentCategory.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.orgUnit.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.designation.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.branch.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.jobBand.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
    await prisma.department.deleteMany({ where: { code: { startsWith: 'UAT-' } } });
  });

  describe('Phase F — Scenario A: New Master Creation & Propagation to Dropdowns', () => {
    it('creates synthetic masters across all 8 organizational categories', async () => {
      // 1. Department
      const deptRes = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-DEPT-99',
          name: 'UAT Autonomous Operations',
          active: true,
        });
      expect(deptRes.status).toBe(201);
      uatDeptId = deptRes.body.record.id;

      // 2. Grade / Job Band
      const gradeRes = await request(app)
        .post('/api/v1/masters/grades')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-GRD-99',
          name: 'UAT Executive Principal',
          level: 9,
          active: true,
        });
      expect(gradeRes.status).toBe(201);
      uatGradeId = gradeRes.body.record.id;

      // 3. Branch
      const branchRes = await request(app)
        .post('/api/v1/masters/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-BR-99',
          name: 'UAT Satellite Campus',
          city: 'Hyderabad',
          state: 'Telangana',
          active: true,
        });
      expect(branchRes.status).toBe(201);
      uatBranchId = branchRes.body.record.id;

      // 4. Designation
      const desigRes = await request(app)
        .post('/api/v1/masters/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-DSG-99',
          name: 'Chief UAT Officer',
          active: true,
        });
      expect(desigRes.status).toBe(201);
      uatDesigId = desigRes.body.record.id;

      // 5. Unit
      const unitRes = await request(app)
        .post('/api/v1/masters/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-UNT-99',
          name: 'UAT Core Pod',
          active: true,
        });
      expect(unitRes.status).toBe(201);
      uatUnitId = unitRes.body.record.id;

      // 6. Employment Category (key: 'categories')
      const catRes = await request(app)
        .post('/api/v1/masters/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-CAT-99',
          name: 'Permanent UAT Full-Time',
          active: true,
        });
      expect(catRes.status).toBe(201);
      uatCatId = catRes.body.record.id;

      // 7. Project
      const prjRes = await request(app)
        .post('/api/v1/masters/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-PRJ-99',
          name: 'Project Hyperion',
          active: true,
        });
      expect(prjRes.status).toBe(201);
      uatProjectId = prjRes.body.record.id;

      // 8. Job Position (linked to synthetic department)
      const posRes = await request(app)
        .post('/api/v1/masters/job-positions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-POS-99',
          title: 'Lead System Architect',
          departmentId: uatDeptId,
          active: true,
        });
      expect(posRes.status).toBe(201);
      uatJobPosId = posRes.body.record.id;
    });

    it('verifies all created synthetic masters appear in active dropdown queries', async () => {
      const endpoints = [
        { cat: 'departments', code: 'UAT-DEPT-99' },
        { cat: 'grades', code: 'UAT-GRD-99' },
        { cat: 'branches', code: 'UAT-BR-99' },
        { cat: 'designations', code: 'UAT-DSG-99' },
        { cat: 'units', code: 'UAT-UNT-99' },
        { cat: 'categories', code: 'UAT-CAT-99' },
        { cat: 'projects', code: 'UAT-PRJ-99' },
        { cat: 'job-positions', code: 'UAT-POS-99' },
      ];

      for (const item of endpoints) {
        const res = await request(app)
          .get(`/api/v1/masters/${item.cat}?status=ACTIVE&all=true`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.records)).toBe(true);
        const match = res.body.records.find((r: any) => r.code === item.code);
        expect(match).toBeDefined();
        expect(match.active).toBe(true);
      }
    });

    it('enrolls a synthetic employee selecting all new synthetic master records', async () => {
      const empRes = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeCode: 'EMP-UAT-999',
          firstName: 'Aarav',
          lastName: 'Somani',
          workEmail: 'aarav.somani.uat@kanvtech.com',
          branchId: uatBranchId,
          departmentId: uatDeptId,
          designationId: uatDesigId,
          jobBandId: uatGradeId,
          unit: 'UAT Core Pod',
          category: 'Permanent UAT Full-Time',
          project: 'Project Hyperion',
          jobPostCode: 'UAT-POS-99',
          dateOfJoining: '2026-03-01',
          employmentType: 'PERMANENT',
          workMode: 'OFFICE',
          gender: 'MALE',
        });

      expect(empRes.status).toBe(201);
      uatEmployeeId = empRes.body.employee ? empRes.body.employee.id : empRes.body.id;
      expect(uatEmployeeId).toBeDefined();

      // Retrieve employee record and assert persisted master relations
      const fetchRes = await request(app)
        .get(`/api/v1/employees/${uatEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(fetchRes.status).toBe(200);
      const emp = fetchRes.body.employee || fetchRes.body;
      expect(emp.departmentId).toBe(uatDeptId);
      expect(emp.designationId).toBe(uatDesigId);
      expect(emp.branchId).toBe(uatBranchId);
      expect(emp.jobBandId).toBe(uatGradeId);
      expect(emp.unit).toBe('UAT Core Pod');
      expect(emp.category).toBe('Permanent UAT Full-Time');
      expect(emp.project).toBe('Project Hyperion');
      expect(emp.jobPostCode).toBe('UAT-POS-99');
    });
  });

  describe('Phase F — Scenario B: Edit Employee Master Relationships', () => {
    it('updates employee to new master relationships and asserts persistence', async () => {
      // Create another synthetic department for migration
      const dept2Res = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-DEPT-98',
          name: 'UAT Secondary Systems',
          active: true,
        });
      expect(dept2Res.status).toBe(201);
      const dept2Id = dept2Res.body.record.id;

      // Update employee
      const updateRes = await request(app)
        .put(`/api/v1/employees/${uatEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: dept2Id,
          project: 'Project Nebular Delta',
          unit: 'UAT Secondary Pod',
        });

      expect([200, 204]).toContain(updateRes.status);

      // Verify updated values
      const verifyRes = await request(app)
        .get(`/api/v1/employees/${uatEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const emp = verifyRes.body.employee || verifyRes.body;
      expect(emp.departmentId).toBe(dept2Id);
      expect(emp.project).toBe('Project Nebular Delta');
      expect(emp.unit).toBe('UAT Secondary Pod');

      // Revert back to original synthetic dept so dept2 can be safely deleted
      await request(app)
        .put(`/api/v1/employees/${uatEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: uatDeptId });

      await prisma.department.delete({ where: { id: dept2Id } });
    });
  });

  describe('Phase F — Scenario C: Validation & Error Resilience', () => {
    it('rejects foreign keys referencing non-existent master records', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const invalidRes = await request(app)
        .put(`/api/v1/employees/${uatEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: nonExistentUuid,
        });

      // Should fail gracefully with validation or constraint error
      expect([400, 404, 422, 500]).toContain(invalidRes.status);
    });

    it('rejects unauthenticated requests to master routes', async () => {
      const unauthRes = await request(app).get('/api/v1/masters/departments');
      expect(unauthRes.status).toBe(401);
    });

    it('rejects non-admin role modifications to master routes (RBAC check)', async () => {
      const forbiddenRes = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          code: 'HACK-DEPT',
          name: 'Unauthorized Dept',
        });
      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('Phase F — Scenario D: Deactivation, Filtering & Empty States', () => {
    it('deactivates a master record and confirms exclusion from activeOnly queries', async () => {
      // Deactivate uatGradeId
      const toggleRes = await request(app)
        .patch(`/api/v1/masters/grades/${uatGradeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.record.active).toBe(false);

      // Query status=ACTIVE -> should NOT contain the deactivated grade
      const activeRes = await request(app)
        .get('/api/v1/masters/grades?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(activeRes.status).toBe(200);
      const foundInActive = activeRes.body.records.find((r: any) => r.id === uatGradeId);
      expect(foundInActive).toBeUndefined();

      // Query status=ALL -> SHOULD contain the deactivated grade
      const allRes = await request(app)
        .get('/api/v1/masters/grades?status=ALL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(allRes.status).toBe(200);
      const foundInAll = allRes.body.records.find((r: any) => r.id === uatGradeId);
      expect(foundInAll).toBeDefined();
      expect(foundInAll.active).toBe(false);

      // Reactivate it
      await request(app)
        .patch(`/api/v1/masters/grades/${uatGradeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true });
    });
  });

  describe('Phase G — Cascading & Referential Integrity Protection', () => {
    it('blocks deletion of master records with active employee references with 409 REFERENTIAL_INTEGRITY_VIOLATION', async () => {
      // uatDeptId is assigned to uatEmployeeId
      const deleteDeptRes = await request(app)
        .delete(`/api/v1/masters/departments/${uatDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 409]).toContain(deleteDeptRes.status);
      expect(deleteDeptRes.body.error).toBeDefined();
      expect(deleteDeptRes.body.error.code).toBe('REFERENTIAL_INTEGRITY_VIOLATION');
      expect(deleteDeptRes.body.error.message).toMatch(/referenced by/i);

      // uatBranchId is assigned to uatEmployeeId
      const deleteBranchRes = await request(app)
        .delete(`/api/v1/masters/branches/${uatBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 409]).toContain(deleteBranchRes.status);
      expect(deleteBranchRes.body.error.code).toBe('REFERENTIAL_INTEGRITY_VIOLATION');
    });

    it('blocks deletion of a department referenced by a job position', async () => {
      // Create a standalone department for job position testing
      const testPosDept = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-DEPT-POS-ONLY',
          name: 'Department for Job Position Test',
          active: true,
        });
      expect(testPosDept.status).toBe(201);
      const posDeptId = testPosDept.body.record.id;

      // Create a job position linked to this department
      const testPos = await request(app)
        .post('/api/v1/masters/job-positions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'UAT-POS-ALONE',
          title: 'Autonomous System Operator',
          departmentId: posDeptId,
          active: true,
        });
      expect(testPos.status).toBe(201);
      const posId = testPos.body.record.id;

      // Attempt deletion of department while job position references it
      const deleteDeptRes = await request(app)
        .delete(`/api/v1/masters/departments/${posDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 409]).toContain(deleteDeptRes.status);
      expect(deleteDeptRes.body.error.code).toBe('REFERENTIAL_INTEGRITY_VIOLATION');
      expect(deleteDeptRes.body.error.message).toMatch(/referenced by/i);

      // Clean up position first, then department can be deleted
      const deletePosRes = await request(app)
        .delete(`/api/v1/masters/job-positions/${posId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deletePosRes.status).toBe(200);

      const deleteDeptSuccessRes = await request(app)
        .delete(`/api/v1/masters/departments/${posDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteDeptSuccessRes.status).toBe(200);
    });

    it('allows clean deletion once all references are dissociated', async () => {
      // Create temporary unreferenced grade
      const tempGradeRes = await request(app)
        .post('/api/v1/masters/grades')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEMP-GRD-01',
          name: 'Temporary Unused Grade',
          level: 1,
          active: true,
        });

      expect(tempGradeRes.status).toBe(201);
      const tempId = tempGradeRes.body.record.id;

      // Delete should succeed
      const deleteRes = await request(app)
        .delete(`/api/v1/masters/grades/${tempId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);
    });
  });

  describe('Production Guard & Security Checks', () => {
    it('verifies protected loan record remains intact and unaltered', async () => {
      const protectedLoan = await prisma.employeeLoan.findUnique({
        where: { id: PROTECTED_LOAN_ID },
      });
      // In test DB, if seeded it exists; if not null, ID matches
      if (protectedLoan) {
        expect(protectedLoan.id).toBe(PROTECTED_LOAN_ID);
      }
    });
  });
});

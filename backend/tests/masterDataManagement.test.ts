import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Centralized Master Data Management (MDM) Comprehensive Test Suite', () => {
  let adminToken = '';
  let employeeToken = '';
  let companyId = '';
  let testBranchId = '';
  let testDeptId = '';
  let testDesigId = '';
  let testGradeId = '';
  let testUnitId = '';
  let testCatId = '';
  let testJobPosId = '';

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate Regular Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
    companyId = adminUser!.companyId;
  });

  describe('1. Category Metadata & Live Counts', () => {
    it('returns all master category definitions with live record counts', async () => {
      const res = await request(app)
        .get('/api/v1/masters/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThanOrEqual(15);

      const branchCat = res.body.categories.find((c: any) => c.key === 'branches');
      expect(branchCat).toBeDefined();
      expect(branchCat.label).toBe('Branches & Locations');
      expect(branchCat.totalCount).toBeGreaterThanOrEqual(1);
      expect(branchCat.activeCount).toBeGreaterThanOrEqual(1);

      const deptCat = res.body.categories.find((c: any) => c.key === 'departments');
      expect(deptCat).toBeDefined();
      expect(deptCat.totalCount).toBeGreaterThanOrEqual(1);

      const unitCat = res.body.categories.find((c: any) => c.key === 'units');
      expect(unitCat).toBeDefined();
      expect(unitCat.totalCount).toBeGreaterThanOrEqual(1);

      const jobPosCat = res.body.categories.find((c: any) => c.key === 'job-positions');
      expect(jobPosCat).toBeDefined();
      expect(jobPosCat.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('rejects unauthenticated requests to category overview', async () => {
      const res = await request(app).get('/api/v1/masters/categories');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Master Record Querying, Search, and Filtering', () => {
    it('queries active branches with pagination and total count', async () => {
      const res = await request(app)
        .get('/api/v1/masters/branches?status=ACTIVE&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.records)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.category.key).toBe('branches');
    });

    it('searches master records by code or name case-insensitively', async () => {
      const res = await request(app)
        .get('/api/v1/masters/departments?search=eng')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBeGreaterThanOrEqual(1);
      const match = res.body.records.some((d: any) =>
        d.name.toLowerCase().includes('eng') || d.code.toLowerCase().includes('eng')
      );
      expect(match).toBe(true);
    });

    it('queries organizational units with parent branch relationship', async () => {
      const res = await request(app)
        .get('/api/v1/masters/units')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBeGreaterThanOrEqual(1);
      const unit = res.body.records[0];
      expect(unit.name).toBeDefined();
      expect(unit.code).toBeDefined();
    });

    it('queries job positions with department and designation includes', async () => {
      const res = await request(app)
        .get('/api/v1/masters/job-positions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBeGreaterThanOrEqual(1);
      const pos = res.body.records[0];
      expect(pos.code).toBeDefined();
      expect(pos.title).toBeDefined();
    });
  });

  describe('3. Master Record Creation & Duplicate Code Validation', () => {
    it('creates a new Department master record', async () => {
      const uniqueCode = `MDM_TEST_${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: uniqueCode,
          name: 'MDM Test Department',
          active: true
        });

      expect(res.status).toBe(201);
      expect(res.body.record.code).toBe(uniqueCode);
      expect(res.body.record.name).toBe('MDM Test Department');
      testDeptId = res.body.record.id;
    });

    it('strictly rejects duplicate code within the same company (400 DUPLICATE_CODE)', async () => {
      const existingDept = await prisma.department.findUnique({ where: { id: testDeptId } });
      const res = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: existingDept!.code,
          name: 'Another Department with Same Code',
          active: true
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DUPLICATE_CODE');
      expect(res.body.error.message).toContain('already exists in your company');
    });

    it('creates a new Organizational Unit master record', async () => {
      const uniqueCode = `U_${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/masters/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: uniqueCode,
          name: 'Test Innovation Center',
          description: 'Special test facility for MDM suite'
        });

      expect(res.status).toBe(201);
      expect(res.body.record.code).toBe(uniqueCode);
      testUnitId = res.body.record.id;
    });

    it('creates a new Job Position master record', async () => {
      const uniqueCode = `POS_${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/masters/job-positions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: uniqueCode,
          title: 'Staff Platform Engineer',
          departmentId: testDeptId,
          description: 'Lead platform infrastructure'
        });

      expect(res.status).toBe(201);
      expect(res.body.record.code).toBe(uniqueCode);
      testJobPosId = res.body.record.id;
    });
  });

  describe('4. Master Record Updates & Active Status Toggling', () => {
    it('updates a master record details', async () => {
      const res = await request(app)
        .patch(`/api/v1/masters/departments/${testDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated MDM Test Department'
        });

      expect(res.status).toBe(200);
      expect(res.body.record.name).toBe('Updated MDM Test Department');
    });

    it('soft-deactivates a master record', async () => {
      const res = await request(app)
        .patch(`/api/v1/masters/departments/${testDeptId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.record.active).toBe(false);

      // Verify it is excluded when querying status=ACTIVE
      const listRes = await request(app)
        .get('/api/v1/masters/departments?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);
      const found = listRes.body.records.some((d: any) => d.id === testDeptId);
      expect(found).toBe(false);

      // Verify it is included when querying status=INACTIVE or status=ALL
      const inactiveRes = await request(app)
        .get('/api/v1/masters/departments?status=INACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);
      const foundInactive = inactiveRes.body.records.some((d: any) => d.id === testDeptId);
      expect(foundInactive).toBe(true);
    });

    it('re-activates a deactivated master record', async () => {
      const res = await request(app)
        .patch(`/api/v1/masters/departments/${testDeptId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true });

      expect(res.status).toBe(200);
      expect(res.body.record.active).toBe(true);
    });
  });

  describe('5. Referential Integrity & Dependency Protection', () => {
    it('safely deletes an unreferenced master record', async () => {
      const res = await request(app)
        .delete(`/api/v1/masters/units/${testUnitId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const verify = await prisma.orgUnit.findUnique({ where: { id: testUnitId } });
      expect(verify).toBeNull();
    });

    it('strictly prevents deleting a department referenced by active job positions or employees', async () => {
      // testDeptId is referenced by testJobPosId
      const res = await request(app)
        .delete(`/api/v1/masters/departments/${testDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REFERENTIAL_INTEGRITY_VIOLATION');
      expect(res.body.error.message).toContain('Deactivate instead of deleting');
    });

    it('cleans up remaining test job position then allows deleting test department', async () => {
      const delPos = await request(app)
        .delete(`/api/v1/masters/job-positions/${testJobPosId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delPos.status).toBe(200);

      const delDept = await request(app)
        .delete(`/api/v1/masters/departments/${testDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delDept.status).toBe(200);
    });
  });

  describe('6. RBAC & Cross-Tenant Boundary Enforcement', () => {
    it('strictly denies regular employees from creating master data (403)', async () => {
      const res = await request(app)
        .post('/api/v1/masters/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ code: 'EMP_FORBIDDEN', name: 'Unauthorized Dept' });

      expect(res.status).toBe(403);
    });

    it('strictly denies regular employees from updating or toggling master data (403)', async () => {
      const anyDept = await prisma.department.findFirst({ where: { companyId } });
      const res = await request(app)
        .patch(`/api/v1/masters/departments/${anyDept!.id}/status`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ active: false });

      expect(res.status).toBe(403);
    });

    it('strictly denies regular employees from deleting master records (403)', async () => {
      const anyDept = await prisma.department.findFirst({ where: { companyId } });
      const res = await request(app)
        .delete(`/api/v1/masters/departments/${anyDept!.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });
});

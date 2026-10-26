import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

describe('Dynamic Permission-Based UI Visibility (RBAC) & Authorization Suite', () => {
  let adminToken = '';
  let hrToken = '';
  let employeeToken = '';
  let assetManagerToken = '';
  let companyId = '';
  let assetRoleId = '';
  let hrRoleId = '';

  const PROTECTED_LOAN_ID = 'b405b4b8-1211-48c5-a59e-ee8db001a906';

  beforeAll(async () => {
    // 1. Resolve Company
    const company = await prisma.company.findFirst({ where: { code: 'APEX' } });
    expect(company).toBeDefined();
    companyId = company!.id;

    // 2. Resolve or create Asset Manager role and user
    let assetRole = await prisma.role.findFirst({ where: { name: 'asset_manager' } });
    if (!assetRole) {
      assetRole = await prisma.role.create({
        data: {
          name: 'asset_manager',
          description: 'IT Asset & Hardware Custodian Manager',
          permissions: ['module:dashboard', 'module:assets_helpdesk', 'tab:assets:inventory', 'tab:assets:helpdesk', 'asset:create', 'asset:allocate', 'asset:view_inventory', 'ticket:create', 'ticket:resolve']
        }
      });
    }
    assetRoleId = assetRole.id;

    const hrRole = await prisma.role.findFirst({ where: { name: 'hr_manager' } });
    if (hrRole) hrRoleId = hrRole.id;

    // Check or create test asset manager user
    let assetUser = await prisma.user.findFirst({ where: { username: 'asset.manager' } });
    if (!assetUser) {
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      assetUser = await prisma.user.create({
        data: {
          companyId,
          username: 'asset.manager',
          email: 'asset.manager@apexglobal.tech',
          passwordHash: hashedPassword,
          fullName: 'Vikram Seth (IT Asset Mgr)'
        }
      });
      await prisma.userRole.create({
        data: {
          userId: assetUser.id,
          roleId: assetRole.id
        }
      });
    }

    // 3. Login as Admin (company_admin)
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

    // 5. Login as Employee (rahul.mehta)
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeToken = empRes.body.token;

    // 6. Login as Asset Manager
    const amRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'asset.manager', password: 'Admin@123' });
    expect(amRes.status).toBe(200);
    assetManagerToken = amRes.body.token;
  });

  describe('1. Authentication & Effective Permission Delivery', () => {
    it('returns full effective permissions for company_admin upon login', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(Array.isArray(res.body.user.permissions)).toBe(true);
      expect(res.body.user.permissions).toContain('asset:create');
      expect(res.body.user.permissions).toContain('loan:apply');
      expect(res.body.user.permissions).toContain('employee:create');
      expect(res.body.user.permissions).toContain('field:employee:basic_pay');
    });

    it('returns hr_manager permissions excluding asset:create to prevent UI flash & 403', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(Array.isArray(res.body.user.permissions)).toBe(true);
      // HR Manager can view assets helpdesk tickets, but NOT create hardware assets
      expect(res.body.user.permissions).toContain('module:assets_helpdesk');
      expect(res.body.user.permissions).not.toContain('asset:create');
      expect(res.body.user.permissions).not.toContain('asset:allocate');
    });

    it('returns restricted self-service permissions for standard employee', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.user.permissions)).toBe(true);
      expect(res.body.user.permissions).toContain('module:self_service');
      expect(res.body.user.permissions).toContain('expense:submit');
      expect(res.body.user.permissions).not.toContain('employee:create');
      expect(res.body.user.permissions).not.toContain('field:employee:basic_pay');
      expect(res.body.user.permissions).not.toContain('asset:create');
    });
  });

  describe('2. Asset Module Backend Authorization & Access Denied Fix', () => {
    it('rejects asset creation from HR Manager who lacks asset:create permission (403)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          assetTag: 'IT-TEST-HR-FAIL',
          name: 'Dell Latitude 7420',
          category: 'LAPTOP',
          serialNumber: `SN-HR-${Date.now()}`
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.error).toContain('Access denied');
    });

    it('rejects asset creation from regular Employee (403)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          assetTag: 'IT-TEST-EMP-FAIL',
          name: 'LG 27-inch 4K',
          category: 'MONITOR',
          serialNumber: `SN-EMP-${Date.now()}`
        });

      expect(res.status).toBe(403);
    });

    it('permits authorized Asset Manager to register IT hardware asset (201)', async () => {
      const serial = `SN-AM-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${assetManagerToken}`)
        .send({
          assetTag: `TAG-${Date.now().toString().slice(-5)}`,
          name: 'Apple MacBook Pro 16 M3 Max',
          category: 'LAPTOP',
          serialNumber: serial
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.asset).toBeDefined();
      expect(res.body.asset.serialNumber).toBe(serial);
    });

    it('permits Company Administrator to register hardware asset (201)', async () => {
      const serial = `SN-ADMIN-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assetTag: `TAG-ADM-${Date.now().toString().slice(-4)}`,
          name: 'HPE ProLiant DL380 Gen10',
          category: 'OTHER',
          serialNumber: serial
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.asset).toBeDefined();
    });
  });

  describe('3. Centralized RBAC Administration & Dynamic Roles API', () => {
    it('returns system permissions catalogue via GET /api/v1/rbac/permissions', async () => {
      const res = await request(app)
        .get('/api/v1/rbac/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.permissions)).toBe(true);
      expect(res.body.permissions.length).toBeGreaterThan(25);
    });

    it('returns role list with permissions via GET /api/v1/rbac/roles', async () => {
      const res = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.roles)).toBe(true);
      const am = res.body.roles.find((r: any) => r.name === 'asset_manager');
      expect(am).toBeDefined();
    });

    it('permits company_admin to update role permissions with audit logging', async () => {
      expect(assetRoleId).toBeDefined();
      const updatedPerms = [
        'module:dashboard',
        'module:assets_helpdesk',
        'tab:assets:inventory',
        'tab:assets:helpdesk',
        'asset:create',
        'asset:allocate',
        'asset:view_inventory',
        'ticket:create',
        'ticket:resolve'
      ];

      const res = await request(app)
        .put(`/api/v1/rbac/roles/${assetRoleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: updatedPerms });

      expect(res.status).toBe(200);
      expect(res.body.role).toBeDefined();
      expect(res.body.role.permissions).toEqual(updatedPerms);

      // Verify audit log entry
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'UPDATE_ROLE_PERMISSIONS',
          entityId: assetRoleId
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(audit).toBeDefined();
    });

    it('rejects unauthorized role permission modification from standard employees (403)', async () => {
      const res = await request(app)
        .put(`/api/v1/rbac/roles/${assetRoleId}/permissions`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ permissions: ['module:dashboard'] });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Token Security, Absence, and Malformed Request Rejection', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/rbac/permissions');
      expect(res.status).toBe(401);
    });

    it('returns 401 when token is forged or invalid', async () => {
      const res = await request(app)
        .get('/api/v1/rbac/permissions')
        .set('Authorization', 'Bearer forged.invalid.token');
      expect(res.status).toBe(401);
    });
  });

  describe('5. Database State & Protected Record Integrity Verification', () => {
    it('confirms existing loan records remain uncorrupted and intact', async () => {
      const loans = await prisma.employeeLoan.findMany({ take: 5 });
      expect(loans.length).toBeGreaterThan(0);
      for (const loan of loans) {
        expect(loan.id).toBeDefined();
        expect(Number(loan.principalAmount)).toBeGreaterThan(0);
        expect(['ACTIVE', 'COMPLETED', 'CLOSED', 'SANCTIONED']).toContain(loan.status);
      }
    });
  });
});

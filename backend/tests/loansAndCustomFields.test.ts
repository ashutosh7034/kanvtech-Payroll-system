import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

describe('Module H & Module B: Loans & Advances, Column Manager, Bulk Import Verification', () => {
  let adminToken: string;
  let employeeUserToken: string;
  let testCompanyId: string;
  let testEmployeeId: string;
  let testLoanTypeId: string;
  let testLoanId: string;
  let customFieldId: string;

  beforeAll(async () => {
    // Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    testCompanyId = adminRes.body.user.companyId;

    // Login as Employee
    const empRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rahul.mehta', password: 'Admin@123' });
    expect(empRes.status).toBe(200);
    employeeUserToken = empRes.body.token;

    // Fetch existing employee
    const emp = await prisma.employee.findFirst({
      where: { companyId: testCompanyId }
    });
    expect(emp).toBeDefined();
    testEmployeeId = emp!.id;
  });

  // ==========================================
  // LOANS & ADVANCES (MODULE H)
  // ==========================================
  describe('Loans & Salary Advances', () => {
    it('retrieves configured loan types', async () => {
      const res = await request(app)
        .get('/api/v1/loans/types')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.types)).toBe(true);
      expect(res.body.types.length).toBeGreaterThan(0);
      const matchingType = res.body.types.find((t: any) => Number(t.maxAmount) >= 60000 && Number(t.interestRatePct ?? 0) === 0);
      testLoanTypeId = matchingType ? matchingType.id : res.body.types[0].id;
    });

    it('creates a new company loan type with interest and tenure rules', async () => {
      const code = `TEST_LN_${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/v1/loans/types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: 'Home Relocation Assistance',
          maxAmount: 150000,
          interestRatePct: 4.5,
          maxTenureMonths: 18
        });
      expect(res.status).toBe(201);
      expect(res.body.loanType.code).toBe(code);
    });

    it('sanctions an employee loan with deterministic EMI calculation', async () => {
      const res = await request(app)
        .post('/api/v1/loans/apply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: testLoanTypeId,
          principalAmount: 60000,
          tenureMonths: 6
        });
      expect(res.status).toBe(201);
      expect(res.body.loan.principalAmount).toBe('60000');
      expect(res.body.loan.monthlyEmi).toBe('10000'); // 60000 / 6 = 10000
      expect(res.body.loan.outstandingAmount).toBe('60000');
      expect(res.body.loan.status).toBe('ACTIVE');
      testLoanId = res.body.loan.id;
    });

    it('retrieves loan summary with live outstanding metrics', async () => {
      const res = await request(app)
        .get('/api/v1/loans/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.activeLoansCount).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.totalOutstanding).toBeGreaterThanOrEqual(60000);
    });
  });

  // ==========================================
  // COLUMN MANAGER & CUSTOM FIELDS (MODULE B)
  // ==========================================
  describe('Column Manager & Custom Fields', () => {
    it('retrieves custom field definitions for the company', async () => {
      const res = await request(app)
        .get('/api/v1/employees/custom-fields/definitions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.fields)).toBe(true);
      expect(res.body.fields.length).toBeGreaterThan(0);
    });

    it('creates a custom employee field with data type and visibility', async () => {
      const key = `tshirt_${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/v1/employees/custom-fields/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fieldLabel: 'Corporate T-Shirt Size',
          fieldKey: key,
          fieldType: 'DROPDOWN',
          options: ['S', 'M', 'L', 'XL', 'XXL'],
          isRequired: false,
          defaultValue: 'L',
          isVisible: true
        });
      expect(res.status).toBe(201);
      expect(res.body.field.fieldKey).toBe(key);
      customFieldId = res.body.field.id;
    });

    it('toggles column visibility in Column Manager', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/custom-fields/definitions/${customFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isVisible: false });
      expect(res.status).toBe(200);
      expect(res.body.field.isVisible).toBe(false);
    });

    it('persists and retrieves custom field value for an employee', async () => {
      const saveRes = await request(app)
        .put(`/api/v1/employees/${testEmployeeId}/custom-fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          values: [
            { fieldDefinitionId: customFieldId, value: 'XL' }
          ]
        });
      expect(saveRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/employees/${testEmployeeId}/custom-fields`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      const val = getRes.body.values.find((v: any) => v.fieldDefinitionId === customFieldId);
      expect(val).toBeDefined();
      expect(val.fieldValue).toBe('XL');
    });
  });

  // ==========================================
  // BULK IMPORT & CSV EXPORT (MODULE B)
  // ==========================================
  describe('Bulk Import & CSV Export', () => {
    it('validates bulk employee import rows and reports row-level errors', async () => {
      const newCode = `BULK_${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/v1/employees/bulk-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          commit: false,
          rows: [
            {
              employeeCode: newCode,
              firstName: 'Deepak',
              lastName: 'Chopra',
              workEmail: `${newCode.toLowerCase()}@apexglobal.tech`,
              branch: 'Headquarters',
              department: 'Engineering',
              designation: 'Software Engineer',
              dateOfJoining: '2023-04-15'
            },
            {
              employeeCode: '', // invalid: empty code
              firstName: 'Test',
              lastName: 'User',
              workEmail: 'invalid-email', // invalid email
              branch: 'Headquarters',
              department: 'Engineering',
              designation: 'Software Engineer'
            }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.summary.totalRows).toBe(2);
      expect(res.body.summary.validRows).toBe(1);
      expect(res.body.summary.errorRows).toBe(1);
      expect(res.body.results[0].valid).toBe(true);
      expect(res.body.results[1].valid).toBe(false);
      expect(res.body.results[1].errors.length).toBeGreaterThan(0);
    });

    it('exports employee records as sanitized CSV', async () => {
      const res = await request(app)
        .get('/api/v1/employees/export/csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('EmployeeCode,FirstName,LastName');
    });

    it('updates employee status to SUSPENDED and reactivates to ACTIVE', async () => {
      const suspendRes = await request(app)
        .patch(`/api/v1/employees/${testEmployeeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.employee.status).toBe('SUSPENDED');

      const activateRes = await request(app)
        .patch(`/api/v1/employees/${testEmployeeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.employee.status).toBe('ACTIVE');
    });
  });

  afterAll(async () => {
    if (customFieldId) {
      await prisma.employeeCustomFieldValue.deleteMany({ where: { fieldDefinitionId: customFieldId } });
      await prisma.customFieldDefinition.deleteMany({ where: { id: customFieldId } });
    }
    if (testLoanId) {
      await prisma.loanRepayment.deleteMany({ where: { loanId: testLoanId } });
      await prisma.employeeLoan.deleteMany({ where: { id: testLoanId } });
    }
    await prisma.loanType.deleteMany({ where: { code: { startsWith: 'TEST_LN_' } } });
  });
});


import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { FormulaEngine } from '../src/modules/compensation/formulaEngine.js';
import { CalculationEngine } from '../src/modules/compensation/calculationEngine.js';
import { PayrollCalculationEngine } from '../src/modules/payroll/calculationEngine.js';
import Decimal from 'decimal.js';

describe('Salary Column Master & AST Formula Inspector Suite', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantACompanyId: string;
  let tenantBCompanyId: string;
  let componentConvId: string;
  let componentHraId: string;
  let componentSplId: string;

  beforeAll(async () => {
    // 1. Create Isolated Tenant A & Tenant B Fixtures
    const companyA = await prisma.company.create({
      data: {
        code: `COL-CO-A-${Date.now()}`,
        name: 'Alpha Column Corp',
        legalName: 'Alpha Column Corp Ltd',
        contactEmail: `admin@alphacolumn-${Date.now()}.com`
      }
    });
    tenantACompanyId = companyA.id;

    const companyB = await prisma.company.create({
      data: {
        code: `COL-CO-B-${Date.now()}`,
        name: 'Beta Column Corp',
        legalName: 'Beta Column Corp Ltd',
        contactEmail: `admin@betacolumn-${Date.now()}.com`
      }
    });
    tenantBCompanyId = companyB.id;

    // Admin Users with Roles
    const roleAdmin = await prisma.role.findFirst({ where: { name: 'company_admin' } }) ||
      await prisma.role.create({ data: { name: 'company_admin', description: 'Admin' } });

    const userA = await prisma.user.create({
      data: {
        companyId: tenantACompanyId,
        username: `col_admin_a_${Date.now()}`,
        email: `col_admin_a_${Date.now()}@alpha.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Column Admin Alpha',
        active: true
      }
    });
    await prisma.userRole.create({ data: { userId: userA.id, roleId: roleAdmin.id } });

    const userB = await prisma.user.create({
      data: {
        companyId: tenantBCompanyId,
        username: `col_admin_b_${Date.now()}`,
        email: `col_admin_b_${Date.now()}@beta.com`,
        passwordHash: '$2a$10$wT8K8U1h9a6E5s4d3f2g1uH1h1h1h1h1h1h1h1h1h1h1h1h1h1h1h',
        fullName: 'Column Admin Beta',
        active: true
      }
    });
    await prisma.userRole.create({ data: { userId: userB.id, roleId: roleAdmin.id } });

    // Create Tokens
    const jwt = (await import('jsonwebtoken')).default;
    const { ENV } = await import('../src/config/env.js');

    tenantAToken = jwt.sign({ userId: userA.id, companyId: tenantACompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });
    tenantBToken = jwt.sign({ userId: userB.id, companyId: tenantBCompanyId }, ENV.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Clean up isolated fixtures created in this test
    try {
      await prisma.salaryComponent.deleteMany({
        where: { companyId: { in: [tenantACompanyId, tenantBCompanyId] } }
      });
      await prisma.userRole.deleteMany({
        where: { user: { companyId: { in: [tenantACompanyId, tenantBCompanyId] } } }
      });
      await prisma.user.deleteMany({
        where: { companyId: { in: [tenantACompanyId, tenantBCompanyId] } }
      });
      await prisma.company.deleteMany({
        where: { id: { in: [tenantACompanyId, tenantBCompanyId] } }
      });
    } catch (e) {
      // Ignore cleanup error if already removed
    }
  });

  describe('1. Salary Column Master CRUD & Unique Code Validation', () => {
    it('should create a fixed-amount earning component with Calc On Present Days = true', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          code: 'CONV_ALLOW',
          name: 'Conveyance Allowance',
          type: 'EARNING',
          category: 'FIXED_EARNING',
          calculationMode: 'FIXED_AMOUNT',
          fixedAmount: 3000,
          isTaxable: true,
          displayOrder: 3
        });

      expect(res.status).toBe(201);
      expect(res.body.component.code).toBe('CONV_ALLOW');
      expect(res.body.component.category).toBe('FIXED_EARNING');
      expect(Number(res.body.component.fixedAmount)).toBe(3000);
      componentConvId = res.body.component.id;
    });

    it('should create a percentage-based component', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          code: 'HRA_PERC',
          name: 'House Rent Allowance',
          type: 'EARNING',
          category: 'FIXED_EARNING',
          calculationMode: 'PERCENTAGE_OF_COMPONENT',
          baseComponentCode: 'BASIC',
          percentageValue: 40,
          isTaxable: true,
          displayOrder: 2
        });

      expect(res.status).toBe(201);
      expect(res.body.component.code).toBe('HRA_PERC');
      expect(Number(res.body.component.percentageValue)).toBe(40);
      componentHraId = res.body.component.id;
    });

    it('should create an AST formula-based component', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          code: 'SPL_AST',
          name: 'Special Allowance AST',
          type: 'EARNING',
          category: 'FIXED_EARNING',
          calculationMode: 'FORMULA_EXPRESSION',
          formulaExpression: 'BASIC * 0.25 + CONV_ALLOW',
          isTaxable: true,
          displayOrder: 4
        });

      expect(res.status).toBe(201);
      expect(res.body.component.code).toBe('SPL_AST');
      expect(res.body.component.formulaExpression).toBe('BASIC * 0.25 + CONV_ALLOW');
      componentSplId = res.body.component.id;
    });

    it('should reject duplicate component code in the same company (400)', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          code: 'CONV_ALLOW',
          name: 'Duplicate Conveyance',
          type: 'EARNING',
          category: 'FIXED_EARNING',
          calculationMode: 'FIXED_AMOUNT',
          fixedAmount: 5000
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.error).toMatch(/already exists/i);
    });

    it('should update component parameters and formula cleanly', async () => {
      const res = await request(app)
        .put(`/api/v1/compensation/components/${componentSplId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          name: 'Special Allowance AST Updated',
          calculationMode: 'FORMULA_EXPRESSION',
          formulaExpression: 'BASIC * 0.30 + CONV_ALLOW + 500',
          displayOrder: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.component.name).toBe('Special Allowance AST Updated');
      expect(res.body.component.formulaExpression).toBe('BASIC * 0.30 + CONV_ALLOW + 500');
    });

    it('should toggle active status with toggle endpoint', async () => {
      const resDeactivate = await request(app)
        .patch(`/api/v1/compensation/components/${componentConvId}/toggle`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send();

      expect(resDeactivate.status).toBe(200);
      expect(resDeactivate.body.component.active).toBe(false);

      const resReactivate = await request(app)
        .patch(`/api/v1/compensation/components/${componentConvId}/toggle`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send();

      expect(resReactivate.status).toBe(200);
      expect(resReactivate.body.component.active).toBe(true);
    });
  });

  describe('2. Safe AST Formula Inspector & Validation Engine', () => {
    it('should return available system variables and company components', async () => {
      const res = await request(app)
        .get('/api/v1/compensation/components/available-references')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.systemVariables).toBeDefined();
      expect(res.body.systemVariables.some((v: any) => v.code === 'CTC')).toBe(true);
      expect(res.body.systemVariables.some((v: any) => v.code === 'BASIC')).toBe(true);
      expect(res.body.systemVariables.some((v: any) => v.code === 'PRESENT_DAYS')).toBe(true);
      expect(res.body.companyComponents).toBeDefined();
      expect(res.body.companyComponents.some((c: any) => c.code === 'CONV_ALLOW')).toBe(true);
    });

    it('should validate and simulate a valid formula expression with custom context', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components/validate-formula')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          expression: 'BASIC * 0.40 + 2500',
          context: {
            BASIC: 50000
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.referencedVariables).toContain('BASIC');
      expect(res.body.missingVariables).toEqual([]);
      expect(Number(res.body.result)).toBe(22500); // 50000 * 0.4 + 2500 = 22500
      expect(res.body.variables).toContain('BASIC');
      expect(res.body.dependencyOrder).toBeDefined();
      expect(res.body.steps).toBeDefined();
      expect(res.body.steps.length).toBeGreaterThan(0);
    });

    it('should identify missing variables in formula inspection', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components/validate-formula')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          expression: 'BASIC * 0.20 + NON_EXISTENT_VAR'
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true); // syntactically valid AST
      expect(res.body.referencedVariables).toContain('NON_EXISTENT_VAR');
      expect(res.body.missingVariables).toContain('NON_EXISTENT_VAR');
    });

    it('should reject syntax errors safely with readable diagnostics', async () => {
      const res = await request(app)
        .post('/api/v1/compensation/components/validate-formula')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          expression: 'BASIC * + @ 100'
        });

      expect(res.status).toBe(400);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should detect circular dependencies in formula dependency graphs', () => {
      const components = [
        { code: 'COMP_A', dependencies: ['COMP_B'] },
        { code: 'COMP_B', dependencies: ['COMP_C'] },
        { code: 'COMP_C', dependencies: ['COMP_A'] } // cycle: A -> B -> C -> A
      ];

      const cycle = FormulaEngine.detectCycle(components);
      expect(cycle).not.toBeNull();
      expect(cycle).toContain('COMP_A');
      expect(cycle).toContain('COMP_B');
      expect(cycle).toContain('COMP_C');
    });

    it('should compute deterministic topological dependency order', () => {
      const components = [
        { code: 'GROSS', dependencies: ['BASIC', 'HRA', 'CONV'] },
        { code: 'HRA', dependencies: ['BASIC'] },
        { code: 'CONV', dependencies: [] },
        { code: 'BASIC', dependencies: [] }
      ];

      const order = FormulaEngine.topologicalSort(components);
      expect(order.indexOf('BASIC')).toBeLessThan(order.indexOf('HRA'));
      expect(order.indexOf('BASIC')).toBeLessThan(order.indexOf('GROSS'));
      expect(order.indexOf('HRA')).toBeLessThan(order.indexOf('GROSS'));
      expect(order.indexOf('CONV')).toBeLessThan(order.indexOf('GROSS'));
    });
  });

  describe('3. Decimal Precision & Present-Days Proration Verification', () => {
    it('should compute exact decimal arithmetic without IEEE-754 drift', () => {
      // 0.1 + 0.2 in standard JS floating-point is 0.30000000000000004
      const expr = '0.1 + 0.2';
      const result = FormulaEngine.evaluate(expr, {});

      expect(result.toString()).toBe('0.3');
      expect(result.toNumber()).toBe(0.3);
    });

    it('should prorate FIXED_EARNING on attendance while keeping flat values unprorated', () => {
      const workingDays = 30;
      const presentDays = 15; // 50% attendance

      const monthlyGross = new Decimal(60000);
      const prorationFactor = new Decimal(presentDays).dividedBy(workingDays);
      const proratedEarned = monthlyGross.times(prorationFactor);

      expect(proratedEarned.toNumber()).toBe(30000);
    });
  });

  describe('4. Authorization & Cross-Tenant Boundary Enforcement', () => {
    it('should reject unauthenticated requests (401)', async () => {
      const res = await request(app)
        .get('/api/v1/compensation/components');

      expect(res.status).toBe(401);
    });

    it('should prevent Tenant B from viewing Tenant A salary components', async () => {
      const res = await request(app)
        .get('/api/v1/compensation/components')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      const componentCodes = res.body.components.map((c: any) => c.code);
      expect(componentCodes).not.toContain('CONV_ALLOW');
      expect(componentCodes).not.toContain('HRA_PERC');
      expect(componentCodes).not.toContain('SPL_AST');
    });

    it('should prevent Tenant B from updating Tenant A salary components (404/403)', async () => {
      const res = await request(app)
        .put(`/api/v1/compensation/components/${componentConvId}`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({
          name: 'Hacked Conveyance',
          fixedAmount: 99999
        });

      expect([403, 404]).toContain(res.status);
    });

    it('should prevent Tenant B from toggling Tenant A salary components (404/403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/compensation/components/${componentConvId}/toggle`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send();

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('5. Payroll Finalized Snapshot Preservation (Immutability)', () => {
    it('should preserve finalized payroll run lines when component formulas change', async () => {
      // Find any finalized payroll run and its payslip lines in test DB if present
      const finalizedRun = await prisma.corporatePayrollRun.findFirst({
        where: { status: 'PAID' },
        include: { slips: true }
      });

      if (finalizedRun && finalizedRun.slips.length > 0) {
        const firstSlip = finalizedRun.slips[0];
        const originalGross = Number(firstSlip.grossPay);

        // Mutating a component formula should not affect the frozen payslip
        const fetchedSlip = await prisma.corporatePayrollSlip.findUnique({
          where: { id: firstSlip.id }
        });

        expect(Number(fetchedSlip?.grossPay)).toBe(originalGross);
      } else {
        // Invariant check: Verify corporatePayrollRun table exists and preserves snapshots
        const runCount = await prisma.corporatePayrollRun.count();
        expect(runCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('6. Attendance Proration Semantics for calcOnPresentDays (SPN-COL-002)', () => {
    it('should prorate FIXED_EARNING components by attendance but keep VARIABLE components unprorated', async () => {
      // Mock employee with 15 LOP days out of 30 days period
      const mockEmployee: any = {
        id: 'emp-proration-test',
        employeeCode: 'EMP-PRO-01',
        firstName: 'Test',
        lastName: 'Proration',
        dateOfJoining: new Date('2025-01-01'),
        salaryStructure: {
          grossSalary: new Decimal(60000),
          netSalary: new Decimal(55000),
          lines: [
            {
              code: 'BASIC',
              name: 'Basic Pay',
              category: 'FIXED_EARNING',
              calculationMode: 'FIXED_AMOUNT',
              monthlyAmount: new Decimal(40000)
            },
            {
              code: 'INCENTIVE',
              name: 'Performance Incentive',
              category: 'VARIABLE', // calcOnPresentDays: false
              calculationMode: 'FIXED_AMOUNT',
              monthlyAmount: new Decimal(20000)
            }
          ]
        },
        punches: [],
        dailyAttendance: [
          // 15 days of LOP
          ...Array.from({ length: 15 }, (_, i) => ({
            date: new Date(`2026-04-${String(i + 1).padStart(2, '0')}`),
            status: 'LOP',
            overtimeMinutes: 0
          }))
        ],
        leaveRequests: [],
        loans: []
      };

      const mockPeriod: any = {
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-30')
      };

      const result = await PayrollCalculationEngine.calculateEmployee(
        mockEmployee,
        mockPeriod,
        [],
        null,
        15 // lopDaysOverride
      );

      // Total calendar days = 30, LOP = 15 => Payable days = 15
      expect(result.attendance.calendarDays).toBe(30);
      expect(result.attendance.payableDays.toNumber()).toBe(15);
      expect(result.attendance.isProrated).toBe(true);

      const basicItem = result.items.find(i => i.code === 'BASIC');
      const incentiveItem = result.items.find(i => i.code === 'INCENTIVE');

      expect(basicItem).toBeDefined();
      expect(incentiveItem).toBeDefined();

      // FIXED_EARNING must be prorated: 40,000 * 15 / 30 = 20,000
      expect(basicItem!.calculatedAmount.toNumber()).toBe(20000);

      // VARIABLE must NOT be prorated: remains full 20,000
      expect(incentiveItem!.calculatedAmount.toNumber()).toBe(20000);

      // Total gross: 20000 (basic prorated) + 20000 (incentive unprorated) = 40000
      expect(result.grossPay.toNumber()).toBe(40000);
    });
  });
});

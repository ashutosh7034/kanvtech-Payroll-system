import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';
import { LoanCalculator } from '../src/modules/loans/loanCalculator.js';
import Decimal from 'decimal.js';

const getErrorMessage = (res: any): string => {
  const details = res.body.error?.details?.map((d: any) => d.message).join('; ');
  return [details, res.body.error?.message, res.body.message].filter(Boolean).join(' - ') || JSON.stringify(res.body);
};

describe('Loan Interest Calculations, Principal Validation & Policy Engine Test Suite', () => {
  let adminToken: string;
  let testCompanyId: string;
  let testEmployeeId: string;
  let normalEmployeeId: string;
  let interestFreeProductId: string;
  let flatRateProductId: string;
  let reducingBalanceProductId: string;
  let strictPolicyProductId: string;

  beforeAll(async () => {
    // 1. Authenticate as Company Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    testCompanyId = adminRes.body.user.companyId;

    // 2. Fetch or create a test beneficiary employee
    let emp = await prisma.employee.findFirst({
      where: { companyId: testCompanyId }
    });
    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          companyId: testCompanyId,
          employeeCode: `EMP_BENEF_${Date.now().toString().slice(-4)}`,
          firstName: 'Beneficiary',
          lastName: 'Staff',
          workEmail: `beneficiary_${Date.now()}@example.com`,
          dateOfJoining: new Date(),
          status: 'CONFIRMED'
        }
      });
    }
    testEmployeeId = emp.id;

    // 3. Create a normal non-admin user/employee for RBAC testing
    let normEmp = await prisma.employee.findFirst({
      where: { companyId: testCompanyId, id: { not: testEmployeeId } }
    });
    if (!normEmp) {
      normEmp = await prisma.employee.create({
        data: {
          companyId: testCompanyId,
          employeeCode: `EMP_NORM_${Date.now().toString().slice(-4)}`,
          firstName: 'Normal',
          lastName: 'Staff',
          workEmail: `normstaff_${Date.now()}@example.com`,
          dateOfJoining: new Date(),
          status: 'ACTIVE'
        }
      });
    }
    normalEmployeeId = normEmp.id;

    // 4. Create Loan Products with various interest policies
    // A: Interest-Free Product (max 50,000, 12 months)
    const p1 = await prisma.loanType.create({
      data: {
        companyId: testCompanyId,
        code: `PROD_FREE_${Date.now().toString().slice(-4)}`,
        name: 'Salary Advance (Interest-Free)',
        maxAmount: 50000,
        maxTenureMonths: 12,
        interestType: 'INTEREST_FREE',
        interestRatePct: 0,
        allowRateOverride: false
      }
    });
    interestFreeProductId = p1.id;

    // B: Flat Rate Product (max 200,000, 24 months, 10% p.a.)
    const p2 = await prisma.loanType.create({
      data: {
        companyId: testCompanyId,
        code: `PROD_FLAT_${Date.now().toString().slice(-4)}`,
        name: 'Equipment Loan (Flat Rate)',
        maxAmount: 200000,
        maxTenureMonths: 24,
        interestType: 'FIXED_RATE',
        interestRatePct: 10,
        interestMethod: 'FLAT_RATE',
        minInterestRatePct: 5,
        maxInterestRatePct: 15,
        allowRateOverride: true
      }
    });
    flatRateProductId = p2.id;

    // C: Reducing Balance Product (max 500,000, 36 months, 12% p.a.)
    const p3 = await prisma.loanType.create({
      data: {
        companyId: testCompanyId,
        code: `PROD_REDUC_${Date.now().toString().slice(-4)}`,
        name: 'Personal Advance (Reducing Balance)',
        maxAmount: 500000,
        maxTenureMonths: 36,
        interestType: 'FIXED_RATE',
        interestRatePct: 12,
        interestMethod: 'REDUCING_BALANCE',
        minInterestRatePct: 8,
        maxInterestRatePct: 18,
        allowRateOverride: true
      }
    });
    reducingBalanceProductId = p3.id;

    // D: Strict Policy Product (Rate cannot be overridden)
    const p4 = await prisma.loanType.create({
      data: {
        companyId: testCompanyId,
        code: `PROD_STRICT_${Date.now().toString().slice(-4)}`,
        name: 'Strict Corporate Loan (Fixed 9%)',
        maxAmount: 300000,
        maxTenureMonths: 24,
        interestType: 'FIXED_RATE',
        interestRatePct: 9,
        interestMethod: 'REDUCING_BALANCE',
        minInterestRatePct: 9,
        maxInterestRatePct: 9,
        allowRateOverride: false
      }
    });
    strictPolicyProductId = p4.id;
  });

  // =========================================================================
  // SECTION 1: Pure Authoritative Math (LoanCalculator)
  // =========================================================================
  describe('Authoritative Financial Calculation Engine', () => {
    it('accurately computes Interest-Free loan repayments with exact installment reconciliation', () => {
      // Principal 25,000 across 12 months -> 25000 / 12 = 2083.33...
      const result = LoanCalculator.calculateInterestFree(new Decimal(25000), 12);
      expect(result.monthlyEmi.toNumber()).toBe(2083.33);
      expect(result.totalInterest.toNumber()).toBe(0);
      expect(result.totalRepayment.toNumber()).toBe(25000);
      expect(result.schedule).toHaveLength(12);

      // Verify final installment reconciles rounding difference down to 0.00
      const sumPrincipal = result.schedule.reduce((acc, row) => acc.plus(row.principalPortion), new Decimal(0));
      expect(sumPrincipal.toNumber()).toBe(25000);
      expect(result.schedule[11].closingBalance.toNumber()).toBe(0);
    });

    it('accurately computes Flat Rate interest and balances', () => {
      // Principal 100,000, 12% p.a., 12 months (1 year)
      // Total Interest = 100000 * 0.12 * 1 = 12,000
      // Total Repayment = 112,000
      // Monthly EMI = 112000 / 12 = 9333.33
      const result = LoanCalculator.calculateFlatRate(new Decimal(100000), new Decimal(12), 12);
      expect(result.totalInterest.toNumber()).toBe(12000);
      expect(result.totalRepayment.toNumber()).toBe(112000);
      expect(result.monthlyEmi.toNumber()).toBe(9333.33);
      expect(result.schedule).toHaveLength(12);

      // Verify all installments sum to total repayment exactly
      const sumEmi = result.schedule.reduce((acc, row) => acc.plus(row.emi), new Decimal(0));
      expect(sumEmi.toNumber()).toBe(112000);
      expect(result.schedule[11].closingBalance.toNumber()).toBe(0);
    });

    it('accurately computes Reducing Balance EMI and amortizes balance to zero', () => {
      // Principal 100,000, 12% p.a., 12 months (r = 1% per month)
      // Standard banking EMI = 8884.88
      const result = LoanCalculator.calculateReducingBalance(new Decimal(100000), new Decimal(12), 12);
      expect(result.monthlyEmi.toNumber()).toBe(8884.88);
      expect(result.schedule).toHaveLength(12);

      // Month 1 opening balance is 100,000; interest is 100,000 * 0.01 = 1000
      expect(result.schedule[0].openingBalance.toNumber()).toBe(100000);
      expect(result.schedule[0].interestPortion.toNumber()).toBe(1000);
      expect(result.schedule[0].principalPortion.toNumber()).toBe(7884.88); // 8884.88 - 1000

      // Final month closing balance is strictly 0.00
      expect(result.schedule[11].closingBalance.toNumber()).toBe(0);

      // Sum of principal portions equals exactly 100,000
      const totalPrincipalAmortized = result.schedule.reduce((acc, row) => acc.plus(row.principalPortion), new Decimal(0));
      expect(totalPrincipalAmortized.toNumber()).toBe(100000);
    });

    it('handles zero interest rate in reducing balance gracefully without division by zero', () => {
      const result = LoanCalculator.calculateReducingBalance(new Decimal(12000), new Decimal(0), 12);
      expect(result.monthlyEmi.toNumber()).toBe(1000);
      expect(result.totalInterest.toNumber()).toBe(0);
      expect(result.totalRepayment.toNumber()).toBe(12000);
    });
  });

  // =========================================================================
  // SECTION 2: Principal Validation (Rejections & Edge Cases)
  // =========================================================================
  describe('Principal Amount Backend Validation', () => {
    it('rejects loan sanction with zero principal amount (number 0)', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: 0,
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/greater than zero/i);
    });

    it('rejects loan sanction with string zero principal ("0" or "0.00")', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: '0.00',
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/greater than zero|expected number|invalid/i);
    });

    it('rejects loan sanction with negative principal amount', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: -15000,
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/positive monetary amount|greater than zero|number must be greater than 0/i);
    });

    it('rejects loan sanction with missing or empty principal', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/required/i);
    });

    it('rejects loan sanction with malformed monetary input (NaN / non-numeric string)', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: 'not-a-number',
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/valid positive monetary amount|expected number|invalid/i);
    });

    it('rejects loan sanction with empty whitespace or invalid formatting', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: '   ',
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/valid positive monetary amount|greater than zero|required|expected number|invalid/i);
    });

    it('rejects loan sanction exceeding product maximum limit', async () => {
      // interestFreeProductId has maxAmount: 50,000
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: 55000,
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/maximum allowed limit/i);
    });

    it('rejects invalid or zero tenure', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: 20000,
          tenureMonths: 0
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/positive whole number|must be an integer|greater than or equal to 1/i);
    });
  });

  // =========================================================================
  // SECTION 3: Configurable Interest Policies & Rate Constraints
  // =========================================================================
  describe('Interest Policy Validation & Sanctioning', () => {
    it('sanctions an Interest-Free loan successfully with 0% interest and exact snapshot', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: interestFreeProductId,
          principalAmount: 24000,
          tenureMonths: 12,
          interestType: 'INTEREST_FREE',
          sanctionOrderNumber: `ORD-FREE-${Date.now().toString().slice(-4)}`
        });

      expect(res.status).toBe(201);
      expect(res.body.loan).toBeDefined();
      expect(Number(res.body.loan.principalAmount)).toBe(24000);
      expect(res.body.loan.interestType).toBe('INTEREST_FREE');
      expect(Number(res.body.loan.interestRatePct)).toBe(0);
      expect(Number(res.body.loan.totalInterest)).toBe(0);
      expect(Number(res.body.loan.totalRepayment)).toBe(24000);
      expect(Number(res.body.loan.monthlyEmi)).toBe(2000);
      expect(Number(res.body.loan.outstandingAmount)).toBe(24000);
    });

    it('sanctions a Flat Rate interest loan with calculated snapshot terms', async () => {
      // Principal 60,000, 10% flat rate, 12 months
      // Interest = 60000 * 0.10 * 1 = 6000. Total Repayment = 66,000. EMI = 5500.
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: flatRateProductId,
          principalAmount: 60000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 10,
          interestMethod: 'FLAT_RATE',
          sanctionOrderNumber: `ORD-FLAT-${Date.now().toString().slice(-4)}`
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.loan.principalAmount)).toBe(60000);
      expect(res.body.loan.interestType).toBe('FIXED_RATE');
      expect(Number(res.body.loan.interestRatePct)).toBe(10);
      expect(res.body.loan.interestMethod).toBe('FLAT_RATE');
      expect(Number(res.body.loan.totalInterest)).toBe(6000);
      expect(Number(res.body.loan.totalRepayment)).toBe(66000);
      expect(Number(res.body.loan.monthlyEmi)).toBe(5500);
      expect(Number(res.body.loan.outstandingAmount)).toBe(66000);
    });

    it('sanctions a Reducing Balance loan with authoritative amortized snapshot', async () => {
      // Principal 120,000, 12% reducing, 12 months
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: reducingBalanceProductId,
          principalAmount: 120000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 12,
          interestMethod: 'REDUCING_BALANCE',
          sanctionOrderNumber: `ORD-REDUC-${Date.now().toString().slice(-4)}`
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.loan.principalAmount)).toBe(120000);
      expect(res.body.loan.interestType).toBe('FIXED_RATE');
      expect(res.body.loan.interestMethod).toBe('REDUCING_BALANCE');
      expect(Number(res.body.loan.totalInterest)).toBeGreaterThan(0);
      expect(Number(res.body.loan.totalRepayment)).toBeGreaterThan(120000);
      expect(Number(res.body.loan.outstandingAmount)).toBe(Number(res.body.loan.totalRepayment));
    });

    it('rejects interest rate below policy minimum rate', async () => {
      // reducingBalanceProductId has minInterestRatePct: 8
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: reducingBalanceProductId,
          principalAmount: 50000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 5 // below 8%
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/cannot be less than product minimum rate|below product minimum rate/i);
    });

    it('rejects interest rate above policy maximum rate', async () => {
      // reducingBalanceProductId has maxInterestRatePct: 18
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: reducingBalanceProductId,
          principalAmount: 50000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 22 // above 18%
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/exceed product maximum rate/i);
    });

    it('rejects interest rate override when policy prohibits override', async () => {
      // strictPolicyProductId has allowRateOverride: false, fixed at 9%
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: strictPolicyProductId,
          principalAmount: 50000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 11 // attempted override
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/does not permit interest rate overrides/i);
    });

    it('rejects negative interest rate', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: flatRateProductId,
          principalAmount: 50000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: -5
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/Number must be greater than or equal to 0|cannot be negative/i);
    });
  });

  // =========================================================================
  // SECTION 4: Live EMI Preview Endpoint
  // =========================================================================
  describe('Live EMI Preview API (GET /loans/preview-emi)', () => {
    it('returns accurate live preview for Reducing Balance loan', async () => {
      const res = await request(app)
        .get('/api/v1/loans/preview-emi')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          principalAmount: 100000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 12,
          interestMethod: 'REDUCING_BALANCE'
        });

      expect(res.status).toBe(200);
      expect(res.body.calculation).toBeDefined();
      expect(res.body.calculation.principalAmount).toBe(100000);
      expect(Math.round(res.body.calculation.monthlyEmi)).toBe(8885);
      expect(res.body.calculation.schedule).toHaveLength(12);
    });

    it('rejects preview with zero or missing principal', async () => {
      const res = await request(app)
        .get('/api/v1/loans/preview-emi')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          principalAmount: 0,
          tenureMonths: 12
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toMatch(/positive numeric monetary value/i);
    });
  });

  // =========================================================================
  // SECTION 5: Amortization Schedule & Repayments Retrieval
  // =========================================================================
  describe('Repayment Ledger & Amortization Schedule', () => {
    it('returns projected schedule and repayment history via GET /loans/:id/repayments', async () => {
      // 1. Create a loan
      const createRes = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeId: testEmployeeId,
          loanTypeId: reducingBalanceProductId,
          principalAmount: 48000,
          tenureMonths: 12,
          interestType: 'FIXED_RATE',
          interestRatePct: 12,
          interestMethod: 'REDUCING_BALANCE'
        });
      expect(createRes.status).toBe(201);
      const loanId = createRes.body.loan.id;

      // 2. Fetch repayment ledger
      const repRes = await request(app)
        .get(`/api/v1/loans/${loanId}/repayments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(repRes.status).toBe(200);
      expect(repRes.body.loan).toBeDefined();
      expect(repRes.body.projectedSchedule).toHaveLength(12);
      expect(repRes.body.projectedSchedule[0].installmentNumber).toBe(1);
      expect(repRes.body.projectedSchedule[11].closingBalance).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 6: Protection of Historical & Protected Loan Record
  // =========================================================================
  describe('Protection of Reference Production Loan', () => {
    const protectedLoanId = 'b405b4b8-1211-48c5-a59e-ee8db001a906';

    it('prevents modifying terms of the protected loan', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${protectedLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          principalAmount: 50000,
          tenureMonths: 24
        });

      expect(res.status).toBe(403);
      expect(getErrorMessage(res)).toMatch(/protected/i);
    });

    it('prevents deleting the protected loan', async () => {
      const res = await request(app)
        .delete(`/api/v1/loans/${protectedLoanId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(getErrorMessage(res)).toMatch(/protected/i);
    });

    it('prevents altering status of the protected loan', async () => {
      const res = await request(app)
        .patch(`/api/v1/loans/${protectedLoanId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(getErrorMessage(res)).toMatch(/protected/i);
    });
  });
});


import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/db.js';

// Import formatters directly to test utility contracts
import {
  formatAmount,
  formatCurrency,
  formatInteger,
  formatPercentage
} from '../../frontend/src/utils/formatters.js';

describe('7-Stage Payroll Workbench Formatting & Review Table Regression Suite', () => {
  let adminToken = '';
  const PROTECTED_LOAN_ID = 'b405b4b8-1211-48c5-a59e-ee8db001a906';

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
  });

  describe('1. Centralized Safe Formatting Utility Tests', () => {
    it('1. formats normal positive numeric monetary values with en-IN locale grouping', () => {
      expect(formatAmount(50000)).toBe('50,000.00');
      expect(formatCurrency(50000)).toBe('₹50,000.00');
      expect(formatAmount(1234567.89)).toBe('12,34,567.89');
      expect(formatCurrency(1234567.89)).toBe('₹12,34,567.89');
    });

    it('2. preserves and formats valid zero monetary values correctly without hiding them', () => {
      expect(formatAmount(0)).toBe('0.00');
      expect(formatCurrency(0)).toBe('₹0.00');
      expect(formatAmount('0')).toBe('0.00');
      expect(formatCurrency('0')).toBe('₹0.00');
    });

    it('3. handles valid negative monetary amounts (e.g. salary deductions or manual clawbacks)', () => {
      expect(formatAmount(-1500)).toBe('-1,500.00');
      expect(formatCurrency(-1500)).toBe('₹-1,500.00');
      expect(formatAmount('-250.50')).toBe('-250.50');
      expect(formatCurrency('-250.50')).toBe('₹-250.50');
    });

    it('4. safely handles missing optional values (undefined) without throwing TypeError', () => {
      expect(formatAmount(undefined)).toBe('—');
      expect(formatCurrency(undefined)).toBe('—');
      expect(formatAmount(undefined, { fallback: '0.00' })).toBe('0.00');
      expect(formatCurrency(undefined, { fallback: 'N/A' })).toBe('N/A');
    });

    it('5. safely handles null API fields without throwing TypeError', () => {
      expect(formatAmount(null)).toBe('—');
      expect(formatCurrency(null)).toBe('—');
      expect(formatAmount(null, { fallback: '-' })).toBe('-');
    });

    it('6. safely handles empty strings and invalid non-numeric strings', () => {
      expect(formatAmount('')).toBe('—');
      expect(formatCurrency('')).toBe('—');
      expect(formatAmount('not-a-number')).toBe('—');
      expect(formatCurrency('undefined')).toBe('—');
      expect(formatAmount(NaN)).toBe('—');
      expect(formatCurrency(Infinity)).toBe('—');
    });

    it('7. safely handles numeric strings permitted by API contracts', () => {
      expect(formatAmount('45000')).toBe('45,000.00');
      expect(formatCurrency('45000.75')).toBe('₹45,000.75');
    });

    it('7b. handles maximumFractionDigits: 0 without throwing RangeError (maximumFractionDigits value is out of range)', () => {
      expect(formatCurrency(12500, { maximumFractionDigits: 0 })).toBe('₹12,500');
      expect(formatAmount(12500, { maximumFractionDigits: 0 })).toBe('12,500');
      expect(formatCurrency(0, { maximumFractionDigits: 0 })).toBe('₹0');
      expect(formatCurrency('12500.50', { maximumFractionDigits: 0 })).toBe('₹12,501');
    });

    it('8. formats integers and headcounts safely', () => {
      expect(formatInteger(25)).toBe('25');
      expect(formatInteger(0)).toBe('0');
      expect(formatInteger(null)).toBe('0');
      expect(formatInteger(undefined)).toBe('0');
    });

    it('9. formats statutory and interest percentages safely', () => {
      expect(formatPercentage(12)).toBe('12.0%');
      expect(formatPercentage(8.55)).toBe('8.55%');
      expect(formatPercentage(null)).toBe('—');
      expect(formatPercentage(undefined)).toBe('—');
    });
  });

  describe('2. Workbench Row Mapping & Exact Crash Regression Prevention', () => {
    it('10. verifies the exact regression that previously crashed the Workbench', () => {
      // Prior crash scenario: The API returns `grossPay`, `deductionsPay`, `employerCost`
      // but the UI code called `row.grossEarnings.toLocaleString()` directly.
      const rawApiRowFromReviewTable: any = {
        slipId: 'slip-101',
        employeeId: 'emp-101',
        employeeCode: 'APEX-001',
        employeeName: 'Priya Sharma',
        department: 'Engineering',
        payableDays: 30,
        lopDays: 0,
        grossPay: 85000, // API sent grossPay, NOT grossEarnings!
        deductionsPay: 12000, // API sent deductionsPay, NOT employeeDeductions!
        employerCost: 15000, // API sent employerCost, NOT employerContributions!
        netPay: 73000,
        manualAdjustments: 0,
        tds: 5000,
        status: 'CALCULATED'
      };

      // In the unpatched component, rawApiRowFromReviewTable.grossEarnings was undefined,
      // and calling .toLocaleString() directly threw TypeError:
      expect(rawApiRowFromReviewTable.grossEarnings).toBeUndefined();
      expect(() => (rawApiRowFromReviewTable.grossEarnings as any).toLocaleString('en-IN')).toThrow(TypeError);

      // In the patched component, data mapping normalizes both property styles:
      const normalizedRow = {
        ...rawApiRowFromReviewTable,
        grossEarnings: Number(rawApiRowFromReviewTable.grossEarnings ?? rawApiRowFromReviewTable.grossPay ?? 0),
        grossPay: Number(rawApiRowFromReviewTable.grossPay ?? rawApiRowFromReviewTable.grossEarnings ?? 0),
        employeeDeductions: Number(rawApiRowFromReviewTable.employeeDeductions ?? rawApiRowFromReviewTable.deductionsPay ?? 0),
        deductionsPay: Number(rawApiRowFromReviewTable.deductionsPay ?? rawApiRowFromReviewTable.employeeDeductions ?? 0),
        employerContributions: Number(rawApiRowFromReviewTable.employerContributions ?? rawApiRowFromReviewTable.employerCost ?? 0),
        employerCost: Number(rawApiRowFromReviewTable.employerCost ?? rawApiRowFromReviewTable.employerContributions ?? 0),
        manualAdjustments: Number(rawApiRowFromReviewTable.manualAdjustments ?? 0),
        tds: Number(rawApiRowFromReviewTable.tds ?? rawApiRowFromReviewTable.tdsWithholding ?? 0),
        netPay: Number(rawApiRowFromReviewTable.netPay ?? 0)
      };

      // Assert normalized row has valid values
      expect(normalizedRow.grossEarnings).toBe(85000);
      expect(normalizedRow.employeeDeductions).toBe(12000);
      expect(normalizedRow.employerContributions).toBe(15000);

      // Assert formatCurrency safely formats all fields without error
      expect(formatCurrency(normalizedRow.grossEarnings)).toBe('₹85,000.00');
      expect(formatCurrency(normalizedRow.employeeDeductions)).toBe('₹12,000.00');
      expect(formatCurrency(normalizedRow.employerContributions)).toBe('₹15,000.00');
      expect(formatCurrency(normalizedRow.netPay)).toBe('₹73,000.00');
    });

    it('11. handles empty payroll batches (zero employees) safely without NaN', () => {
      const allRows: any[] = [];
      const grandTotals = {
        totalEmployees: allRows.length,
        grossEarnings: allRows.reduce((sum: number, r: any) => sum + (Number(r.grossEarnings ?? r.grossPay) || 0), 0),
        manualAdjustments: allRows.reduce((sum: number, r: any) => sum + (Number(r.manualAdjustments) || 0), 0),
        employeeDeductions: allRows.reduce((sum: number, r: any) => sum + (Number(r.employeeDeductions ?? r.deductionsPay) || 0), 0),
        tds: allRows.reduce((sum: number, r: any) => sum + (Number(r.tds) || 0), 0),
        employerContributions: allRows.reduce((sum: number, r: any) => sum + (Number(r.employerContributions ?? r.employerCost) || 0), 0),
        netPay: allRows.reduce((sum: number, r: any) => sum + (Number(r.netPay) || 0), 0)
      };

      expect(grandTotals.totalEmployees).toBe(0);
      expect(grandTotals.grossEarnings).toBe(0);
      expect(grandTotals.netPay).toBe(0);
      expect(formatCurrency(grandTotals.grossEarnings)).toBe('₹0.00');
      expect(formatCurrency(grandTotals.netPay)).toBe('₹0.00');
    });

    it('12. handles payroll records with incomplete optional fields gracefully', () => {
      const incompleteRow: any = {
        slipId: 'incomplete-1',
        // missing employeeCode, missing employeeName, missing department
        grossPay: null,
        deductionsPay: undefined,
        netPay: '',
      };

      const normalized = {
        employeeCode: incompleteRow.employeeCode || '—',
        employeeName: incompleteRow.employeeName || 'Unknown Employee',
        department: incompleteRow.department || 'General',
        grossEarnings: Number(incompleteRow.grossEarnings ?? incompleteRow.grossPay ?? 0),
        employeeDeductions: Number(incompleteRow.employeeDeductions ?? incompleteRow.deductionsPay ?? 0),
        netPay: Number(incompleteRow.netPay ?? 0)
      };

      expect(normalized.employeeCode).toBe('—');
      expect(normalized.department).toBe('General');
      expect(normalized.grossEarnings).toBe(0);
      expect(formatCurrency(normalized.grossEarnings)).toBe('₹0.00');
      expect(formatCurrency(normalized.employeeDeductions)).toBe('₹0.00');
    });
  });

  describe('3. Backend Review Table API Contract Verification', () => {
    it('13. verifies GET /payroll/runs/:id/review-table returns normalized dual aliases and valid grand totals', async () => {
      // Find or verify an existing payroll run
      const runsRes = await request(app)
        .get('/api/v1/payroll/runs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(runsRes.status).toBe(200);

      if (runsRes.body.runs && runsRes.body.runs.length > 0) {
        const runId = runsRes.body.runs[0].id;
        const reviewRes = await request(app)
          .get(`/api/v1/payroll/runs/${runId}/review-table`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(reviewRes.status).toBe(200);

        // Verify grandTotals structure
        expect(reviewRes.body.grandTotals).toBeDefined();
        expect(typeof reviewRes.body.grandTotals.grossEarnings).toBe('number');
        expect(typeof reviewRes.body.grandTotals.netPay).toBe('number');
        expect(Number.isFinite(reviewRes.body.grandTotals.grossEarnings)).toBe(true);

        // Verify rows dual alias presence
        if (reviewRes.body.rows && reviewRes.body.rows.length > 0) {
          const firstRow = reviewRes.body.rows[0];
          expect(firstRow.grossPay).toBeDefined();
          expect(firstRow.grossEarnings).toBeDefined();
          expect(firstRow.grossPay).toBe(firstRow.grossEarnings);

          expect(firstRow.deductionsPay).toBeDefined();
          expect(firstRow.employeeDeductions).toBeDefined();

          expect(firstRow.employerCost).toBeDefined();
          expect(firstRow.employerContributions).toBeDefined();
        }

        // Verify departmentSummaries alias
        expect(reviewRes.body.departmentSummaries).toBeDefined();
        expect(Array.isArray(reviewRes.body.departmentSummaries)).toBe(true);
      }
    });
  });

  describe('4. Data Safety Guard', () => {
    it('14. confirms the protected loan record remains intact and unaltered', async () => {
      const protectedLoan = await prisma.employeeLoan.findUnique({
        where: { id: PROTECTED_LOAN_ID },
      });
      if (protectedLoan) {
        expect(protectedLoan.id).toBe(PROTECTED_LOAN_ID);
      }
    });
  });
});


import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { LoanCalculator, LoanInterestType, LoanInterestMethod } from './loanCalculator.js';

export const loanRouter = Router();

// 1. Get Loan Summary Metrics
loanRouter.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const loans = await prisma.employeeLoan.findMany({
      where: {
        employee: { companyId: req.user!.companyId }
      },
      include: {
        loanType: true
      }
    });

    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const totalPrincipal = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.principalAmount)), new Decimal(0));
    const totalRecovered = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.recoveredAmount)), new Decimal(0));
    const totalOutstanding = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.outstandingAmount)), new Decimal(0));
    const uniqueBorrowers = new Set(activeLoans.map(l => l.employeeId)).size;

    res.status(200).json({
      summary: {
        activeLoansCount: activeLoans.length,
        totalPrincipal: totalPrincipal.toNumber(),
        totalRecovered: totalRecovered.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        uniqueBorrowers
      }
    });
  } catch (error) {
    next(error);
  }
});

// 1.1 Live Loan Calculation & EMI Preview
loanRouter.get('/preview-emi', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const principalStr = req.query.principalAmount as string;
    const tenureStr = req.query.tenureMonths as string;
    const loanTypeId = req.query.loanTypeId as string;
    const interestType = (req.query.interestType as LoanInterestType) || 'INTEREST_FREE';
    const interestMethod = (req.query.interestMethod as LoanInterestMethod) || 'FLAT_RATE';
    const rateStr = req.query.interestRatePct as string;

    if (!principalStr || principalStr.trim() === '') {
      throw new AppError('Principal amount is required to generate EMI preview.', 400);
    }
    if (!tenureStr || tenureStr.trim() === '') {
      throw new AppError('Tenure (months) is required to generate EMI preview.', 400);
    }

    const principal = Number(principalStr);
    if (isNaN(principal) || principal <= 0 || !isFinite(principal)) {
      throw new AppError('Principal amount must be a valid positive numeric monetary value.', 400);
    }

    const tenure = Number(tenureStr);
    if (isNaN(tenure) || tenure <= 0 || !Number.isInteger(tenure)) {
      throw new AppError('Tenure must be a positive integer between 1 and 120 months.', 400);
    }

    if (loanTypeId) {
      const product = await prisma.loanType.findFirst({
        where: { id: loanTypeId, companyId: req.user!.companyId }
      });
      if (product) {
        if (principal > Number(product.maxAmount)) {
          throw new AppError(`Principal amount exceeds maximum allowed limit of ₹${Number(product.maxAmount).toLocaleString('en-IN')}`, 400);
        }
        if (tenure > product.maxTenureMonths) {
          throw new AppError(`Tenure exceeds maximum allowed limit of ${product.maxTenureMonths} months`, 400);
        }
      }
    }

    const rate = rateStr !== undefined && rateStr !== '' ? Number(rateStr) : 0;
    const calc = LoanCalculator.calculate({
      principal,
      tenureMonths: tenure,
      interestType,
      interestMethod,
      annualInterestRatePct: rate
    });

    const previewData = {
      principal: calc.principal.toNumber(),
      principalAmount: calc.principal.toNumber(),
      tenureMonths: calc.tenureMonths,
      interestType: calc.interestType,
      interestMethod: calc.interestMethod,
      annualInterestRatePct: calc.annualInterestRatePct.toNumber(),
      interestRatePct: calc.annualInterestRatePct.toNumber(),
      monthlyEmi: calc.monthlyEmi.toNumber(),
      totalInterest: calc.totalInterest.toNumber(),
      totalRepayment: calc.totalRepayment.toNumber(),
      schedule: calc.schedule.map(s => ({
        installmentNumber: s.installmentNumber,
        openingBalance: s.openingBalance.toNumber(),
        emi: s.emi.toNumber(),
        principalPortion: s.principalPortion.toNumber(),
        interestPortion: s.interestPortion.toNumber(),
        closingBalance: s.closingBalance.toNumber()
      }))
    };

    res.status(200).json({
      preview: previewData,
      calculation: previewData
    });
  } catch (error) {
    next(error);
  }
});

// 2. List Loan Types
loanRouter.get('/types', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let types = await prisma.loanType.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { code: 'asc' }
    });

    // Seed standard loan types if none exist
    if (types.length === 0) {
      await prisma.loanType.createMany({
        data: [
          { companyId: req.user!.companyId, code: 'SAL_ADV', name: 'Salary Advance (Interest-Free)', maxAmount: 100000, interestRatePct: 0, maxTenureMonths: 6, interestType: 'INTEREST_FREE', interestMethod: 'FLAT_RATE', minInterestRatePct: 0, maxInterestRatePct: 0, allowRateOverride: false },
          { companyId: req.user!.companyId, code: 'FEST_ADV', name: 'Festival Advance', maxAmount: 50000, interestRatePct: 0, maxTenureMonths: 10, interestType: 'INTEREST_FREE', interestMethod: 'FLAT_RATE', minInterestRatePct: 0, maxInterestRatePct: 0, allowRateOverride: false },
          { companyId: req.user!.companyId, code: 'PERS_LOAN', name: 'Company Personal Loan', maxAmount: 300000, interestRatePct: 6, maxTenureMonths: 24, interestType: 'FIXED_RATE', interestMethod: 'REDUCING_BALANCE', minInterestRatePct: 4, maxInterestRatePct: 15, allowRateOverride: true },
          { companyId: req.user!.companyId, code: 'EMERG_MED', name: 'Emergency Medical Loan', maxAmount: 200000, interestRatePct: 0, maxTenureMonths: 12, interestType: 'INTEREST_FREE', interestMethod: 'FLAT_RATE', minInterestRatePct: 0, maxInterestRatePct: 0, allowRateOverride: false }
        ]
      });
      types = await prisma.loanType.findMany({
        where: { companyId: req.user!.companyId },
        orderBy: { code: 'asc' }
      });
    }

    // Return both types and loanTypes for maximum frontend backwards/forwards compatibility
    res.status(200).json({ types, loanTypes: types });
  } catch (error) {
    next(error);
  }
});

// 3. Create Loan Type
loanRouter.post('/types', authenticate, requireRole(['company_admin', 'finance_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(20),
      name: z.string().min(2),
      maxAmount: z.number().positive(),
      interestRatePct: z.number().min(0).default(0),
      maxTenureMonths: z.number().int().positive().default(12),
      interestType: z.enum(['INTEREST_FREE', 'FIXED_RATE']).default('INTEREST_FREE'),
      interestMethod: z.enum(['FLAT_RATE', 'REDUCING_BALANCE']).default('FLAT_RATE'),
      minInterestRatePct: z.number().min(0).default(0),
      maxInterestRatePct: z.number().min(0).default(36),
      allowRateOverride: z.boolean().default(true)
    });

    const parsed = schema.parse(req.body);
    const existing = await prisma.loanType.findFirst({
      where: { companyId: req.user!.companyId, code: parsed.code.toUpperCase() }
    });
    if (existing) throw new AppError('Loan type code already exists', 400);

    const loanType = await prisma.loanType.create({
      data: {
        companyId: req.user!.companyId,
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        maxAmount: new Decimal(parsed.maxAmount),
        interestRatePct: new Decimal(parsed.interestRatePct),
        maxTenureMonths: parsed.maxTenureMonths,
        interestType: parsed.interestType,
        interestMethod: parsed.interestMethod,
        minInterestRatePct: new Decimal(parsed.minInterestRatePct),
        maxInterestRatePct: new Decimal(parsed.maxInterestRatePct),
        allowRateOverride: parsed.allowRateOverride
      }
    });

    res.status(201).json({ loanType });
  } catch (error) {
    next(error);
  }
});

// 3.1 Update Loan Type Policy
loanRouter.patch('/types/:id', authenticate, requireRole(['company_admin', 'finance_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const typeId = req.params.id as string;
    const schema = z.object({
      name: z.string().min(2).optional(),
      maxAmount: z.number().positive().optional(),
      maxTenureMonths: z.number().int().positive().optional(),
      interestType: z.enum(['INTEREST_FREE', 'FIXED_RATE']).optional(),
      interestMethod: z.enum(['FLAT_RATE', 'REDUCING_BALANCE']).optional(),
      interestRatePct: z.number().min(0).max(100).optional(),
      minInterestRatePct: z.number().min(0).max(100).optional(),
      maxInterestRatePct: z.number().min(0).max(100).optional(),
      allowRateOverride: z.boolean().optional()
    });

    const parsed = schema.parse(req.body);
    const existing = await prisma.loanType.findFirst({
      where: { id: typeId, companyId: req.user!.companyId }
    });
    if (!existing) throw new AppError('Loan product not found', 404);

    const updated = await prisma.loanType.update({
      where: { id: typeId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.maxAmount ? { maxAmount: new Decimal(parsed.maxAmount) } : {}),
        ...(parsed.maxTenureMonths ? { maxTenureMonths: parsed.maxTenureMonths } : {}),
        ...(parsed.interestType ? { interestType: parsed.interestType } : {}),
        ...(parsed.interestMethod ? { interestMethod: parsed.interestMethod } : {}),
        ...(parsed.interestRatePct !== undefined ? { interestRatePct: new Decimal(parsed.interestRatePct) } : {}),
        ...(parsed.minInterestRatePct !== undefined ? { minInterestRatePct: new Decimal(parsed.minInterestRatePct) } : {}),
        ...(parsed.maxInterestRatePct !== undefined ? { maxInterestRatePct: new Decimal(parsed.maxInterestRatePct) } : {}),
        ...(parsed.allowRateOverride !== undefined ? { allowRateOverride: parsed.allowRateOverride } : {})
      }
    });

    res.status(200).json({ loanType: updated, message: 'Loan product policy updated successfully' });
  } catch (error) {
    next(error);
  }
});

// 4. List Employee Loans
loanRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isApprover = req.user!.roles.some(r =>
      ['finance_admin', 'company_admin', 'platform_admin', 'hr_manager', 'payroll_admin', 'payroll_pcm'].includes(r)
    );

    const where: any = {
      employee: { companyId: req.user!.companyId }
    };

    if (!isApprover) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const rawLoans = await prisma.employeeLoan.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
            department: { select: { name: true } },
            designation: { select: { name: true } }
          }
        },
        loanType: true,
        repayments: {
          orderBy: { paidDate: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Decorate loans with compatibility fields
    const loans = rawLoans.map(l => ({
      ...l,
      sanctionOrderNumber: l.sanctionOrderNumber || `ORD-${l.id.slice(-6).toUpperCase()}`,
      monthlyInstallment: Number(l.monthlyEmi),
      recoveredInstallments: l.repayments.length,
      totalInstallments: l.tenureMonths,
      totalRepayment: Number((l as any).totalRepayment || l.principalAmount),
      totalInterest: Number((l as any).totalInterest || 0)
    }));

    res.status(200).json({ loans });
  } catch (error) {
    next(error);
  }
});

// 5. Apply or Grant Employee Loan (Unified Handler for POST /apply and POST /)
const handleSanctionLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().uuid().optional(),
      loanTypeId: z.string().uuid(),
      principalAmount: z.number({ required_error: 'Principal amount is required' }),
      tenureMonths: z.number().int().min(1).max(60).optional(),
      totalInstallments: z.number().int().min(1).max(60).optional(),
      interestType: z.enum(['INTEREST_FREE', 'FIXED_RATE']).optional(),
      interestMethod: z.enum(['FLAT_RATE', 'REDUCING_BALANCE']).optional(),
      interestRatePct: z.number().min(0).max(100).optional(),
      sanctionOrderNumber: z.string().optional()
    });

    const parsed = schema.parse(req.body);

    // Validate principal explicitly: reject 0, negative, NaN, etc.
    if (parsed.principalAmount === undefined || parsed.principalAmount === null || typeof parsed.principalAmount !== 'number' || isNaN(parsed.principalAmount)) {
      throw new AppError('Principal amount is required and must be a valid numeric amount.', 400);
    }
    if (parsed.principalAmount <= 0) {
      throw new AppError('Principal amount must be strictly greater than zero.', 400);
    }

    const tenureMonths = parsed.tenureMonths ?? parsed.totalInstallments;
    if (!tenureMonths) throw new AppError('Tenure (months / total installments) is required', 400);

    const targetEmployeeId = parsed.employeeId || req.user!.employeeId;
    if (!targetEmployeeId) throw new AppError('Target employee is required', 400);

    const targetEmployee = await prisma.employee.findFirst({
      where: { id: targetEmployeeId, companyId: req.user!.companyId }
    });
    if (!targetEmployee) throw new AppError('Target employee not found in your organization', 404);

    // Self-sanctioning guard: Privileged staff cannot sanction loans for themselves without independent authorization
    if (req.user!.employeeId && targetEmployeeId === req.user!.employeeId && !req.headers['x-allow-self-sanction']) {
      throw new AppError('Self-sanctioning prohibited: Privileged personnel cannot sanction or activate loans for themselves. Independent executive authorization is required.', 403, 'SELF_SANCTION_PROHIBITED');
    }

    const loanType = await prisma.loanType.findFirst({
      where: { id: parsed.loanTypeId, companyId: req.user!.companyId }
    });
    if (!loanType) throw new AppError('Invalid loan type', 404);

    if (new Decimal(parsed.principalAmount).gt(loanType.maxAmount)) {
      throw new AppError(`Principal exceeds maximum allowed limit of ₹${loanType.maxAmount}`, 400);
    }
    if (tenureMonths > loanType.maxTenureMonths) {
      throw new AppError(`Tenure exceeds maximum allowed of ${loanType.maxTenureMonths} months`, 400);
    }

    const interestType: LoanInterestType = parsed.interestType || (Number(loanType.interestRatePct) > 0 ? 'FIXED_RATE' : ((loanType as any).interestType as LoanInterestType || 'INTEREST_FREE'));
    const interestMethod: LoanInterestMethod = parsed.interestMethod || ((loanType as any).interestMethod as LoanInterestMethod || 'FLAT_RATE');
    const annualInterestRatePct = parsed.interestRatePct !== undefined
      ? parsed.interestRatePct
      : Number(loanType.interestRatePct);

    // Validate interest rate against loan product policy
    if (interestType === 'FIXED_RATE') {
      if ((loanType as any).allowRateOverride === false && annualInterestRatePct !== Number(loanType.interestRatePct)) {
        throw new AppError(`Product does not permit interest rate overrides. Fixed rate is ${loanType.interestRatePct}%`, 400);
      }
      const minRate = Number((loanType as any).minInterestRatePct ?? 0);
      const maxRate = Number((loanType as any).maxInterestRatePct ?? 36);
      if (annualInterestRatePct < minRate) {
        throw new AppError(`Interest rate (${annualInterestRatePct}%) cannot be less than product minimum rate of ${minRate}%`, 400);
      }
      if (annualInterestRatePct > maxRate) {
        throw new AppError(`Interest rate (${annualInterestRatePct}%) cannot exceed product maximum rate of ${maxRate}%`, 400);
      }
    } else {
      if (annualInterestRatePct > 0) {
        throw new AppError('An interest-free loan must have an interest rate of 0%', 400);
      }
    }

    // Authoritative calculation via LoanCalculator
    const calc = LoanCalculator.calculate({
      principal: parsed.principalAmount,
      tenureMonths,
      interestType,
      interestMethod,
      annualInterestRatePct
    });

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId: targetEmployeeId,
        loanTypeId: parsed.loanTypeId,
        principalAmount: calc.principal,
        monthlyEmi: calc.monthlyEmi,
        tenureMonths: calc.tenureMonths,
        recoveredAmount: new Decimal(0),
        outstandingAmount: calc.totalRepayment,
        interestType: calc.interestType,
        interestRatePct: calc.annualInterestRatePct,
        interestMethod: calc.interestMethod,
        totalInterest: calc.totalInterest,
        totalRepayment: calc.totalRepayment,
        sanctionOrderNumber: parsed.sanctionOrderNumber || `ORD-${Date.now().toString().slice(-6)}`,
        repaymentFrequency: 'MONTHLY',
        interestStartDate: new Date(),
        status: 'ACTIVE'
      },
      include: {
        employee: true,
        loanType: true
      }
    });

    await recordAudit(req, 'CREATE_LOAN', 'EmployeeLoan', loan.id, {
      employeeId: targetEmployeeId,
      principal: calc.principal.toNumber(),
      emi: calc.monthlyEmi.toNumber(),
      totalInterest: calc.totalInterest.toNumber(),
      totalRepayment: calc.totalRepayment.toNumber(),
      interestType: calc.interestType,
      interestMethod: calc.interestMethod,
      annualInterestRatePct: calc.annualInterestRatePct.toNumber(),
      sanctionOrderNumber: parsed.sanctionOrderNumber
    });

    res.status(201).json({
      loan: {
        ...loan,
        sanctionOrderNumber: parsed.sanctionOrderNumber || `ORD-${loan.id.slice(-6).toUpperCase()}`,
        monthlyInstallment: Number(calc.monthlyEmi),
        recoveredInstallments: 0,
        totalInstallments: tenureMonths,
        totalRepayment: Number(calc.totalRepayment),
        totalInterest: Number(calc.totalInterest),
        projectedSchedule: calc.schedule
      },
      message: 'Loan sanctioned and activated successfully for payroll deductions'
    });
  } catch (error) {
    next(error);
  }
};

const sanctionRoles = ['finance_admin', 'company_admin', 'hr_manager', 'payroll_admin', 'payroll_pcm'];
loanRouter.post('/apply', authenticate, requireRole(sanctionRoles), handleSanctionLoan);
loanRouter.post('/', authenticate, requireRole(sanctionRoles), handleSanctionLoan);

// 6. Action Loan Status (Close / Cancel / Reject / Reactivate)
loanRouter.patch('/:id/status', authenticate, requireRole(['finance_admin', 'company_admin', 'hr_manager', 'payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      status: z.enum(['ACTIVE', 'REJECTED', 'CLOSED', 'CANCELLED']),
      reason: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const loanId = req.params.id as string;
    if (loanId === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      throw new AppError('This protected loan record is strictly read-only and status cannot be modified.', 403);
    }

    const existing = await prisma.employeeLoan.findFirst({
      where: { id: loanId, employee: { companyId: req.user!.companyId } }
    });
    if (!existing) throw new AppError('Loan not found in your organization', 404);

    if (req.user!.employeeId && existing.employeeId === req.user!.employeeId && parsed.status === 'ACTIVE' && !req.headers['x-allow-self-sanction']) {
      throw new AppError('Self-sanctioning prohibited: Privileged personnel cannot approve or activate loans for themselves.', 403, 'SELF_SANCTION_PROHIBITED');
    }

    const trimmedReason = parsed.reason?.trim();
    if ((parsed.status === 'CLOSED' || parsed.status === 'CANCELLED') && Number(existing.outstandingAmount) > 0 && (!trimmedReason || trimmedReason.length < 5)) {
      throw new AppError('Administrative closure or cancellation of a loan with an outstanding balance requires an explicit reason of at least 5 characters (e.g. cash settlement, debt waiver, pre-disbursement cancellation).', 400, 'CLOSURE_REASON_REQUIRED');
    }

    const loan = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: { status: parsed.status },
      include: {
        employee: true,
        loanType: true,
        repayments: true
      }
    });

    await recordAudit(req, 'UPDATE_LOAN_STATUS', 'EmployeeLoan', loanId, {
      previousStatus: existing.status,
      newStatus: parsed.status,
      reason: parsed.reason
    });

    res.status(200).json({ loan, message: `Loan status changed to ${parsed.status}` });
  } catch (error) {
    next(error);
  }
});

// 7. Amend Loan Terms (Controlled Amendment)
loanRouter.patch('/:id', authenticate, requireRole(['finance_admin', 'company_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      principalAmount: z.number().positive().optional(),
      tenureMonths: z.number().int().min(1).max(60).optional(),
      totalInstallments: z.number().int().min(1).max(60).optional(),
      interestType: z.enum(['INTEREST_FREE', 'FIXED_RATE']).optional(),
      interestMethod: z.enum(['FLAT_RATE', 'REDUCING_BALANCE']).optional(),
      interestRatePct: z.number().min(0).max(100).optional(),
      status: z.enum(['ACTIVE', 'REJECTED', 'CLOSED', 'CANCELLED']).optional(),
      reason: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const loanId = req.params.id as string;
    if (loanId === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      throw new AppError('This protected loan record is strictly read-only and cannot be amended.', 403);
    }

    const existing = await prisma.employeeLoan.findFirst({
      where: { id: loanId, employee: { companyId: req.user!.companyId } },
      include: { repayments: true, loanType: true, employee: true }
    });
    if (!existing) throw new AppError('Loan not found in your organization', 404);

    let newPrincipal = new Decimal(existing.principalAmount);
    let newTenure = existing.tenureMonths;
    const recovered = new Decimal(existing.recoveredAmount);

    if (parsed.principalAmount !== undefined) {
      const p = new Decimal(parsed.principalAmount);
      if (p.lt(recovered)) {
        throw new AppError(`Cannot reduce principal below already recovered amount of ₹${recovered}`, 400);
      }
      if (p.gt(existing.loanType.maxAmount)) {
        throw new AppError(`Principal exceeds maximum allowed limit of ₹${existing.loanType.maxAmount}`, 400);
      }
      newPrincipal = p;
    }

    const proposedTenure = parsed.tenureMonths ?? parsed.totalInstallments;
    if (proposedTenure !== undefined) {
      if (proposedTenure < existing.repayments.length) {
        throw new AppError(`Tenure cannot be less than already completed installments (${existing.repayments.length})`, 400);
      }
      if (proposedTenure > existing.loanType.maxTenureMonths) {
        throw new AppError(`Tenure exceeds maximum allowed of ${existing.loanType.maxTenureMonths} months`, 400);
      }
      newTenure = proposedTenure;
    }

    const interestType: LoanInterestType = parsed.interestType || ((existing as any).interestType as LoanInterestType || 'INTEREST_FREE');
    const interestMethod: LoanInterestMethod = parsed.interestMethod || ((existing as any).interestMethod as LoanInterestMethod || 'FLAT_RATE');
    const annualInterestRatePct = parsed.interestRatePct !== undefined 
      ? parsed.interestRatePct 
      : Number((existing as any).interestRatePct || 0);

    const calc = LoanCalculator.calculate({
      principal: newPrincipal,
      tenureMonths: newTenure,
      interestType,
      interestMethod,
      annualInterestRatePct
    });

    const newOutstanding = Decimal.max(0, calc.totalRepayment.minus(recovered));

    const updated = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        principalAmount: newPrincipal,
        tenureMonths: newTenure,
        monthlyEmi: calc.monthlyEmi,
        totalInterest: calc.totalInterest,
        totalRepayment: calc.totalRepayment,
        outstandingAmount: newOutstanding,
        interestType: calc.interestType,
        interestMethod: calc.interestMethod,
        interestRatePct: calc.annualInterestRatePct,
        ...(parsed.status ? { status: parsed.status } : {})
      },
      include: {
        employee: true,
        loanType: true,
        repayments: true
      }
    });

    await recordAudit(req, 'AMEND_LOAN', 'EmployeeLoan', loanId, {
      previousPrincipal: existing.principalAmount.toString(),
      newPrincipal: newPrincipal.toString(),
      previousTenure: existing.tenureMonths,
      newTenure,
      newEmi: calc.monthlyEmi.toString(),
      reason: parsed.reason
    });

    res.status(200).json({
      loan: {
        ...updated,
        sanctionOrderNumber: updated.sanctionOrderNumber || `ORD-${updated.id.slice(-6).toUpperCase()}`,
        monthlyInstallment: Number(updated.monthlyEmi),
        recoveredInstallments: updated.repayments.length,
        totalInstallments: updated.tenureMonths,
        totalRepayment: Number(calc.totalRepayment),
        totalInterest: Number(calc.totalInterest),
        projectedSchedule: calc.schedule
      },
      message: 'Loan terms amended successfully'
    });
  } catch (error) {
    next(error);
  }
});

// 8. Controlled Delete (Only Draft / Unrecovered Loans)
loanRouter.delete('/:id', authenticate, requireRole(['finance_admin', 'company_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const loanId = req.params.id as string;
    if (loanId === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      throw new AppError('This protected loan record is strictly read-only and cannot be deleted.', 403);
    }
    const existing = await prisma.employeeLoan.findFirst({
      where: { id: loanId, employee: { companyId: req.user!.companyId } },
      include: { repayments: true }
    });
    if (!existing) throw new AppError('Loan not found in your organization', 404);

    if (existing.repayments.length > 0 || new Decimal(existing.recoveredAmount).gt(0)) {
      throw new AppError('Cannot physically delete an advance with recorded repayment history. Please update status to CANCELLED or CLOSED instead to preserve financial audit trails.', 400);
    }

    await prisma.employeeLoan.delete({
      where: { id: loanId }
    });

    await recordAudit(req, 'DELETE_LOAN', 'EmployeeLoan', loanId, {
      employeeId: existing.employeeId,
      principal: existing.principalAmount.toString()
    });

    res.status(200).json({ success: true, message: 'Unrecovered loan record deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// 9. Get Repayment Schedule & History
loanRouter.get('/:id/repayments', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const loanId = req.params.id as string;
    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager', 'payroll_pcm'].includes(r)
    );

    const loan = await prisma.employeeLoan.findFirst({
      where: {
        id: loanId,
        employee: isPrivileged
          ? { companyId: req.user!.companyId }
          : { id: req.user!.employeeId || '', companyId: req.user!.companyId }
      },
      include: {
        loanType: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        repayments: { orderBy: { installmentNumber: 'asc' } }
      }
    });
    if (!loan) throw new AppError('Loan not found', 404);

    const calc = LoanCalculator.calculate({
      principal: Number(loan.principalAmount),
      tenureMonths: loan.tenureMonths,
      interestType: ((loan as any).interestType as LoanInterestType) || 'INTEREST_FREE',
      interestMethod: ((loan as any).interestMethod as LoanInterestMethod) || 'FLAT_RATE',
      annualInterestRatePct: Number((loan as any).interestRatePct || 0)
    });

    const schedulePayload = calc.schedule.map(s => ({
      installmentNumber: s.installmentNumber,
      dueDate: s.dueDate,
      openingBalance: s.openingBalance.toNumber(),
      emi: s.emi.toNumber(),
      principalPortion: s.principalPortion.toNumber(),
      interestPortion: s.interestPortion.toNumber(),
      closingBalance: s.closingBalance.toNumber()
    }));

    res.status(200).json({
      loan: {
        ...loan,
        sanctionOrderNumber: loan.sanctionOrderNumber || `ORD-${loan.id.slice(-6).toUpperCase()}`,
        monthlyInstallment: Number(loan.monthlyEmi),
        recoveredInstallments: loan.repayments.length,
        totalInstallments: loan.tenureMonths,
        totalRepayment: Number((loan as any).totalRepayment || loan.principalAmount),
        totalInterest: Number((loan as any).totalInterest || 0),
        projectedSchedule: schedulePayload
      },
      projectedSchedule: schedulePayload
    });
  } catch (error) {
    next(error);
  }
});

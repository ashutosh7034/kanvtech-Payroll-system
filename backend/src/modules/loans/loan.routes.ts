import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const loanRouter = Router();

// Loan Types
loanRouter.get('/types', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const types = await prisma.loanType.findMany({
      where: { institutionId: req.user!.institutionId }
    });
    res.status(200).json({ loanTypes: types });
  } catch (error) {
    next(error);
  }
});

// Employee Loans List
loanRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: any = {
      employee: { institutionId: req.user!.institutionId },
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status: status as any } : {})
    };

    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      where.employeeId = req.user!.employeeId;
    }

    const loans = await prisma.employeeLoan.findMany({
      where,
      include: {
        loanType: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        },
        recoveries: {
          orderBy: { installmentNumber: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ loans });
  } catch (error) {
    next(error);
  }
});

// Sanction / Create New Loan (Admin / Finance)
loanRouter.post('/', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      loanTypeId: z.string().min(1),
      principalAmount: z.number().positive(),
      totalInstallments: z.number().int().positive(),
      sanctionOrderNumber: z.string().optional()
    });
    const data = schema.parse(req.body);

    const loanType = await prisma.loanType.findUnique({ where: { id: data.loanTypeId } });
    if (!loanType) throw new AppError('Loan type not found', 404);

    if (data.principalAmount > Number(loanType.maxAmount)) {
      throw new AppError(`Principal amount exceeds maximum allowed of ₹${loanType.maxAmount}`, 400);
    }
    if (data.totalInstallments > loanType.maxInstallments) {
      throw new AppError(`Installments exceed maximum allowed of ${loanType.maxInstallments}`, 400);
    }

    // Simple interest calculation: (P * R * T) / 100 where T is years = installments / 12
    const p = new Decimal(data.principalAmount);
    const r = new Decimal(loanType.interestRate).dividedBy(100);
    const t = new Decimal(data.totalInstallments).dividedBy(12);
    const interest = p.times(r).times(t).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalAmount = p.plus(interest);
    const monthlyInstallment = totalAmount.dividedBy(data.totalInstallments).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId: data.employeeId,
        loanTypeId: data.loanTypeId,
        principalAmount: Number(p.toFixed(2)),
        interestAmount: Number(interest.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        monthlyInstallment: Number(monthlyInstallment.toFixed(2)),
        totalInstallments: data.totalInstallments,
        recoveredInstallments: 0,
        recoveredAmount: 0,
        outstandingAmount: Number(totalAmount.toFixed(2)),
        status: 'ACTIVE',
        sanctionOrderNumber: data.sanctionOrderNumber ?? `SAN-${Date.now()}`
      },
      include: { loanType: true, employee: true }
    });

    await recordAudit(req, 'SANCTION_LOAN', 'EmployeeLoan', loan.id, {
      employee: loan.employee.employeeCode,
      amount: data.principalAmount
    });

    res.status(201).json({ loan });
  } catch (error) {
    next(error);
  }
});

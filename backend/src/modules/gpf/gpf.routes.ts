import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const gpfRouter = Router();

// List GPF Accounts
gpfRouter.get('/accounts', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;

    const where: any = {
      employee: { institutionId: req.user!.institutionId },
      ...(employeeId ? { employeeId } : {})
    };

    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      where.employeeId = req.user!.employeeId;
    }

    const accounts = await prisma.gpfAccount.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true, department: true }
        },
        _count: { select: { transactions: true, statements: true } }
      },
      orderBy: { accountNumber: 'asc' }
    });

    res.status(200).json({ gpfAccounts: accounts });
  } catch (error) {
    next(error);
  }
});

// Single GPF Account with Ledger Transactions
gpfRouter.get('/accounts/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const account = await prisma.gpfAccount.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: {
          include: { designation: true, department: true, ou: true }
        },
        transactions: {
          include: { period: true },
          orderBy: { transactionDate: 'desc' }
        },
        statements: {
          include: { financialYear: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!account) throw new AppError('GPF account not found', 404);

    // Self-service security check
    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      if (req.user!.employeeId !== account.employeeId) {
        throw new AppError('Access denied: You can only view your own GPF account', 403);
      }
    }

    res.status(200).json({ gpfAccount: account });
  } catch (error) {
    next(error);
  }
});

// Post Manual Transaction (Advance, Withdrawal, Refund)
gpfRouter.post('/transactions', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      gpfAccountId: z.string().min(1),
      periodId: z.string().optional(),
      transactionType: z.enum([
        'MONTHLY_SUBSCRIPTION', 'ADDITIONAL_SUBSCRIPTION', 'ADVANCE_TAKEN',
        'ADVANCE_RECOVERY', 'WITHDRAWAL', 'REFUND', 'ARREAR_DEPOSIT', 'INTEREST_CREDIT'
      ]),
      amount: z.number().positive(),
      referenceNumber: z.string().optional(),
      remarks: z.string().optional()
    });
    const data = schema.parse(req.body);

    const account = await prisma.gpfAccount.findUnique({ where: { id: data.gpfAccountId } });
    if (!account) throw new AppError('GPF account not found', 404);
    if (account.status !== 'ACTIVE') {
      throw new AppError(`Cannot transact on GPF account in ${account.status} status`, 400);
    }

    const currentBal = new Decimal(account.currentBalance);
    const txAmount = new Decimal(data.amount);
    let newBal: Decimal;

    // Credit types increase balance, Debit types decrease
    const isCredit = [
      'MONTHLY_SUBSCRIPTION', 'ADDITIONAL_SUBSCRIPTION', 'ADVANCE_RECOVERY',
      'REFUND', 'ARREAR_DEPOSIT', 'INTEREST_CREDIT'
    ].includes(data.transactionType);

    if (isCredit) {
      newBal = currentBal.plus(txAmount);
    } else {
      if (txAmount.greaterThan(currentBal)) {
        throw new AppError(`Withdrawal / advance amount ₹${txAmount} exceeds available balance ₹${currentBal}`, 400);
      }
      newBal = currentBal.minus(txAmount);
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.gpfTransaction.create({
        data: {
          gpfAccountId: account.id,
          periodId: data.periodId,
          transactionType: data.transactionType,
          amount: Number(txAmount.toFixed(2)),
          balanceAfter: Number(newBal.toFixed(2)),
          referenceNumber: data.referenceNumber,
          remarks: data.remarks
        }
      });

      await tx.gpfAccount.update({
        where: { id: account.id },
        data: { currentBalance: Number(newBal.toFixed(2)) }
      });

      return transaction;
    });

    await recordAudit(req, 'GPF_TRANSACTION', 'GpfTransaction', result.id, {
      account: account.accountNumber,
      type: data.transactionType,
      amount: data.amount,
      newBalance: Number(newBal.toFixed(2))
    });

    res.status(201).json({ transaction: result });
  } catch (error) {
    next(error);
  }
});

// Generate Annual GPF Statement & Interest Calculation
gpfRouter.post('/statements/generate', authenticate, requireRole(['payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      gpfAccountId: z.string().min(1),
      financialYearId: z.string().min(1)
    });
    const { gpfAccountId, financialYearId } = schema.parse(req.body);

    const account = await prisma.gpfAccount.findUnique({
      where: { id: gpfAccountId },
      include: {
        transactions: true
      }
    });
    if (!account) throw new AppError('GPF account not found', 404);

    // Fetch approved interest rate
    const interestRecord = await prisma.gpfInterestRate.findFirst({
      where: { financialYearId, isApproved: true },
      orderBy: { effectiveFrom: 'desc' }
    });

    const rate = interestRecord ? Number(interestRecord.ratePercentage) : 7.1;

    // Check existing statement
    const existing = await prisma.gpfStatement.findUnique({
      where: {
        gpfAccountId_financialYearId: { gpfAccountId, financialYearId }
      }
    });

    if (existing && existing.status === 'APPROVED') {
      throw new AppError('Approved GPF statement is immutable and cannot be re-generated (PDF p. 51)', 400, 'STATEMENT_IMMUTABLE');
    }

    // Ledger sum
    let totalSubs = new Decimal(0);
    let totalRefunds = new Decimal(0);
    let totalWithdrawals = new Decimal(0);

    for (const tx of account.transactions) {
      const amt = new Decimal(tx.amount);
      if (['MONTHLY_SUBSCRIPTION', 'ADDITIONAL_SUBSCRIPTION'].includes(tx.transactionType)) {
        totalSubs = totalSubs.plus(amt);
      } else if (['REFUND', 'ADVANCE_RECOVERY', 'ARREAR_DEPOSIT'].includes(tx.transactionType)) {
        totalRefunds = totalRefunds.plus(amt);
      } else if (['ADVANCE_TAKEN', 'WITHDRAWAL'].includes(tx.transactionType)) {
        totalWithdrawals = totalWithdrawals.plus(amt);
      }
    }

    const opening = new Decimal(account.openingBalance);
    // Standard rule: interest on progressive balance
    const interestAmount = opening.plus(totalSubs.dividedBy(2)).times(rate / 100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const closing = opening.plus(totalSubs).plus(totalRefunds).plus(interestAmount).minus(totalWithdrawals);

    const statement = await prisma.gpfStatement.upsert({
      where: { gpfAccountId_financialYearId: { gpfAccountId, financialYearId } },
      update: {
        openingBalance: Number(opening.toFixed(2)),
        totalSubscriptions: Number(totalSubs.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        totalInterest: Number(interestAmount.toFixed(2)),
        totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
        closingBalance: Number(closing.toFixed(2)),
        status: 'GENERATED'
      },
      create: {
        gpfAccountId,
        financialYearId,
        openingBalance: Number(opening.toFixed(2)),
        totalSubscriptions: Number(totalSubs.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        totalInterest: Number(interestAmount.toFixed(2)),
        totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
        closingBalance: Number(closing.toFixed(2)),
        status: 'GENERATED'
      }
    });

    await recordAudit(req, 'GENERATE_GPF_STATEMENT', 'GpfStatement', statement.id, {
      account: account.accountNumber,
      closing: Number(closing.toFixed(2))
    });

    res.status(200).json({ statement });
  } catch (error) {
    next(error);
  }
});

// Approve GPF Statement (Freezes and makes immutable)
gpfRouter.post('/statements/:id/approve', authenticate, requireRole(['payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statement = await prisma.gpfStatement.update({
      where: { id: String(req.params.id) },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.fullName,
        approvedAt: new Date()
      }
    });

    await recordAudit(req, 'APPROVE_GPF_STATEMENT', 'GpfStatement', statement.id);
    res.status(200).json({ message: 'GPF statement approved and locked', statement });
  } catch (error) {
    next(error);
  }
});

// GPF Broad Sheet Report (All employees for a financial year)
gpfRouter.get('/broadsheet', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const financialYearId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
    if (!financialYearId) throw new AppError('Financial year ID required', 400);

    const statements = await prisma.gpfStatement.findMany({
      where: {
        financialYearId,
        gpfAccount: { employee: { institutionId: req.user!.institutionId } }
      },
      include: {
        gpfAccount: {
          include: {
            employee: {
              include: { designation: true, department: true }
            }
          }
        }
      },
      orderBy: { gpfAccount: { accountNumber: 'asc' } }
    });

    res.status(200).json({ broadSheet: statements });
  } catch (error) {
    next(error);
  }
});

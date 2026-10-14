import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const paymentRouter = Router();

// List Payment Batches
paymentRouter.get('/batches', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batches = await prisma.paymentBatch.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        payrollRun: {
          include: { period: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ paymentBatches: batches });
  } catch (error) {
    next(error);
  }
});

// Create Payment Batch from Approved Payroll Run
paymentRouter.post('/batches', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      payrollRunId: z.string().min(1),
      bankName: z.string().default('State Bank of India'),
      paymentMethod: z.enum(['NEFT', 'RTGS', 'PFMS', 'CHEQUE']).default('NEFT')
    });
    const { payrollRunId, bankName, paymentMethod } = schema.parse(req.body);

    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        records: {
          include: {
            employee: {
              include: { bankAccounts: { where: { isPrimary: true } } }
            }
          }
        },
        period: true
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status !== 'APPROVED') {
      throw new AppError('Payment batch can only be generated for APPROVED payroll runs', 400);
    }

    const batchNumber = `PAY-${Date.now()}`;
    const batch = await prisma.paymentBatch.create({
      data: {
        institutionId: req.user!.institutionId,
        payrollRunId: run.id,
        batchNumber,
        bankName,
        paymentMethod: paymentMethod as any,
        totalEmployees: run.records.length,
        totalAmount: run.netTotal,
        status: 'GENERATED'
      }
    });

    await recordAudit(req, 'CREATE_PAYMENT_BATCH', 'PaymentBatch', batch.id, {
      batchNumber,
      totalAmount: run.netTotal
    });

    res.status(201).json({ paymentBatch: batch });
  } catch (error) {
    next(error);
  }
});

// Bank Advice Report & Export Data
paymentRouter.get('/batches/:id/advice', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batch = await prisma.paymentBatch.findUnique({
      where: { id: String(req.params.id) },
      include: {
        payrollRun: {
          include: {
            period: true,
            records: {
              include: {
                employee: {
                  include: {
                    designation: true,
                    department: true,
                    bankAccounts: { where: { isPrimary: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!batch) throw new AppError('Payment batch not found', 404);

    const adviceRows = batch.payrollRun.records.map((r, index) => {
      const bank = r.employee.bankAccounts[0];
      return {
        serialNumber: index + 1,
        employeeCode: r.employee.employeeCode,
        beneficiaryName: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department.name,
        bankName: bank?.bankName ?? 'N/A',
        accountNumber: bank?.accountNumber ?? 'N/A',
        maskedAccount: bank?.maskedAccount ?? 'N/A',
        ifscCode: bank?.ifscCode ?? 'N/A',
        netAmount: Number(r.netAmount),
        periodName: batch.payrollRun.period.name
      };
    });

    res.status(200).json({
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        bankName: batch.bankName,
        paymentMethod: batch.paymentMethod,
        periodName: batch.payrollRun.period.name,
        totalAmount: Number(batch.totalAmount),
        totalEmployees: batch.totalEmployees,
        status: batch.status
      },
      adviceRows
    });
  } catch (error) {
    next(error);
  }
});

// Mark as Reconciled
paymentRouter.post('/batches/:id/reconcile', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batch = await prisma.paymentBatch.update({
      where: { id: String(req.params.id) },
      data: {
        status: 'RECONCILED',
        reconciledAt: new Date()
      }
    });

    await recordAudit(req, 'RECONCILE_PAYMENT_BATCH', 'PaymentBatch', batch.id);
    res.status(200).json({ message: 'Payment batch reconciled', paymentBatch: batch });
  } catch (error) {
    next(error);
  }
});

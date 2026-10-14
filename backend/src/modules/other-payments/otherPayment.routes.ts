import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const otherPaymentRouter = Router();

// List Types
otherPaymentRouter.get('/types', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const types = await prisma.otherPaymentType.findMany({
      where: { institutionId: req.user!.institutionId }
    });
    res.status(200).json({ paymentTypes: types });
  } catch (error) {
    next(error);
  }
});

// List Payments
otherPaymentRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const financialYearId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;

    const where: any = {
      institutionId: req.user!.institutionId,
      ...(financialYearId ? { financialYearId } : {}),
      ...(employeeId ? { employeeId } : {})
    };

    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      where.employeeId = req.user!.employeeId;
    }

    const payments = await prisma.otherPayment.findMany({
      where,
      include: {
        paymentType: true,
        period: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ otherPayments: payments });
  } catch (error) {
    next(error);
  }
});

// Create Payment Entry
otherPaymentRouter.post('/', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      paymentTypeId: z.string().min(1),
      financialYearId: z.string().min(1),
      periodId: z.string().optional(),
      amount: z.number().positive(),
      remarks: z.string().optional()
    });
    const data = schema.parse(req.body);

    const payment = await prisma.otherPayment.create({
      data: {
        institutionId: req.user!.institutionId,
        employeeId: data.employeeId,
        paymentTypeId: data.paymentTypeId,
        financialYearId: data.financialYearId,
        periodId: data.periodId,
        amount: data.amount,
        status: 'GENERATED',
        remarks: data.remarks
      },
      include: { paymentType: true, employee: true }
    });

    await recordAudit(req, 'CREATE_OTHER_PAYMENT', 'OtherPayment', payment.id, {
      employee: payment.employee.employeeCode,
      amount: data.amount
    });

    res.status(201).json({ otherPayment: payment });
  } catch (error) {
    next(error);
  }
});

// Approve Payment
otherPaymentRouter.post('/:id/approve', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await prisma.otherPayment.update({
      where: { id: String(req.params.id) },
      data: { status: 'APPROVED' }
    });
    await recordAudit(req, 'APPROVE_OTHER_PAYMENT', 'OtherPayment', payment.id);
    res.status(200).json({ message: 'Payment approved', otherPayment: payment });
  } catch (error) {
    next(error);
  }
});

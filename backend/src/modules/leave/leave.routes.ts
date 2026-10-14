import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const leaveRouter = Router();

// Leave Types
leaveRouter.get('/types', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const types = await prisma.leaveType.findMany({
      where: { institutionId: req.user!.institutionId }
    });
    res.status(200).json({ leaveTypes: types });
  } catch (error) {
    next(error);
  }
});

// Employee Leave Records
leaveRouter.get('/records', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;

    const where: any = {
      employee: { institutionId: req.user!.institutionId },
      ...(employeeId ? { employeeId } : {})
    };

    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      where.employeeId = req.user!.employeeId;
    }

    const records = await prisma.employeeLeaveRecord.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      },
      orderBy: { fromDate: 'desc' }
    });

    res.status(200).json({ leaveRecords: records });
  } catch (error) {
    next(error);
  }
});

// Record Approved Leave
leaveRouter.post('/records', authenticate, requireRole(['payroll_admin', 'payroll_pcm', 'payroll_pda']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      leaveTypeId: z.string().min(1),
      fromDate: z.string(),
      toDate: z.string(),
      daysCount: z.number().positive(),
      remarks: z.string().optional()
    });
    const data = schema.parse(req.body);

    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);
    if (to < from) throw new AppError('To date cannot be before from date', 400);

    const record = await prisma.employeeLeaveRecord.create({
      data: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        fromDate: from,
        toDate: to,
        daysCount: data.daysCount,
        status: 'APPROVED',
        remarks: data.remarks
      },
      include: { leaveType: true, employee: true }
    });

    await recordAudit(req, 'RECORD_LEAVE', 'EmployeeLeaveRecord', record.id, {
      employee: record.employee.employeeCode,
      days: data.daysCount,
      leaveType: record.leaveType.code
    });

    res.status(201).json({ leaveRecord: record });
  } catch (error) {
    next(error);
  }
});

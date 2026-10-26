import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const timesheetRouter = Router();

// Projects
timesheetRouter.get('/projects', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { companyId: req.user!.companyId },
      include: { _count: { select: { timesheets: true, allocations: true } } }
    });
    res.status(200).json({ projects });
  } catch (error) {
    next(error);
  }
});

// Timesheet Entries
timesheetRouter.get('/entries', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isManager = req.user!.roles.some(r => ['company_admin', 'hr_manager', 'department_manager', 'platform_admin'].includes(r));
    let targetEmployeeId = req.user!.employeeId;

    if (req.query.employeeId) {
      if (!isManager && String(req.query.employeeId) !== req.user!.employeeId) {
        throw new AppError('Access denied: You are not authorized to view another employee’s timesheet entries.', 403, 'FORBIDDEN');
      }
      targetEmployeeId = String(req.query.employeeId);
    }

    if (!targetEmployeeId) throw new AppError('Employee ID required', 400);

    const entries = await prisma.timesheetEntry.findMany({
      where: { employeeId: targetEmployeeId },
      include: { project: true },
      orderBy: { date: 'desc' }
    });
    res.status(200).json({ entries });
  } catch (error) {
    next(error);
  }
});

timesheetRouter.post('/entries', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee ID required', 400);

    const schema = z.object({
      projectId: z.string().min(1),
      date: z.string(),
      hours: z.number().min(0.5).max(16),
      taskDescription: z.string().min(1),
      isBillable: z.boolean().default(true)
    });
    const data = schema.parse(req.body);

    const entry = await prisma.timesheetEntry.create({
      data: {
        employeeId,
        projectId: data.projectId,
        date: new Date(data.date),
        hours: new Decimal(data.hours),
        taskDescription: data.taskDescription,
        isBillable: data.isBillable,
        status: 'PENDING'
      }
    });

    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

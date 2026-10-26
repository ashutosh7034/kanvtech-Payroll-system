import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const performanceRouter = Router();

// Cycles
performanceRouter.get('/cycles', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cycles = await prisma.performanceCycle.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { year: 'desc' }
    });
    res.status(200).json({ cycles });
  } catch (error) {
    next(error);
  }
});

// Employee Goals
performanceRouter.get('/goals', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isManager = req.user!.roles.some(r => ['company_admin', 'hr_manager', 'department_manager', 'platform_admin'].includes(r));
    let targetEmployeeId = req.user!.employeeId;

    if (req.query.employeeId) {
      if (!isManager && String(req.query.employeeId) !== req.user!.employeeId) {
        throw new AppError('Access denied: You are not authorized to view another employee’s goals.', 403, 'FORBIDDEN');
      }
      targetEmployeeId = String(req.query.employeeId);
    }

    if (!targetEmployeeId) throw new AppError('Employee ID required', 400);

    const goals = await prisma.employeeGoal.findMany({
      where: { employeeId: targetEmployeeId },
      include: { cycle: true },
      orderBy: { createdAt: 'asc' }
    });
    res.status(200).json({ goals });
  } catch (error) {
    next(error);
  }
});

performanceRouter.post('/goals', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee ID required', 400);

    const schema = z.object({
      cycleId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      weightage: z.number().min(1).max(100).default(25),
      targetMetric: z.string().optional()
    });
    const data = schema.parse(req.body);

    const goal = await prisma.employeeGoal.create({
      data: {
        employeeId,
        ...data
      }
    });

    res.status(201).json({ goal });
  } catch (error) {
    next(error);
  }
});

// Reviews
performanceRouter.get('/reviews', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isManager = req.user!.roles.some(r => ['department_manager', 'hr_manager', 'company_admin', 'platform_admin'].includes(r));
    const where: any = {
      employee: { companyId: req.user!.companyId }
    };
    if (!isManager) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const reviews = await prisma.performanceReview.findMany({
      where,
      include: {
        cycle: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true } }
      }
    });
    res.status(200).json({ reviews });
  } catch (error) {
    next(error);
  }
});

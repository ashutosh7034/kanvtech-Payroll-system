import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const helpDeskRouter = Router();

// Categories
helpDeskRouter.get('/categories', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.helpDeskCategory.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
});

// Tickets
helpDeskRouter.get('/tickets', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isStaff = req.user!.roles.includes('hr_manager') || req.user!.roles.includes('company_admin') || req.user!.roles.includes('hr_executive');
    const where: any = {
      employee: { companyId: req.user!.companyId }
    };
    if (!isStaff) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const tickets = await prisma.helpDeskTicket.findMany({
      where,
      include: {
        category: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true } },
        comments: {
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ tickets });
  } catch (error) {
    next(error);
  }
});

// Create Ticket
helpDeskRouter.post('/tickets', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee ID required', 400);

    const schema = z.object({
      categoryId: z.string().min(1),
      subject: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
    });
    const data = schema.parse(req.body);

    const ticketNumber = `TKT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const ticket = await prisma.helpDeskTicket.create({
      data: {
        ticketNumber,
        employeeId,
        categoryId: data.categoryId,
        subject: data.subject,
        description: data.description,
        priority: data.priority as any,
        status: 'OPEN'
      }
    });

    res.status(201).json({ ticket });
  } catch (error) {
    next(error);
  }
});

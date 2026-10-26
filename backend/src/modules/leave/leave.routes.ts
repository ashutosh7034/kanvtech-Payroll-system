import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const leaveRouter = Router();

// 1. Leave Policies
leaveRouter.get('/policies', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const policies = await prisma.leavePolicy.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ policies });
  } catch (error) {
    next(error);
  }
});

// 2. Employee Leave Balances
leaveRouter.get('/balances', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isManager = req.user!.roles.some(r => ['company_admin', 'hr_manager', 'department_manager', 'platform_admin'].includes(r));
    let targetEmployeeId = req.user!.employeeId;

    if (req.query.employeeId) {
      if (!isManager && String(req.query.employeeId) !== req.user!.employeeId) {
        throw new AppError('Access denied: You are not authorized to view another employee’s leave balances.', 403, 'FORBIDDEN');
      }
      targetEmployeeId = String(req.query.employeeId);
    }

    if (!targetEmployeeId) {
      res.status(200).json({ balances: [] });
      return;
    }

    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId: targetEmployeeId },
      include: { leavePolicy: true },
      orderBy: { leavePolicy: { code: 'asc' } }
    });

    res.status(200).json({ balances });
  } catch (error) {
    next(error);
  }
});

// 3. Apply for Leave
leaveRouter.post('/apply', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('User is not associated with an employee record', 400);

    const schema = z.object({
      leavePolicyId: z.string().min(1),
      fromDate: z.string(),
      toDate: z.string(),
      durationType: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']).default('FULL_DAY'),
      totalDays: z.number().min(0.5),
      reason: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const policy = await prisma.leavePolicy.findUnique({
      where: { id: data.leavePolicyId }
    });
    if (!policy || policy.companyId !== req.user!.companyId) throw new AppError('Leave policy not found', 404);

    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);

    if (to < from) {
      throw new AppError('To date cannot be earlier than from date', 400);
    }

    // Check balance if paid policy
    if (policy.isPaid) {
      const balance = await prisma.employeeLeaveBalance.findFirst({
        where: { employeeId, leavePolicyId: policy.id }
      });
      if (!balance || Number(balance.balance) < data.totalDays) {
        throw new AppError(`Insufficient ${policy.name} balance. Available: ${balance ? Number(balance.balance) : 0}`, 400);
      }
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leavePolicyId: policy.id,
        fromDate: from,
        toDate: to,
        durationType: data.durationType as any,
        totalDays: data.totalDays,
        reason: data.reason,
        status: 'PENDING'
      }
    });

    await recordAudit(req, 'APPLY_LEAVE', 'LeaveRequest', leaveRequest.id, {
      policy: policy.code,
      days: data.totalDays
    });

    res.status(201).json({ leaveRequest });
  } catch (error) {
    next(error);
  }
});

// 4. List Leave Requests & Applications
leaveRouter.get(['/requests', '/applications'], authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const isApprover = req.user!.roles.some(r =>
      ['department_manager', 'hr_manager', 'hr_executive', 'company_admin', 'platform_admin'].includes(r)
    );

    const where: any = {
      employee: { companyId: req.user!.companyId },
      ...(status ? { status: status as any } : {})
    };

    if (!isApprover) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        leavePolicy: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ requests, applications: requests });
  } catch (error) {
    next(error);
  }
});

// 5. Approve / Reject Leave Request (Supports /requests/:id/action, /applications/:id/action, /applications/:id/:action)
leaveRouter.post(['/requests/:id/action', '/applications/:id/action', '/applications/:id/:action'], authenticate, requireRole(['department_manager', 'hr_manager', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let statusStr = req.body.status;
    if (req.params.action) {
      const act = String(req.params.action).toLowerCase();
      if (act === 'approve') statusStr = 'APPROVED';
      else if (act === 'reject') statusStr = 'REJECTED';
    }

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED'])
    });
    const { status } = schema.parse({ status: statusStr });

    const leaveReq = await prisma.leaveRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { leavePolicy: true, employee: true }
    });
    if (!leaveReq || leaveReq.employee?.companyId !== req.user!.companyId) {
      throw new AppError('Leave request not found', 404);
    }

    if (leaveReq.employeeId === req.user!.employeeId) {
      throw new AppError('Segregation of duties: You cannot approve your own leave request', 403, 'FORBIDDEN');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id: leaveReq.id },
        data: {
          status: status as any,
          approvedBy: req.user!.fullName,
          actionedAt: new Date()
        }
      });

      if (status === 'APPROVED' && leaveReq.leavePolicy.isPaid) {
        // Deduct balance
        const bal = await tx.employeeLeaveBalance.findFirst({
          where: {
            employeeId: leaveReq.employeeId,
            leavePolicyId: leaveReq.leavePolicyId
          }
        });
        if (bal) {
          const newUsed = Number(bal.used) + Number(leaveReq.totalDays);
          const newBal = Number(bal.credited) - newUsed;
          await tx.employeeLeaveBalance.update({
            where: { id: bal.id },
            data: {
              used: newUsed,
              balance: newBal
            }
          });
        }
      }

      return updatedReq;
    });

    await recordAudit(req, `LEAVE_${status}`, 'LeaveRequest', leaveReq.id, { status });
    res.status(200).json({ leaveRequest: updated });
  } catch (error) {
    next(error);
  }
});

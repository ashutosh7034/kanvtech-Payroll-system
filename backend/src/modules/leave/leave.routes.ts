import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const leaveRouter = Router();

// Helper: Calculate working days between two dates excluding weekends
function calculateWorkingDays(from: Date, to: Date, durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF' = 'FULL_DAY') {
  if (durationType === 'FIRST_HALF' || durationType === 'SECOND_HALF') {
    return { workingDays: 0.5, calendarDays: 1, weekendDays: 0 };
  }

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  let workingDays = 0;
  let weekendDays = 0;
  let calendarDays = 0;

  const current = new Date(start);
  while (current <= end) {
    calendarDays++;
    const dayOfWeek = current.getDay();
    // Sunday (0) and Saturday (6) are treated as weekly-off by default
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays++;
    } else {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return { workingDays: workingDays === 0 && calendarDays > 0 ? 0.5 : workingDays, calendarDays, weekendDays };
}

// 0. Working Days Calculation Endpoint
leaveRouter.post('/calculate-days', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      fromDate: z.string(),
      toDate: z.string(),
      durationType: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']).default('FULL_DAY')
    });
    const { fromDate, toDate, durationType } = schema.parse(req.body);

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError('Invalid date range provided', 400);
    }
    if (to < from) {
      throw new AppError('To date cannot be earlier than from date', 400);
    }

    const calc = calculateWorkingDays(from, to, durationType);
    res.status(200).json(calc);
  } catch (error) {
    next(error);
  }
});

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

// Create Leave Policy (HR / Admin)
leaveRouter.post('/policies', authenticate, requireRole(['company_admin', 'hr_manager', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1).max(20),
      name: z.string().min(1).max(100),
      annualQuota: z.number().min(0),
      isPaid: z.boolean().default(true),
      maxCarryForward: z.number().min(0).default(0),
      encashable: z.boolean().default(false),
      minAdvanceNoticeDays: z.number().min(0).default(0),
      maxConsecutiveDays: z.number().min(1).default(30),
      allowHalfDay: z.boolean().default(true),
      requiresAttachment: z.boolean().default(false),
      probationAllowed: z.boolean().default(true),
      applicableGender: z.enum(['ALL', 'MALE', 'FEMALE', 'OTHER']).default('ALL'),
      accrualFrequency: z.enum(['ANNUAL', 'MONTHLY', 'QUARTERLY']).default('ANNUAL'),
      description: z.string().optional()
    });
    const data = schema.parse(req.body);

    const existing = await prisma.leavePolicy.findUnique({
      where: {
        companyId_code: {
          companyId: req.user!.companyId,
          code: data.code.toUpperCase()
        }
      }
    });
    if (existing) {
      throw new AppError(`Leave policy with code "${data.code}" already exists for this company`, 400);
    }

    const policy = await prisma.leavePolicy.create({
      data: {
        companyId: req.user!.companyId,
        code: data.code.toUpperCase(),
        name: data.name,
        annualQuota: data.annualQuota,
        isPaid: data.isPaid,
        maxCarryForward: data.maxCarryForward,
        encashable: data.encashable,
        minAdvanceNoticeDays: data.minAdvanceNoticeDays,
        maxConsecutiveDays: data.maxConsecutiveDays,
        allowHalfDay: data.allowHalfDay,
        requiresAttachment: data.requiresAttachment,
        probationAllowed: data.probationAllowed,
        applicableGender: data.applicableGender,
        accrualFrequency: data.accrualFrequency,
        description: data.description
      }
    });

    await recordAudit(req, 'CREATE_LEAVE_POLICY', 'LeavePolicy', policy.id, { code: policy.code, annualQuota: data.annualQuota });
    res.status(201).json({ policy });
  } catch (error) {
    next(error);
  }
});

// Update Leave Policy (HR / Admin)
leaveRouter.patch('/policies/:id', authenticate, requireRole(['company_admin', 'hr_manager', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const policy = await prisma.leavePolicy.findUnique({
      where: { id: String(req.params.id) }
    });
    if (!policy || policy.companyId !== req.user!.companyId) {
      throw new AppError('Leave policy not found', 404);
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      annualQuota: z.number().min(0).optional(),
      isPaid: z.boolean().optional(),
      maxCarryForward: z.number().min(0).optional(),
      encashable: z.boolean().optional(),
      minAdvanceNoticeDays: z.number().min(0).optional(),
      maxConsecutiveDays: z.number().min(1).optional(),
      allowHalfDay: z.boolean().optional(),
      requiresAttachment: z.boolean().optional(),
      probationAllowed: z.boolean().optional(),
      applicableGender: z.enum(['ALL', 'MALE', 'FEMALE', 'OTHER']).optional(),
      accrualFrequency: z.enum(['ANNUAL', 'MONTHLY', 'QUARTERLY']).optional(),
      description: z.string().optional()
    });
    const data = schema.parse(req.body);

    const updated = await prisma.leavePolicy.update({
      where: { id: policy.id },
      data
    });

    await recordAudit(req, 'UPDATE_LEAVE_POLICY', 'LeavePolicy', updated.id, data);
    res.status(200).json({ policy: updated });
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

    const currentYear = new Date().getFullYear();
    let balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId: targetEmployeeId },
      include: { leavePolicy: true },
      orderBy: { leavePolicy: { code: 'asc' } }
    });

    // Auto-seed initial balances from policies if empty
    if (balances.length === 0) {
      const policies = await prisma.leavePolicy.findMany({
        where: { companyId: req.user!.companyId }
      });
      for (const pol of policies) {
        await prisma.employeeLeaveBalance.upsert({
          where: {
            employeeId_leavePolicyId_calendarYear: {
              employeeId: targetEmployeeId,
              leavePolicyId: pol.id,
              calendarYear: currentYear
            }
          },
          create: {
            employeeId: targetEmployeeId,
            leavePolicyId: pol.id,
            calendarYear: currentYear,
            credited: pol.annualQuota,
            used: 0,
            balance: pol.annualQuota
          },
          update: {}
        });
      }
      balances = await prisma.employeeLeaveBalance.findMany({
        where: { employeeId: targetEmployeeId },
        include: { leavePolicy: true },
        orderBy: { leavePolicy: { code: 'asc' } }
      });
    }

    res.status(200).json({ balances });
  } catch (error) {
    next(error);
  }
});

// Adjust Leave Balance (HR / Admin)
leaveRouter.post('/balances/adjust', authenticate, requireRole(['company_admin', 'hr_manager', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      leavePolicyId: z.string().min(1),
      calendarYear: z.number().default(new Date().getFullYear()),
      adjustmentDays: z.number(), // positive to add, negative to reduce
      reason: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const targetEmp = await prisma.employee.findUnique({
      where: { id: data.employeeId }
    });
    if (!targetEmp || targetEmp.companyId !== req.user!.companyId) {
      throw new AppError('Employee not found in organization', 404);
    }

    const policy = await prisma.leavePolicy.findUnique({
      where: { id: data.leavePolicyId }
    });
    if (!policy || policy.companyId !== req.user!.companyId) {
      throw new AppError('Leave policy not found', 404);
    }

    const bal = await prisma.employeeLeaveBalance.upsert({
      where: {
        employeeId_leavePolicyId_calendarYear: {
          employeeId: data.employeeId,
          leavePolicyId: data.leavePolicyId,
          calendarYear: data.calendarYear
        }
      },
      create: {
        employeeId: data.employeeId,
        leavePolicyId: data.leavePolicyId,
        calendarYear: data.calendarYear,
        credited: Number(policy.annualQuota) + data.adjustmentDays,
        used: 0,
        balance: Number(policy.annualQuota) + data.adjustmentDays
      },
      update: {
        credited: { increment: data.adjustmentDays },
        balance: { increment: data.adjustmentDays }
      }
    });

    await recordAudit(req, 'ADJUST_LEAVE_BALANCE', 'EmployeeLeaveBalance', bal.id, {
      employeeId: data.employeeId,
      policy: policy.code,
      adjustmentDays: data.adjustmentDays,
      reason: data.reason
    });

    res.status(200).json({ balance: bal, message: `Leave balance successfully adjusted by ${data.adjustmentDays} days` });
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
      halfDayPeriod: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
      totalDays: z.number().min(0.5).optional(),
      reason: z.string().min(1),
      attachmentUrl: z.string().optional(),
      isDraft: z.boolean().default(false)
    });
    const data = schema.parse(req.body);

    const policy = await prisma.leavePolicy.findUnique({
      where: { id: data.leavePolicyId }
    });
    if (!policy || policy.companyId !== req.user!.companyId) throw new AppError('Leave policy not found', 404);

    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError('Invalid date values provided', 400);
    }

    if (to < from) {
      throw new AppError('To date cannot be earlier than from date', 400);
    }

    // Calculate computed working days if not explicitly supplied
    let computedDays = data.totalDays;
    if (!computedDays) {
      const calc = calculateWorkingDays(from, to, data.durationType as any);
      computedDays = calc.workingDays;
    }

    // Policy Validation (Only strictly enforced if not draft)
    if (!data.isDraft) {
      // 1. Half-day support check
      if ((data.durationType === 'FIRST_HALF' || data.durationType === 'SECOND_HALF') && !policy.allowHalfDay) {
        throw new AppError(`Half-day leaves are not permitted under the ${policy.name} policy`, 400);
      }

      // 2. Minimum advance notice check
      if (policy.minAdvanceNoticeDays > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fromCopy = new Date(from);
        fromCopy.setHours(0, 0, 0, 0);
        const noticeDays = Math.ceil((fromCopy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (noticeDays < policy.minAdvanceNoticeDays) {
          throw new AppError(`The ${policy.name} policy requires at least ${policy.minAdvanceNoticeDays} day(s) advance notice. (Submitted with ${Math.max(0, noticeDays)} days notice)`, 400);
        }
      }

      // 3. Maximum consecutive days check
      if (computedDays > policy.maxConsecutiveDays) {
        throw new AppError(`Requested days (${computedDays}) exceeds the maximum allowable consecutive limit of ${policy.maxConsecutiveDays} days for ${policy.name}.`, 400);
      }

      // 4. Required attachment check
      if (policy.requiresAttachment && (!data.attachmentUrl || !data.attachmentUrl.trim())) {
        throw new AppError(`A supporting document or medical certificate is mandatory for ${policy.name}.`, 400);
      }

      // 5. Probation eligibility check
      const empRecord = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (empRecord?.status === 'PROBATION' && !policy.probationAllowed) {
        throw new AppError(`Employees on probation are not eligible for ${policy.name}.`, 400);
      }

      // 6. Overlapping request check
      const overlapping = await prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          fromDate: { lte: to },
          toDate: { gte: from }
        }
      });
      if (overlapping) {
        const oFrom = overlapping.fromDate.toISOString().split('T')[0];
        const oTo = overlapping.toDate.toISOString().split('T')[0];
        throw new AppError(`You already have an active leave request (${overlapping.applicationNumber || overlapping.id}) overlapping this period (${oFrom} to ${oTo}).`, 400);
      }

      // 7. Check balance if paid policy
      if (policy.isPaid) {
        const balance = await prisma.employeeLeaveBalance.findFirst({
          where: { employeeId, leavePolicyId: policy.id }
        });
        if (!balance || Number(balance.balance) < computedDays) {
          throw new AppError(`Insufficient ${policy.name} balance. Available: ${balance ? Number(balance.balance) : 0} days, Requested: ${computedDays} days.`, 400);
        }
      }
    }

    // Auto-generate reference application number
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `LR-${year}-${randomSuffix}`;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leavePolicyId: policy.id,
        applicationNumber,
        fromDate: from,
        toDate: to,
        durationType: data.durationType as any,
        halfDayPeriod: data.halfDayPeriod || (data.durationType !== 'FULL_DAY' ? data.durationType : null),
        totalDays: computedDays,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl,
        isDraft: data.isDraft,
        status: data.isDraft ? 'DRAFT' : 'PENDING'
      },
      include: {
        leavePolicy: true
      }
    });

    await recordAudit(req, data.isDraft ? 'SAVE_DRAFT_LEAVE' : 'APPLY_LEAVE', 'LeaveRequest', leaveRequest.id, {
      applicationNumber,
      policy: policy.code,
      days: computedDays,
      isDraft: data.isDraft
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
    const userRoles = req.user!.roles;

    const isHrOrAdmin = userRoles.some(r => ['hr_manager', 'hr_executive', 'company_admin', 'platform_admin'].includes(r));
    const isDeptManager = userRoles.includes('department_manager');

    const where: any = {
      employee: { companyId: req.user!.companyId }
    };

    if (status) {
      where.status = status as any;
    }

    // Scoping rules:
    // 1. HR/Admin can see company-wide requests
    // 2. Department Manager can only see direct reports (or self if queried explicitly)
    // 3. Employee can only see own requests
    if (isHrOrAdmin) {
      if (req.query.employeeId) {
        where.employeeId = String(req.query.employeeId);
      }
      if (req.query.departmentId) {
        where.employee.departmentId = String(req.query.departmentId);
      }
    } else if (isDeptManager) {
      // Check if viewing self applications or team approvals
      if (req.query.scope === 'self' || req.query.employeeId === req.user!.employeeId) {
        where.employeeId = req.user!.employeeId || 'unassigned';
      } else {
        // Manager view: direct reports only
        where.employee = {
          companyId: req.user!.companyId,
          managerId: req.user!.employeeId || 'unassigned'
        };
        if (req.query.departmentId) {
          where.employee.departmentId = String(req.query.departmentId);
        }
      }
    } else {
      // Standard employee: strictly own applications
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
            managerId: true,
            department: { select: { id: true, name: true } }
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

// 5. Withdraw / Cancel Leave Request
leaveRouter.post(['/requests/:id/cancel', '/applications/:id/cancel', '/requests/:id/withdraw', '/applications/:id/withdraw'], authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leaveReq = await prisma.leaveRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { leavePolicy: true, employee: true }
    });

    if (!leaveReq || leaveReq.employee?.companyId !== req.user!.companyId) {
      throw new AppError('Leave request not found', 404);
    }

    const isOwner = leaveReq.employeeId === req.user!.employeeId;
    const isHrOrAdmin = req.user!.roles.some(r => ['hr_manager', 'company_admin', 'platform_admin'].includes(r));

    if (!isOwner && !isHrOrAdmin) {
      throw new AppError('You are not authorized to cancel this leave application', 403, 'FORBIDDEN');
    }

    if (['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(leaveReq.status)) {
      throw new AppError(`Cannot cancel a request that is already ${leaveReq.status}`, 400);
    }

    const newStatus = isOwner && leaveReq.status === 'PENDING' ? 'WITHDRAWN' : 'CANCELLED';

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id: leaveReq.id },
        data: {
          status: newStatus as any,
          actionedAt: new Date(),
          approverComment: req.body.reason ? `Cancelled/Withdrawn: ${req.body.reason}` : 'Withdrawn by employee'
        }
      });

      // If it was already approved and paid, restore the deducted balance!
      if (leaveReq.status === 'APPROVED' && leaveReq.leavePolicy.isPaid) {
        const bal = await tx.employeeLeaveBalance.findFirst({
          where: {
            employeeId: leaveReq.employeeId,
            leavePolicyId: leaveReq.leavePolicyId
          }
        });
        if (bal) {
          const newUsed = Math.max(0, Number(bal.used) - Number(leaveReq.totalDays));
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

    await recordAudit(req, `LEAVE_${newStatus}`, 'LeaveRequest', leaveReq.id, {
      previousStatus: leaveReq.status,
      newStatus
    });

    res.status(200).json({ leaveRequest: updated, message: `Leave application successfully ${newStatus.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
});

// 6. Approve / Reject Leave Request
leaveRouter.post(['/requests/:id/action', '/applications/:id/action', '/applications/:id/:action'], authenticate, requireRole(['department_manager', 'hr_manager', 'company_admin', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let statusStr = req.body.status;
    if (req.params.action) {
      const act = String(req.params.action).toLowerCase();
      if (act === 'approve') statusStr = 'APPROVED';
      else if (act === 'reject') statusStr = 'REJECTED';
    }

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      rejectionReason: z.string().optional(),
      approverComment: z.string().optional()
    });
    const { status, rejectionReason, approverComment } = schema.parse({
      status: statusStr,
      rejectionReason: req.body.rejectionReason,
      approverComment: req.body.approverComment
    });

    // Rejection reason validation
    if (status === 'REJECTED') {
      const reason = rejectionReason || approverComment;
      if (!reason || !reason.trim()) {
        throw new AppError('A valid rejection reason is mandatory when rejecting a leave request.', 400);
      }
    }

    const leaveReq = await prisma.leaveRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { leavePolicy: true, employee: true }
    });
    if (!leaveReq || leaveReq.employee?.companyId !== req.user!.companyId) {
      throw new AppError('Leave request not found', 404);
    }

    // Segregation of duties
    if (leaveReq.employeeId === req.user!.employeeId) {
      throw new AppError('Segregation of duties: You cannot approve your own leave request', 403, 'FORBIDDEN');
    }

    // Scope check: If department manager, verify reporting relationship
    const isHrOrAdmin = req.user!.roles.some(r => ['hr_manager', 'company_admin', 'platform_admin'].includes(r));
    if (!isHrOrAdmin && req.user!.roles.includes('department_manager')) {
      if (leaveReq.employee.managerId !== req.user!.employeeId) {
        throw new AppError('Access denied: You are only authorized to action leave requests for your direct reports.', 403, 'FORBIDDEN');
      }
    }

    // Prevent duplicate actioning
    if (leaveReq.status === 'APPROVED' && status === 'APPROVED') {
      throw new AppError('This leave request is already approved.', 400);
    }
    if (leaveReq.status === 'REJECTED' && status === 'REJECTED') {
      throw new AppError('This leave request is already rejected.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id: leaveReq.id },
        data: {
          status: status as any,
          approvedBy: req.user!.fullName,
          approverComment: approverComment || rejectionReason || (status === 'APPROVED' ? 'Approved by manager' : 'Rejected'),
          rejectionReason: status === 'REJECTED' ? (rejectionReason || approverComment) : null,
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

    await recordAudit(req, `LEAVE_${status}`, 'LeaveRequest', leaveReq.id, {
      status,
      approver: req.user!.fullName,
      rejectionReason: status === 'REJECTED' ? (rejectionReason || approverComment) : undefined
    });

    res.status(200).json({ leaveRequest: updated });
  } catch (error) {
    next(error);
  }
});

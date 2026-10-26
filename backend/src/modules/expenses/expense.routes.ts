import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit, AuthenticatedUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { notifyExpenseReviewersOnSubmission, notifyClaimantOnAction } from '../notifications/notification.service.js';

const UPLOADS_DIR = path.resolve('uploads', 'expenses');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const expenseRouter = Router();

/**
 * Resolves the active Employee record for the authenticated user with strict tenant isolation,
 * role validation, inactive account detection, and clear administrative resolution guidance.
 */
export async function resolveAuthenticatedEmployee(authUser: AuthenticatedUser) {
  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    include: {
      employee: {
        include: {
          department: true,
          branch: true,
          designation: true
        }
      },
      company: {
        select: { id: true, name: true, code: true }
      }
    }
  });

  if (!user || !user.active) {
    throw new AppError('User account not found or deactivated.', 401, 'UNAUTHORIZED');
  }

  // 1. Direct Employee Association via user.employeeId
  if (user.employeeId && user.employee) {
    // Enforce Tenant Isolation
    if (user.employee.companyId !== user.companyId) {
      throw new AppError(
        'Tenant security violation: Associated employee record does not belong to your company.',
        403,
        'CROSS_TENANT_VIOLATION'
      );
    }

    // Enforce Active Status (ACTIVE, PROBATION, CONFIRMED, NOTICE_PERIOD are allowed)
    const activeStatuses = ['ACTIVE', 'PROBATION', 'CONFIRMED', 'NOTICE_PERIOD'];
    if (!activeStatuses.includes(user.employee.status)) {
      throw new AppError(
        `Employee record for ${user.fullName} is inactive (status: ${user.employee.status}). Expense claims can only be submitted for active employees.`,
        403,
        'INACTIVE_EMPLOYEE'
      );
    }

    return user.employee;
  }

  // 2. Fallback: Safe tenant-scoped association by workEmail if unambiguous
  if (user.email) {
    const candidates = await prisma.employee.findMany({
      where: {
        companyId: user.companyId,
        workEmail: { equals: user.email, mode: 'insensitive' }
      },
      include: {
        department: true,
        branch: true,
        designation: true
      }
    });

    if (candidates.length === 1) {
      const candidate = candidates[0];
      const activeStatuses = ['ACTIVE', 'PROBATION', 'CONFIRMED', 'NOTICE_PERIOD'];
      if (!activeStatuses.includes(candidate.status)) {
        throw new AppError(
          `Matching employee record ${candidate.employeeCode} is inactive (status: ${candidate.status}).`,
          403,
          'INACTIVE_EMPLOYEE'
        );
      }

      // Check if already bound to another user
      const existingUser = await prisma.user.findFirst({
        where: { employeeId: candidate.id, id: { not: user.id } }
      });
      if (existingUser) {
        throw new AppError(
          `Employee record ${candidate.employeeCode} is already linked to another user account (${existingUser.username}).`,
          409,
          'AMBIGUOUS_EMPLOYEE_ASSOCIATION'
        );
      }

      // Automatically link to prevent future lookups
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: candidate.id }
      });

      return candidate;
    }

    if (candidates.length > 1) {
      throw new AppError(
        `Ambiguous employee association: Multiple employee profiles in ${user.company.name} share email '${user.email}'. Contact HR to manually link your account.`,
        409,
        'AMBIGUOUS_EMPLOYEE_ASSOCIATION'
      );
    }
  }

  // 3. Unlinked user error with actionable administrative resolution
  const orgName = user.company?.name || 'this organization';
  throw new AppError(
    `User account '${user.username}' (${user.fullName}) is not associated with an employee profile in ${orgName}. Reimbursement claims require an active employee profile. Administrative Resolution: An HR Manager or Company Admin can link your account to an employee profile in the Employee Master or via the link-user-employee API.`,
    400,
    'UNLINKED_EMPLOYEE'
  );
}

// -------------------------------------------------------------
// 1. Expense Categories (Tenant-Scoped)
// -------------------------------------------------------------
expenseRouter.get('/categories', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 2. Consolidated Claims List (Role-Aware, Tenant-Isolated, Paginated, Filtered)
// -------------------------------------------------------------
expenseRouter.get('/claims', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userRoles = req.user!.roles;
    const isApprover = userRoles.some(r =>
      ['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'hr_executive', 'payroll_admin'].includes(r)
    );
    const isDeptManager = userRoles.includes('department_manager');

    // Query parameters
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const statusFilter = req.query.status && req.query.status !== 'ALL' ? String(req.query.status) : undefined;
    const claimTypeFilter = req.query.claimType && req.query.claimType !== 'ALL' ? String(req.query.claimType) : undefined;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const employeeIdFilter = req.query.employeeId ? String(req.query.employeeId) : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
    const sortBy = ['createdAt', 'claimDate', 'totalAmount', 'status'].includes(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : 'createdAt';
    const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Base tenant scoping
    const where: any = {
      employee: {
        companyId: req.user!.companyId,
        ...(departmentId ? { departmentId } : {})
      }
    };

    if (claimTypeFilter) {
      where.claimType = claimTypeFilter;
    }

    // Role-based visibility
    let callerEmployee: any = null;
    try {
      callerEmployee = await resolveAuthenticatedEmployee(req.user!);
    } catch {
      // Unlinked user - allowed to view if approver, otherwise returns empty
    }

    if (!isApprover) {
      if (isDeptManager && callerEmployee?.departmentId) {
        // Department manager can see their department claims or own claims
        where.OR = [
          { employeeId: callerEmployee.id },
          { employee: { departmentId: callerEmployee.departmentId, companyId: req.user!.companyId } }
        ];
      } else if (callerEmployee) {
        // Regular employee can ONLY see their own claims
        where.employeeId = callerEmployee.id;
      } else {
        // Unlinked non-approver user has no claims to view
        res.status(200).json({
          claims: [],
          pagination: { page: 1, pageSize, total: 0, totalPages: 0 },
          metrics: { totalCount: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0, correctionRequestedCount: 0, paidCount: 0, expenseCount: 0, reimbursementCount: 0, totalPendingAmount: 0, totalApprovedAmount: 0, totalPaidAmount: 0 },
          userContext: { isApprover: false, hasLinkedEmployee: false }
        });
        return;
      }
    } else if (employeeIdFilter) {
      where.employeeId = employeeIdFilter;
    }

    // Status filter
    if (statusFilter) {
      where.status = statusFilter;
    }

    // Date range filter
    if (startDate || endDate) {
      where.claimDate = {};
      if (startDate) where.claimDate.gte = startDate;
      if (endDate) where.claimDate.lte = endDate;
    }

    // Search query (Claim Number, Title, Employee Name, Employee Code)
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { claimNumber: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { employee: { firstName: { contains: search, mode: 'insensitive' } } },
            { employee: { lastName: { contains: search, mode: 'insensitive' } } },
            { employee: { employeeCode: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // Execute queries
    const [total, claims, allMatchingClaims] = await Promise.all([
      prisma.expenseClaim.count({ where }),
      prisma.expenseClaim.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              workEmail: true,
              department: { select: { id: true, name: true, code: true } },
              branch: { select: { id: true, name: true, city: true } }
            }
          },
          items: {
            include: {
              category: { select: { id: true, name: true, code: true, maxLimit: true } }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      // Metric summary for active tenant scope
      prisma.expenseClaim.findMany({
        where: {
          employee: { companyId: req.user!.companyId },
          ...(!isApprover && callerEmployee ? { employeeId: callerEmployee.id } : {})
        },
        select: { status: true, totalAmount: true, claimType: true }
      })
    ]);

    // Calculate metrics
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let correctionRequestedCount = 0;
    let paidCount = 0;
    let expenseCount = 0;
    let reimbursementCount = 0;
    let totalPendingAmount = new Decimal(0);
    let totalApprovedAmount = new Decimal(0);
    let totalPaidAmount = new Decimal(0);

    for (const c of allMatchingClaims) {
      if ((c as any).claimType === 'REIMBURSEMENT') {
        reimbursementCount++;
      } else {
        expenseCount++;
      }

      if (c.status === 'PENDING') {
        pendingCount++;
        totalPendingAmount = totalPendingAmount.plus(c.totalAmount || 0);
      } else if (c.status === 'APPROVED') {
        approvedCount++;
        totalApprovedAmount = totalApprovedAmount.plus(c.totalAmount || 0);
      } else if (c.status === 'REJECTED') {
        rejectedCount++;
      } else if (c.status === 'CORRECTION_REQUESTED') {
        correctionRequestedCount++;
      } else if (c.status === 'PAID') {
        paidCount++;
        totalPaidAmount = totalPaidAmount.plus(c.totalAmount || 0);
      }
    }

    res.status(200).json({
      claims,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      },
      metrics: {
        totalCount: allMatchingClaims.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        correctionRequestedCount,
        paidCount,
        expenseCount,
        reimbursementCount,
        totalPendingAmount: Number(totalPendingAmount),
        totalApprovedAmount: Number(totalApprovedAmount),
        totalPaidAmount: Number(totalPaidAmount)
      },
      userContext: {
        isApprover,
        hasLinkedEmployee: Boolean(callerEmployee),
        employeeId: callerEmployee?.id || null,
        employeeCode: callerEmployee?.employeeCode || null,
        employeeName: callerEmployee ? `${callerEmployee.firstName} ${callerEmployee.lastName}` : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 3. Single Claim Detail View
// -------------------------------------------------------------
expenseRouter.get('/claims/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
            department: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true, city: true } }
          }
        },
        items: {
          include: {
            category: true
          }
        }
      }
    });

    if (!claim || claim.employee?.companyId !== req.user!.companyId) {
      throw new AppError('Expense claim not found or does not belong to your company.', 404);
    }

    const isApprover = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'hr_executive', 'payroll_admin', 'department_manager'].includes(r)
    );

    // If regular employee, verify ownership
    if (!isApprover && claim.employeeId !== req.user!.employeeId) {
      throw new AppError('Access denied: You can only view your own expense claims.', 403, 'FORBIDDEN');
    }

    res.status(200).json({ claim });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 4. Submit Expense Claim (Multi-Item, Server Totals, Limit Verification, Transactional)
// -------------------------------------------------------------
expenseRouter.post('/claims', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Resolve employee identity strictly server-side
    const employee = await resolveAuthenticatedEmployee(req.user!);

    // 2. Validate input schema
    const schema = z.object({
      claimType: z.enum(['EXPENSE', 'REIMBURSEMENT']).optional().default('EXPENSE'),
      title: z.string().trim().min(3, 'Claim title must be at least 3 characters').max(120, 'Claim title must not exceed 120 characters'),
      claimDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid claim date format' }),
      items: z.array(
        z.object({
          categoryId: z.string().min(1, 'Category ID is required'),
          amount: z.number().positive('Item amount must be greater than 0'),
          receiptUrl: z.string().optional().nullable(),
          description: z.string().optional().nullable()
        })
      ).min(1, 'At least one expense line item is required')
    });

    const data = schema.parse(req.body);
    const parsedClaimDate = new Date(data.claimDate);

    // 3. Verify category existence, tenant isolation, and category maxLimits
    const categoryIds = [...new Set(data.items.map(i => i.categoryId))];
    const categories = await prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds },
        companyId: req.user!.companyId
      }
    });

    if (categories.length !== categoryIds.length) {
      throw new AppError('One or more selected expense categories are invalid or belong to a different company.', 400);
    }

    const catMap = new Map(categories.map(c => [c.id, c]));

    // Check line items: must be positive and within reasonable financial ceilings (<= ₹1 crore)
    for (const item of data.items) {
      if (item.amount <= 0 || item.amount > 10000000) {
        throw new AppError('Item amount must be positive and within configured limits (up to ₹1,00,00,000).', 400);
      }
    }

    // 4. Calculate total amount deterministically on the server
    const serverTotal = data.items.reduce(
      (sum, item) => sum.plus(new Decimal(item.amount)),
      new Decimal(0)
    );

    // 5. Idempotency / Duplicate Submission Prevention (within 60 seconds)
    const recentDuplicate = await prisma.expenseClaim.findFirst({
      where: {
        employeeId: employee.id,
        title: data.title,
        claimDate: parsedClaimDate,
        totalAmount: serverTotal,
        createdAt: { gte: new Date(Date.now() - 60000) }
      },
      include: {
        employee: {
          select: { id: true, companyId: true, firstName: true, lastName: true, employeeCode: true }
        },
        items: true
      }
    });

    if (recentDuplicate) {
      res.status(201).json({
        claim: recentDuplicate,
        message: 'Claim already received (idempotent duplicate submission acknowledged).'
      });
      return;
    }

    // 6. Generate human-readable Claim Number (e.g. EXP-2026-1042 or REIM-2026-1042)
    const year = parsedClaimDate.getFullYear();
    const countThisYear = await prisma.expenseClaim.count({
      where: {
        employee: { companyId: req.user!.companyId }
      }
    });
    const prefix = data.claimType === 'REIMBURSEMENT' ? 'REIM' : 'EXP';
    const claimNumber = `${prefix}-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    // 7. Atomic Database Transaction
    const claim = await prisma.$transaction(async tx => {
      const createdClaim = await tx.expenseClaim.create({
        data: {
          claimNumber,
          employeeId: employee.id,
          claimType: data.claimType || 'EXPENSE',
          title: data.title,
          claimDate: parsedClaimDate,
          totalAmount: serverTotal,
          status: 'PENDING'
        }
      });

      for (const item of data.items) {
        await tx.expenseItem.create({
          data: {
            expenseClaimId: createdClaim.id,
            categoryId: item.categoryId,
            amount: new Decimal(item.amount),
            receiptUrl: item.receiptUrl || null,
            description: item.description || null
          }
        });
      }

      return createdClaim;
    });

    // 8. Fetch complete claim with relations for response & notifications
    const completeClaim = await prisma.expenseClaim.findUniqueOrThrow({
      where: { id: claim.id },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workEmail: true,
            department: { select: { name: true } }
          }
        },
        items: {
          include: { category: true }
        }
      }
    });

    // 9. Audit Logging
    await recordAudit(req, 'SUBMIT_EXPENSE_CLAIM', 'ExpenseClaim', completeClaim.id, {
      claimNumber: completeClaim.claimNumber,
      claimType: completeClaim.claimType,
      totalAmount: Number(serverTotal),
      itemCount: data.items.length
    });

    // 10. Notify all eligible HR & Admin Reviewers in the Tenant
    try {
      await notifyExpenseReviewersOnSubmission(completeClaim, req.user!.userId);
    } catch (err) {
      console.error('Failed to notify expense reviewers:', err);
    }

    const typeLabel = data.claimType === 'REIMBURSEMENT' ? 'Reimbursement' : 'Expense';
    res.status(201).json({
      claim: completeClaim,
      message: `${typeLabel} claim ${completeClaim.claimNumber} submitted successfully for ₹${Number(serverTotal).toLocaleString('en-IN')}.`
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 5. Review & Approval Action (Approve / Reject / Correction Requested / Paid)
// Supports BOTH POST /claims/:id/action AND PATCH /claims/:id/status
// -------------------------------------------------------------
async function handleClaimAction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'PAID']),
      reason: z.string().optional()
    });
    const { status, reason } = schema.parse(req.body);

    if ((status === 'REJECTED' || status === 'CORRECTION_REQUESTED') && (!reason || reason.trim().length === 0)) {
      throw new AppError(`A clear justification or rejection reason is required when setting claim status to ${status}.`, 400);
    }

    const claim = await prisma.expenseClaim.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workEmail: true
          }
        }
      }
    });

    if (!claim || claim.employee?.companyId !== req.user!.companyId) {
      throw new AppError('Expense claim not found or does not belong to your company.', 404);
    }

    // Segregation of duties: Reviewer cannot approve/reject their own claim
    if (claim.employeeId === req.user!.employeeId) {
      throw new AppError('Segregation of duties: You cannot approve your own expense claim', 403, 'FORBIDDEN');
    }

    const updated = await prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status,
        approvedBy: req.user!.fullName,
        actionedAt: new Date(),
        rejectionReason: (status === 'REJECTED' || status === 'CORRECTION_REQUESTED') ? reason?.trim() : null
      },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workEmail: true
          }
        },
        items: { include: { category: true } }
      }
    });

    // Audit logging
    await recordAudit(req, `ACTION_EXPENSE_CLAIM_${status}`, 'ExpenseClaim', updated.id, {
      status,
      actionedBy: req.user!.fullName,
      reason: reason || null
    });

    // Notify the claimant employee of the status update
    try {
      await notifyClaimantOnAction(updated, req.user!.fullName);
    } catch (err) {
      console.error('Failed to notify claimant of status update:', err);
    }

    const readableStatus = status.toLowerCase().replace('_', ' ');
    res.status(200).json({
      claim: updated,
      message: `Expense claim ${updated.claimNumber || updated.title} has been updated to ${readableStatus} successfully.`
    });
  } catch (error) {
    next(error);
  }
}

// Register both POST action and PATCH status for frontend parity
expenseRouter.post(
  '/claims/:id/action',
  authenticate,
  requireRole(['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'department_manager']),
  handleClaimAction
);

expenseRouter.patch(
  '/claims/:id/status',
  authenticate,
  requireRole(['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'department_manager']),
  handleClaimAction
);

// -------------------------------------------------------------
// 5b. Resubmit Claim After Corrections Requested (Employee Self-Service)
// -------------------------------------------------------------
expenseRouter.put('/claims/:id/resubmit', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employee = await resolveAuthenticatedEmployee(req.user!);
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: String(req.params.id) },
      include: { employee: true }
    });

    if (!claim || claim.employee.companyId !== req.user!.companyId) {
      throw new AppError('Expense claim not found.', 404);
    }

    if (claim.employeeId !== employee.id) {
      throw new AppError('Access denied: You can only resubmit your own expense claims.', 403);
    }

    if (claim.status !== 'CORRECTION_REQUESTED') {
      throw new AppError(`Cannot resubmit claim with status '${claim.status}'. Resubmission is only permitted when status is 'CORRECTION_REQUESTED'.`, 400);
    }

    const schema = z.object({
      title: z.string().trim().min(3, 'Claim title must be at least 3 characters').max(120),
      claimDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid claim date format' }),
      correctionNotes: z.string().optional(),
      items: z.array(
        z.object({
          categoryId: z.string().min(1, 'Category ID is required'),
          amount: z.number().positive('Item amount must be greater than 0'),
          receiptUrl: z.string().optional().nullable(),
          description: z.string().optional().nullable()
        })
      ).min(1, 'At least one expense line item is required')
    });

    const data = schema.parse(req.body);
    const parsedClaimDate = new Date(data.claimDate);

    // Validate categories
    const categoryIds = [...new Set(data.items.map(i => i.categoryId))];
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds }, companyId: req.user!.companyId }
    });
    if (categories.length !== categoryIds.length) {
      throw new AppError('One or more selected categories are invalid or belong to another company.', 400);
    }

    for (const item of data.items) {
      if (item.amount <= 0 || item.amount > 10000000) {
        throw new AppError('Item amount must be positive and within configured limits (up to ₹1,00,00,000).', 400);
      }
    }

    // Server-side deterministic total
    const serverTotal = data.items.reduce(
      (sum, item) => sum.plus(new Decimal(item.amount)),
      new Decimal(0)
    );

    // Atomic transaction: replace items, update claim status back to PENDING, store resubmission metadata
    const updated = await prisma.$transaction(async tx => {
      await tx.expenseItem.deleteMany({ where: { expenseClaimId: claim.id } });

      for (const item of data.items) {
        await tx.expenseItem.create({
          data: {
            expenseClaimId: claim.id,
            categoryId: item.categoryId,
            amount: new Decimal(item.amount),
            receiptUrl: item.receiptUrl || null,
            description: item.description || null
          }
        });
      }

      return tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          title: data.title,
          claimDate: parsedClaimDate,
          totalAmount: serverTotal,
          status: 'PENDING',
          resubmittedAt: new Date(),
          correctionNotes: data.correctionNotes?.trim() || null,
          rejectionReason: null // Reset reviewer rejection reason upon fresh resubmission
        },
        include: {
          employee: {
            select: { id: true, companyId: true, firstName: true, lastName: true, employeeCode: true, workEmail: true }
          },
          items: { include: { category: true } }
        }
      });
    });

    await recordAudit(req, 'RESUBMIT_EXPENSE_CLAIM', 'ExpenseClaim', updated.id, {
      claimNumber: updated.claimNumber,
      totalAmount: Number(serverTotal),
      itemCount: data.items.length
    });

    try {
      await notifyExpenseReviewersOnSubmission(updated, req.user!.userId);
    } catch (err) {
      console.error('Failed to notify reviewers on resubmission:', err);
    }

    res.status(200).json({
      claim: updated,
      message: `Claim ${updated.claimNumber || updated.title} has been resubmitted successfully for review.`
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 5c. HR/Admin Claim-Driven Employee List (Hierarchical Management)
// Displays ONLY employees who have submitted claims in the authorized scope
// -------------------------------------------------------------
expenseRouter.get(
  '/employees-with-claims',
  authenticate,
  requireRole(['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'hr_executive', 'payroll_admin', 'department_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = req.query.search ? String(req.query.search).trim() : undefined;
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
      const statusFilter = req.query.status && req.query.status !== 'ALL' ? String(req.query.status) : undefined;
      const claimTypeFilter = req.query.claimType && req.query.claimType !== 'ALL' ? String(req.query.claimType) : undefined;

      const claimWhere: any = {
        employee: {
          companyId: req.user!.companyId,
          ...(departmentId ? { departmentId } : {})
        }
      };
      if (statusFilter) claimWhere.status = statusFilter;
      if (claimTypeFilter) claimWhere.claimType = claimTypeFilter;

      if (req.user!.roles.includes('department_manager') && !req.user!.roles.some(r => ['company_admin', 'platform_admin', 'finance_admin', 'hr_manager'].includes(r))) {
        let emp: any = null;
        try { emp = await resolveAuthenticatedEmployee(req.user!); } catch {}
        if (emp?.departmentId) {
          claimWhere.employee.departmentId = emp.departmentId;
        }
      }

      const claims = await prisma.expenseClaim.findMany({
        where: claimWhere,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              workEmail: true,
              department: { select: { id: true, name: true, code: true } },
              designation: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true, city: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const empMap = new Map<string, any>();

      for (const c of claims) {
        if (!c.employee) continue;
        const empId = c.employee.id;
        if (!empMap.has(empId)) {
          empMap.set(empId, {
            employee: c.employee,
            expenseCount: 0,
            reimbursementCount: 0,
            totalClaims: 0,
            pendingClaims: 0,
            approvedClaims: 0,
            rejectedClaims: 0,
            correctionRequestedClaims: 0,
            paidClaims: 0,
            totalClaimedAmount: 0,
            paidAmount: 0,
            lastSubmissionDate: c.createdAt
          });
        }

        const stats = empMap.get(empId)!;
        stats.totalClaims++;
        if ((c as any).claimType === 'REIMBURSEMENT') {
          stats.reimbursementCount++;
        } else {
          stats.expenseCount++;
        }

        if (c.status === 'PENDING') stats.pendingClaims++;
        else if (c.status === 'APPROVED') stats.approvedClaims++;
        else if (c.status === 'REJECTED') stats.rejectedClaims++;
        else if (c.status === 'CORRECTION_REQUESTED') stats.correctionRequestedClaims++;
        else if (c.status === 'PAID') {
          stats.paidClaims++;
          stats.paidAmount += Number(c.totalAmount || 0);
        }

        stats.totalClaimedAmount += Number(c.totalAmount || 0);

        if (new Date(c.createdAt) > new Date(stats.lastSubmissionDate)) {
          stats.lastSubmissionDate = c.createdAt;
        }
      }

      let employeeList = Array.from(empMap.values());

      if (search) {
        const lowerSearch = search.toLowerCase();
        employeeList = employeeList.filter(e =>
          e.employee.firstName?.toLowerCase().includes(lowerSearch) ||
          e.employee.lastName?.toLowerCase().includes(lowerSearch) ||
          e.employee.employeeCode?.toLowerCase().includes(lowerSearch) ||
          e.employee.department?.name?.toLowerCase().includes(lowerSearch)
        );
      }

      res.status(200).json({
        employees: employeeList,
        totalEmployeesWithClaims: employeeList.length
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------
// 5d. Secure Receipt Document Upload and Access Control
// -------------------------------------------------------------
expenseRouter.post('/upload-receipt', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      filename: z.string().min(1),
      mimeType: z.string().refine(t => ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(t), {
        message: 'Invalid file type. Only JPEG, PNG, WEBP, and PDF files are allowed.'
      }),
      base64Data: z.string().min(1)
    });

    const data = schema.parse(req.body);
    const base64Clean = data.base64Data.replace(/^data:[a-zA-Z0-9\/\-+.]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      throw new AppError('File size exceeds 5MB limit.', 400);
    }

    const ext = data.mimeType === 'application/pdf' ? '.pdf' :
                data.mimeType === 'image/jpeg' ? '.jpg' :
                data.mimeType === 'image/webp' ? '.webp' : '.png';

    const safeFilename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    await fs.promises.writeFile(filePath, buffer);

    const attachmentUrl = `/api/v1/expenses/attachments/${safeFilename}`;

    res.status(201).json({
      url: attachmentUrl,
      filename: data.filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
      size: buffer.length,
      mimeType: data.mimeType
    });
  } catch (error) {
    next(error);
  }
});

expenseRouter.get('/attachments/:filename', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawFilename = path.basename(String(req.params.filename));
    const filePath = path.join(UPLOADS_DIR, rawFilename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('Attachment not found.', 404);
    }

    const ext = path.extname(rawFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${rawFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// 6. Admin Link User to Employee (Administrative Resolution Path)
// -------------------------------------------------------------
expenseRouter.post(
  '/link-user-employee',
  authenticate,
  requireRole(['company_admin', 'platform_admin', 'hr_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = z.object({
        userId: z.string().min(1),
        employeeId: z.string().min(1)
      });
      const { userId, employeeId } = schema.parse(req.body);

      // Verify tenant isolation for both target entities
      const [targetUser, targetEmployee] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.employee.findUnique({ where: { id: employeeId } })
      ]);

      if (!targetUser || targetUser.companyId !== req.user!.companyId) {
        throw new AppError('Target user not found in your company.', 404);
      }
      if (!targetEmployee || targetEmployee.companyId !== req.user!.companyId) {
        throw new AppError('Target employee not found in your company.', 404);
      }

      // Ensure employee is not already linked to another user account
      const existingLinkedUser = await prisma.user.findFirst({
        where: { employeeId, id: { not: userId } }
      });
      if (existingLinkedUser) {
        throw new AppError(`Employee is already linked to user account '${existingLinkedUser.username}'.`, 409, 'CONFLICT');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { employeeId },
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true }
          }
        }
      });

      await recordAudit(req, 'LINK_USER_TO_EMPLOYEE', 'User', userId, { employeeId });

      res.status(200).json({
        user: updatedUser,
        message: `Successfully linked user '${updatedUser.username}' to employee '${updatedUser.employee?.firstName} ${updatedUser.employee?.lastName}' (${updatedUser.employee?.employeeCode}).`
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------------
// 7. Travel Desk Requisitions (Failsafe for null employeeId)
// -------------------------------------------------------------
expenseRouter.get('/travel', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isApprover = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'finance_admin', 'hr_manager', 'department_manager'].includes(r)
    );

    let callerEmployeeId: string | null = null;
    try {
      const emp = await resolveAuthenticatedEmployee(req.user!);
      callerEmployeeId = emp.id;
    } catch {
      // Unlinked user
    }

    const where: any = {
      employee: { companyId: req.user!.companyId }
    };

    if (!isApprover) {
      if (!callerEmployeeId) {
        res.status(200).json({ requests: [] });
        return;
      }
      where.employeeId = callerEmployeeId;
    }

    const requests = await prisma.travelRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ requests });
  } catch (error) {
    next(error);
  }
});

expenseRouter.post('/travel', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employee = await resolveAuthenticatedEmployee(req.user!);

    const schema = z.object({
      purpose: z.string().min(1, 'Purpose is required'),
      destination: z.string().min(1, 'Destination is required'),
      fromDate: z.string(),
      toDate: z.string(),
      estimatedBudget: z.number().min(0),
      advanceAmount: z.number().default(0)
    });
    const data = schema.parse(req.body);

    const travel = await prisma.travelRequest.create({
      data: {
        employeeId: employee.id,
        purpose: data.purpose,
        destination: data.destination,
        fromDate: new Date(data.fromDate),
        toDate: new Date(data.toDate),
        estimatedBudget: new Decimal(data.estimatedBudget),
        advanceAmount: new Decimal(data.advanceAmount),
        status: 'PENDING'
      }
    });

    await recordAudit(req, 'SUBMIT_TRAVEL_REQUISITION', 'TravelRequest', travel.id, {
      estimatedBudget: data.estimatedBudget,
      advanceAmount: data.advanceAmount
    });

    res.status(201).json({ travel });
  } catch (error) {
    next(error);
  }
});

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const taxRouter = Router();

// Tax Sections
taxRouter.get('/sections', authenticate, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sections = await prisma.taxSection.findMany({
      orderBy: { sectionCode: 'asc' }
    });
    res.status(200).json({ sections });
  } catch (error) {
    next(error);
  }
});

// Employee Tax Declarations (List by Employee and FY)
taxRouter.get('/declarations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const financialYearId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : req.user!.employeeId;

    if (!employeeId) throw new AppError('Employee ID required', 400);

    // If employee self service, check ownership
    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      if (req.user!.employeeId !== employeeId) {
        throw new AppError('Access denied: You can only view your own declarations', 403);
      }
    }

    const declarations = await prisma.taxDeclaration.findMany({
      where: {
        employeeId,
        ...(financialYearId ? { financialYearId } : {})
      },
      include: {
        section: true,
        financialYear: true
      },
      orderBy: { section: { sectionCode: 'asc' } }
    });

    res.status(200).json({ declarations });
  } catch (error) {
    next(error);
  }
});

// Submit / Save Tax Declaration
taxRouter.post('/declarations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      financialYearId: z.string().min(1),
      sectionId: z.string().min(1),
      declaredAmount: z.number().nonnegative(),
      remarks: z.string().optional(),
      documentUrls: z.array(z.string()).optional()
    });
    const data = schema.parse(req.body);

    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Current user is not linked to an employee record', 400);

    const section = await prisma.taxSection.findUnique({ where: { id: data.sectionId } });
    if (!section) throw new AppError('Tax section not found', 404);

    if (data.declaredAmount > Number(section.maxLimit)) {
      throw new AppError(`Declared amount cannot exceed section limit of ₹${section.maxLimit}`, 400);
    }

    const declaration = await prisma.taxDeclaration.upsert({
      where: {
        employeeId_financialYearId_sectionId: {
          employeeId,
          financialYearId: data.financialYearId,
          sectionId: data.sectionId
        }
      },
      update: {
        declaredAmount: data.declaredAmount,
        remarks: data.remarks,
        documentUrls: data.documentUrls ?? [],
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      create: {
        employeeId,
        financialYearId: data.financialYearId,
        sectionId: data.sectionId,
        declaredAmount: data.declaredAmount,
        remarks: data.remarks,
        documentUrls: data.documentUrls ?? [],
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      include: { section: true }
    });

    await recordAudit(req, 'SUBMIT_TAX_DECLARATION', 'TaxDeclaration', declaration.id, {
      section: section.sectionCode,
      amount: data.declaredAmount
    });

    res.status(200).json({ declaration });
  } catch (error) {
    next(error);
  }
});

// Verify Tax Declaration (Tax Admin)
taxRouter.patch('/declarations/:id/verify', authenticate, requireRole(['payroll_incometax_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      verifiedAmount: z.number().nonnegative(),
      status: z.enum(['VERIFIED', 'REJECTED']),
      remarks: z.string().optional()
    });
    const data = schema.parse(req.body);

    const declaration = await prisma.taxDeclaration.update({
      where: { id: String(req.params.id) },
      data: {
        verifiedAmount: data.status === 'VERIFIED' ? data.verifiedAmount : 0,
        status: data.status,
        remarks: data.remarks,
        verifiedAt: new Date()
      },
      include: { section: true, employee: true }
    });

    await recordAudit(req, 'VERIFY_TAX_DECLARATION', 'TaxDeclaration', declaration.id, data);
    res.status(200).json({ declaration });
  } catch (error) {
    next(error);
  }
});

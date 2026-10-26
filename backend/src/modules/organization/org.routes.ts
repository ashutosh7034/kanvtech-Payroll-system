import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const orgRouter = Router();

// 1. Company Profile
orgRouter.get('/company', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId },
      include: {
        _count: {
          select: {
            branches: true,
            departments: true,
            designations: true,
            employees: true
          }
        }
      }
    });
    if (!company) throw new AppError('Company not found', 404);
    res.status(200).json({ company });
  } catch (error) {
    next(error);
  }
});

orgRouter.put('/company', authenticate, requireRole(['company_admin', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      brandName: z.string().optional(),
      legalName: z.string().min(1).optional(),
      cinNumber: z.string().optional(),
      gstin: z.string().optional(),
      panNumber: z.string().optional(),
      tanNumber: z.string().optional(),
      pfEstablishmentCode: z.string().optional(),
      esicCode: z.string().optional(),
      ptrcNumber: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      website: z.string().optional()
    });
    const data = schema.parse(req.body);

    const updated = await prisma.company.update({
      where: { id: req.user!.companyId },
      data
    });

    await recordAudit(req, 'UPDATE_COMPANY', 'Company', updated.id, data);
    res.status(200).json({ company: updated });
  } catch (error) {
    next(error);
  }
});

// 2. Branches
orgRouter.get('/branches', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branches = await prisma.branch.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { isHeadquarters: 'desc' }
    });
    res.status(200).json({ branches });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/branches', authenticate, requireRole(['company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      state: z.string().min(1),
      city: z.string().min(1),
      address: z.string().optional(),
      pinCode: z.string().optional(),
      isHeadquarters: z.boolean().default(false)
    });
    const data = schema.parse(req.body);

    const branch = await prisma.branch.create({
      data: {
        companyId: req.user!.companyId,
        ...data
      }
    });

    await recordAudit(req, 'CREATE_BRANCH', 'Branch', branch.id, data);
    res.status(201).json({ branch });
  } catch (error) {
    next(error);
  }
});

// 3. Departments
orgRouter.get('/departments', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { employees: true, jobOpenings: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ departments });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/departments', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const department = await prisma.department.create({
      data: {
        companyId: req.user!.companyId,
        ...data
      }
    });

    await recordAudit(req, 'CREATE_DEPARTMENT', 'Department', department.id, data);
    res.status(201).json({ department });
  } catch (error) {
    next(error);
  }
});

// 4. Designations
orgRouter.get('/designations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const designations = await prisma.designation.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ designations });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/designations', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const designation = await prisma.designation.create({
      data: {
        companyId: req.user!.companyId,
        ...data
      }
    });

    await recordAudit(req, 'CREATE_DESIGNATION', 'Designation', designation.id, data);
    res.status(201).json({ designation });
  } catch (error) {
    next(error);
  }
});

// 5. Job Bands
orgRouter.get('/job-bands', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobBands = await prisma.jobBand.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ jobBands });
  } catch (error) {
    next(error);
  }
});

// 6. Cost Centers
orgRouter.get('/cost-centers', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const costCenters = await prisma.costCenter.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ costCenters });
  } catch (error) {
    next(error);
  }
});

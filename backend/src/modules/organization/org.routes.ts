import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const orgRouter = Router();

// Get Institution & Settings
orgRouter.get('/institution', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.user!.institutionId },
      include: {
        settings: true
      }
    });
    res.status(200).json({ institution });
  } catch (error) {
    next(error);
  }
});

// Update Institution Branding & Settings
orgRouter.patch('/institution', authenticate, requireRole(['payroll_admin', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      brandName: z.string().optional(),
      logoUrl: z.string().optional(),
      contactEmail: z.string().email().optional(),
      settings: z.record(z.string()).optional()
    });

    const data = schema.parse(req.body);

    const institution = await prisma.institution.update({
      where: { id: req.user!.institutionId },
      data: {
        name: data.name,
        brandName: data.brandName,
        logoUrl: data.logoUrl,
        contactEmail: data.contactEmail
      }
    });

    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await prisma.institutionSetting.upsert({
          where: { institutionId_key: { institutionId: institution.id, key } },
          update: { value },
          create: { institutionId: institution.id, key, value }
        });
      }
    }

    await recordAudit(req, 'UPDATE_INSTITUTION', 'Institution', institution.id, data);
    res.status(200).json({ institution });
  } catch (error) {
    next(error);
  }
});

// OUs (Campuses/Faculties)
orgRouter.get('/ous', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ous = await prisma.organizationalUnit.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        departments: true,
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ ous });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/ous', authenticate, requireRole(['payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(['CAMPUS', 'FACULTY', 'DIRECTORATE', 'REGIONAL_CENTRE', 'COLLEGE']).default('FACULTY'),
      parentOuId: z.string().optional()
    });
    const data = schema.parse(req.body);

    const ou = await prisma.organizationalUnit.create({
      data: {
        institutionId: req.user!.institutionId,
        code: data.code,
        name: data.name,
        type: data.type,
        parentOuId: data.parentOuId
      }
    });

    await recordAudit(req, 'CREATE_OU', 'OrganizationalUnit', ou.id, data);
    res.status(201).json({ ou });
  } catch (error) {
    next(error);
  }
});

// Departments
orgRouter.get('/departments', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      where: { ou: { institutionId: req.user!.institutionId } },
      include: {
        ou: true,
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ departments });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/departments', authenticate, requireRole(['payroll_admin', 'payroll_ou_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      ouId: z.string().min(1),
      code: z.string().min(1),
      name: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const dept = await prisma.department.create({
      data: {
        ouId: data.ouId,
        code: data.code,
        name: data.name
      }
    });

    await recordAudit(req, 'CREATE_DEPARTMENT', 'Department', dept.id, data);
    res.status(201).json({ department: dept });
  } catch (error) {
    next(error);
  }
});

// Designations
orgRouter.get('/designations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const designations = await prisma.designation.findMany({
      where: { institutionId: req.user!.institutionId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ designations });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/designations', authenticate, requireRole(['payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      cadre: z.enum(['TEACHING', 'NON_TEACHING', 'ADMINISTRATIVE', 'TECHNICAL']).default('NON_TEACHING')
    });
    const data = schema.parse(req.body);

    const desig = await prisma.designation.create({
      data: {
        institutionId: req.user!.institutionId,
        code: data.code,
        name: data.name,
        cadre: data.cadre
      }
    });

    await recordAudit(req, 'CREATE_DESIGNATION', 'Designation', desig.id, data);
    res.status(201).json({ designation: desig });
  } catch (error) {
    next(error);
  }
});

// Employee Groups & Managed Payroll Groups
orgRouter.get('/employee-groups', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groups = await prisma.employeeGroup.findMany({
      where: { institutionId: req.user!.institutionId },
      include: { _count: { select: { employees: true } } }
    });
    res.status(200).json({ employeeGroups: groups });
  } catch (error) {
    next(error);
  }
});

orgRouter.get('/payroll-groups', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groups = await prisma.managedPayrollGroup.findMany({
      where: { institutionId: req.user!.institutionId },
      include: { _count: { select: { employees: true } } }
    });
    res.status(200).json({ payrollGroups: groups });
  } catch (error) {
    next(error);
  }
});

// Users and Role Mapping
orgRouter.get('/users', authenticate, requireRole(['payroll_admin', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { institutionId: req.user!.institutionId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: {
            role: true,
            ou: true
          }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { username: 'asc' }
    });
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

// Roles list
orgRouter.get('/roles', authenticate, async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ roles });
  } catch (error) {
    next(error);
  }
});

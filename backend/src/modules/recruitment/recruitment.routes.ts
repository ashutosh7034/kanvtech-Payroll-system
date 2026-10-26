import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const recruitmentRouter = Router();

// 1. Job Openings
recruitmentRouter.get('/openings', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const openings = await prisma.jobOpening.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        department: true,
        designation: true,
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ openings });
  } catch (error) {
    next(error);
  }
});

recruitmentRouter.post('/openings', authenticate, requireRole(['company_admin', 'hr_manager', 'recruiter']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      departmentId: z.string().min(1),
      designationId: z.string().min(1),
      title: z.string().min(1),
      openingsCount: z.number().default(1),
      minExperience: z.number().default(0),
      budgetMin: z.number().default(0),
      budgetMax: z.number().default(0),
      description: z.string().optional()
    });
    const data = schema.parse(req.body);

    const opening = await prisma.jobOpening.create({
      data: {
        companyId: req.user!.companyId,
        departmentId: data.departmentId,
        designationId: data.designationId,
        title: data.title,
        openingsCount: data.openingsCount,
        minExperience: data.minExperience,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        description: data.description
      }
    });

    await recordAudit(req, 'CREATE_JOB_OPENING', 'JobOpening', opening.id, { title: data.title });
    res.status(201).json({ opening });
  } catch (error) {
    next(error);
  }
});

// 2. Candidate Applications & Pipeline
recruitmentRouter.get('/applications', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobOpeningId = req.query.jobOpeningId ? String(req.query.jobOpeningId) : undefined;
    const stage = req.query.stage ? String(req.query.stage) : undefined;

    const applications = await prisma.jobApplication.findMany({
      where: {
        jobOpening: { companyId: req.user!.companyId },
        ...(jobOpeningId ? { jobOpeningId } : {}),
        ...(stage ? { stage: stage as any } : {})
      },
      include: {
        candidate: true,
        jobOpening: {
          include: { department: true, designation: true }
        },
        interviews: true,
        offer: true
      },
      orderBy: { appliedAt: 'desc' }
    });

    res.status(200).json({ applications });
  } catch (error) {
    next(error);
  }
});

// 3. Move Application Stage
recruitmentRouter.post('/applications/:id/stage', authenticate, requireRole(['company_admin', 'hr_manager', 'recruiter']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      stage: z.enum(['APPLIED', 'SHORTLISTED', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'OFFER_EXTENDED', 'HIRED', 'REJECTED']),
      notes: z.string().optional()
    });
    const { stage, notes } = schema.parse(req.body);

    const app = await prisma.jobApplication.findUnique({
      where: { id: String(req.params.id) },
      include: { candidate: true, jobOpening: true }
    });
    if (!app) throw new AppError('Application not found', 404);

    const updated = await prisma.jobApplication.update({
      where: { id: app.id },
      data: {
        stage: stage as any,
        notes: notes ?? app.notes
      }
    });

    res.status(200).json({ application: updated });
  } catch (error) {
    next(error);
  }
});

// 4. 1-Click Convert Hired Candidate to Employee
recruitmentRouter.post('/applications/:id/convert-to-employee', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeCode: z.string().min(1),
      workEmail: z.string().email(),
      branchId: z.string().min(1),
      dateOfJoining: z.string()
    });
    const data = schema.parse(req.body);

    const app = await prisma.jobApplication.findUnique({
      where: { id: String(req.params.id) },
      include: { candidate: true, jobOpening: true }
    });
    if (!app) throw new AppError('Application not found', 404);

    const names = app.candidate.fullName.trim().split(' ');
    const firstName = names[0] || 'Employee';
    const lastName = names.slice(1).join(' ') || 'Candidate';

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          companyId: req.user!.companyId,
          employeeCode: data.employeeCode,
          firstName,
          lastName,
          workEmail: data.workEmail,
          personalEmail: app.candidate.email,
          phone: app.candidate.phone,
          branchId: data.branchId,
          departmentId: app.jobOpening.departmentId,
          designationId: app.jobOpening.designationId,
          dateOfJoining: new Date(data.dateOfJoining),
          status: 'PROBATION'
        }
      });

      await tx.jobApplication.update({
        where: { id: app.id },
        data: { stage: 'HIRED' }
      });

      await tx.employmentTimeline.create({
        data: {
          employeeId: emp.id,
          eventType: 'JOINING',
          title: 'Hired via Apex ATS',
          description: `Converted from candidate application for ${app.jobOpening.title}`,
          effectiveDate: new Date(data.dateOfJoining),
          recordedBy: req.user!.fullName
        }
      });

      return emp;
    });

    res.status(201).json({
      message: 'Candidate successfully converted to employee',
      employee
    });
  } catch (error) {
    next(error);
  }
});

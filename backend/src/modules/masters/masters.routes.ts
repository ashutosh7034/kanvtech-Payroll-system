import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const mastersRouter = Router();

// Financial Years
mastersRouter.get('/financial-years', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const years = await prisma.financialYear.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        periods: { orderBy: { periodNumber: 'asc' } },
        _count: { select: { periods: true, payrollRuns: true } }
      },
      orderBy: { startsOn: 'desc' }
    });
    res.status(200).json({ financialYears: years });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post('/financial-years', authenticate, requireRole(['payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      startsOn: z.string(),
      endsOn: z.string(),
      activate: z.boolean().default(false)
    });
    const data = schema.parse(req.body);

    const starts = new Date(data.startsOn);
    const ends = new Date(data.endsOn);

    if (ends <= starts) {
      throw new AppError('End date must be after start date', 400);
    }

    if (data.activate) {
      // Deactivate all others
      await prisma.financialYear.updateMany({
        where: { institutionId: req.user!.institutionId },
        data: { active: false }
      });
    }

    const fy = await prisma.financialYear.create({
      data: {
        institutionId: req.user!.institutionId,
        name: data.name,
        startsOn: starts,
        endsOn: ends,
        active: data.activate
      }
    });

    // Auto-create 12 monthly periods
    const monthNames = [
      'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December', 'January', 'February', 'March'
    ];

    const startYear = starts.getFullYear();
    for (let i = 0; i < 12; i++) {
      const year = i < 9 ? startYear : startYear + 1;
      const calMonth = (i + 3) % 12;
      const periodStart = new Date(Date.UTC(year, calMonth, 1));
      const nextMonth = new Date(Date.UTC(year, calMonth + 1, 1));
      const periodEnd = new Date(nextMonth.getTime() - 1);
      const payDate = new Date(Date.UTC(year, calMonth + 1, 1));

      await prisma.payrollPeriod.create({
        data: {
          financialYearId: fy.id,
          periodNumber: i + 1,
          name: `${monthNames[i]} ${year}`,
          startDate: periodStart,
          endDate: periodEnd,
          payDate,
          status: 'OPEN'
        }
      });
    }

    await recordAudit(req, 'CREATE_FINANCIAL_YEAR', 'FinancialYear', fy.id, data);
    res.status(201).json({ financialYear: fy });
  } catch (error) {
    next(error);
  }
});

mastersRouter.get('/financial-years/:id/periods', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const periods = await prisma.payrollPeriod.findMany({
      where: { financialYearId: String(req.params.id) },
      include: {
        _count: { select: { payrollRuns: true } }
      },
      orderBy: { periodNumber: 'asc' }
    });
    res.status(200).json({ periods });
  } catch (error) {
    next(error);
  }
});

// Pay Matrix (Levels and Cells)
mastersRouter.get('/pay-matrix', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const levels = await prisma.payLevel.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        matrixCells: {
          orderBy: { indexNumber: 'asc' }
        }
      },
      orderBy: { levelNumber: 'asc' }
    });
    res.status(200).json({ levels });
  } catch (error) {
    next(error);
  }
});

// Salary Heads
mastersRouter.get('/salary-heads', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const heads = await prisma.salaryHead.findMany({
      where: { institutionId: req.user!.institutionId },
      orderBy: [{ type: 'asc' }, { code: 'asc' }]
    });
    res.status(200).json({ salaryHeads: heads });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post('/salary-heads', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1).toUpperCase(),
      name: z.string().min(1),
      type: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION']),
      calculationType: z.enum(['FIXED', 'PERCENTAGE_OF_HEAD', 'FORMULA']).default('FIXED'),
      formulaConfig: z.record(z.any()).optional(),
      isTaxable: z.boolean().default(true),
      isLeaveImpacted: z.boolean().default(true)
    });
    const data = schema.parse(req.body);

    const head = await prisma.salaryHead.create({
      data: {
        institutionId: req.user!.institutionId,
        code: data.code,
        name: data.name,
        type: data.type,
        calculationType: data.calculationType,
        formulaConfig: data.formulaConfig ?? {},
        isTaxable: data.isTaxable,
        isLeaveImpacted: data.isLeaveImpacted
      }
    });

    await recordAudit(req, 'CREATE_SALARY_HEAD', 'SalaryHead', head.id, data);
    res.status(201).json({ salaryHead: head });
  } catch (error) {
    next(error);
  }
});

// Salary Structures
mastersRouter.get('/salary-structures', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const structures = await prisma.salaryStructure.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        lines: {
          include: { salaryHead: true },
          orderBy: { displayOrder: 'asc' }
        },
        _count: { select: { assignments: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ salaryStructures: structures });
  } catch (error) {
    next(error);
  }
});

mastersRouter.post('/salary-structures', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      employmentType: z.enum(['PERMANENT', 'CONTRACTUAL', 'ADHOC', 'TEMPORARY']).default('PERMANENT'),
      lines: z.array(z.object({
        salaryHeadId: z.string(),
        calculationType: z.enum(['FIXED', 'PERCENTAGE_OF_HEAD', 'FORMULA']),
        baseHeadCode: z.string().optional(),
        percentage: z.number().optional(),
        fixedAmount: z.number().optional(),
        displayOrder: z.number().default(0)
      })).min(1, 'At least one salary component is required')
    });
    const data = schema.parse(req.body);

    const structure = await prisma.salaryStructure.create({
      data: {
        institutionId: req.user!.institutionId,
        code: data.code,
        name: data.name,
        employmentType: data.employmentType,
        lines: {
          create: data.lines.map(line => ({
            salaryHeadId: line.salaryHeadId,
            calculationType: line.calculationType,
            baseHeadCode: line.baseHeadCode,
            percentage: line.percentage !== undefined ? line.percentage : null,
            fixedAmount: line.fixedAmount !== undefined ? line.fixedAmount : null,
            displayOrder: line.displayOrder
          }))
        }
      },
      include: {
        lines: { include: { salaryHead: true } }
      }
    });

    await recordAudit(req, 'CREATE_SALARY_STRUCTURE', 'SalaryStructure', structure.id, { code: data.code });
    res.status(201).json({ salaryStructure: structure });
  } catch (error) {
    next(error);
  }
});

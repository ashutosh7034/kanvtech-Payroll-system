import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { authenticate, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const reportRouter = Router();

// Dashboard Executive Metrics (Administrator & Payroll Officers)
reportRouter.get('/dashboard-metrics', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const institutionId = req.user!.institutionId;

    const [
      activeFy,
      totalEmployees,
      runsByStatus,
      activeLoans,
      pendingDeclarations,
      recentAuditLogs
    ] = await Promise.all([
      prisma.financialYear.findFirst({
        where: { institutionId, active: true },
        include: { periods: { orderBy: { periodNumber: 'asc' } } }
      }),
      prisma.employee.count({ where: { institutionId, active: true } }),
      prisma.payrollRun.groupBy({
        by: ['status'],
        where: { institutionId },
        _count: { id: true }
      }),
      prisma.employeeLoan.count({
        where: { employee: { institutionId }, status: 'ACTIVE' }
      }),
      prisma.taxDeclaration.count({
        where: { employee: { institutionId }, status: 'SUBMITTED' }
      }),
      prisma.auditLog.findMany({
        where: { institutionId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const runStatusMap: Record<string, number> = {};
    runsByStatus.forEach(r => {
      runStatusMap[r.status] = r._count.id;
    });

    res.status(200).json({
      metrics: {
        activeFinancialYear: activeFy?.name ?? 'Not Set',
        totalPeriods: activeFy?.periods.length ?? 0,
        totalActiveEmployees: totalEmployees,
        payrollRuns: {
          generated: runStatusMap['GENERATED'] ?? 0,
          verified: runStatusMap['VERIFIED'] ?? 0,
          finalized: runStatusMap['FINALIZED'] ?? 0,
          approved: runStatusMap['APPROVED'] ?? 0
        },
        activeLoansCount: activeLoans,
        pendingTaxDeclarations: pendingDeclarations,
        recentAudits: recentAuditLogs
      }
    });
  } catch (error) {
    next(error);
  }
});

// Salary Head Wise Summary Report for a Period
reportRouter.get('/head-summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const periodId = req.query.periodId ? String(req.query.periodId) : undefined;
    if (!periodId) throw new AppError('Period ID is required', 400);

    const run = await prisma.payrollRun.findFirst({
      where: {
        institutionId: req.user!.institutionId,
        periodId,
        status: { in: ['GENERATED', 'VERIFIED', 'FINALIZED', 'APPROVED'] }
      },
      include: {
        records: {
          include: { lines: true }
        },
        period: true
      }
    });

    if (!run) {
      res.status(200).json({ summary: [], totalGross: 0, totalNet: 0 });
      return;
    }

    const headMap = new Map<string, { headCode: string; headName: string; headType: string; totalAmount: number; count: number }>();

    for (const rec of run.records) {
      for (const line of rec.lines) {
        const existing = headMap.get(line.headCode) ?? {
          headCode: line.headCode,
          headName: line.headName,
          headType: line.headType,
          totalAmount: 0,
          count: 0
        };
        existing.totalAmount += Number(line.amount);
        existing.count += 1;
        headMap.set(line.headCode, existing);
      }
    }

    const headSummary = Array.from(headMap.values()).map(h => ({
      ...h,
      totalAmount: Math.round(h.totalAmount * 100) / 100
    }));

    await recordAudit(req, 'VIEW_REPORT', 'Report', null, { type: 'HEAD_SUMMARY', period: run.period.name });

    res.status(200).json({
      periodName: run.period.name,
      runStatus: run.status,
      totalEmployees: run.records.length,
      grossTotal: Number(run.grossTotal),
      netTotal: Number(run.netTotal),
      headSummary
    });
  } catch (error) {
    next(error);
  }
});

// Department Wise Salary Report
reportRouter.get('/department-summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const periodId = req.query.periodId ? String(req.query.periodId) : undefined;
    if (!periodId) throw new AppError('Period ID is required', 400);

    const records = await prisma.payrollRecord.findMany({
      where: {
        payrollRun: {
          institutionId: req.user!.institutionId,
          periodId
        }
      },
      include: {
        employee: {
          include: { department: true, ou: true }
        }
      }
    });

    const deptMap = new Map<string, { departmentName: string; ouName: string; employeeCount: number; grossTotal: number; netTotal: number }>();

    for (const r of records) {
      const deptName = r.employee.department.name;
      const ouName = r.employee.ou.name;
      const existing = deptMap.get(deptName) ?? {
        departmentName: deptName,
        ouName,
        employeeCount: 0,
        grossTotal: 0,
        netTotal: 0
      };
      existing.employeeCount += 1;
      existing.grossTotal += Number(r.grossAmount);
      existing.netTotal += Number(r.netAmount);
      deptMap.set(deptName, existing);
    }

    const departmentSummary = Array.from(deptMap.values()).map(d => ({
      ...d,
      grossTotal: Math.round(d.grossTotal * 100) / 100,
      netTotal: Math.round(d.netTotal * 100) / 100
    }));

    res.status(200).json({ departmentSummary });
  } catch (error) {
    next(error);
  }
});

// Audit Logs Catalog
reportRouter.get('/audit-logs', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Number(req.query.pageSize ?? 30));
    const action = req.query.action ? String(req.query.action) : undefined;

    const where: any = {
      institutionId: req.user!.institutionId,
      ...(action ? { action } : {})
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { username: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    res.status(200).json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

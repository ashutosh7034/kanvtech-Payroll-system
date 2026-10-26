import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const corporateReportRouter = Router();

// 1. Executive HR & Payroll Dashboard Metrics
corporateReportRouter.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const [
      totalEmployees,
      departmentStats,
      activeOpenings,
      recentPayrollRun,
      openTickets
    ] = await Promise.all([
      prisma.employee.count({ where: { companyId, status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] } } }),
      prisma.department.findMany({
        where: { companyId },
        select: {
          name: true,
          _count: { select: { employees: true } }
        }
      }),
      prisma.jobOpening.count({ where: { companyId, status: 'OPEN' } }),
      prisma.corporatePayrollRun.findFirst({
        where: { companyId },
        include: {
          period: true,
          slips: {
            include: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.helpDeskTicket.count({ where: { employee: { companyId }, status: 'OPEN' } })
    ]);

    let statutorySummary = null;
    if (recentPayrollRun) {
      let epfEmployee = 0;
      let epfEmployer = 0;
      let esiEmployee = 0;
      let esiEmployer = 0;
      let professionalTax = 0;
      let tds = 0;
      let gratuity = 0;

      for (const slip of recentPayrollRun.slips) {
        for (const item of slip.items) {
          const amt = Number(item.amount);
          if (item.code === 'EPF_EMPLOYEE') epfEmployee += amt;
          else if (item.code === 'EPF_EMPLOYER') epfEmployer += amt;
          else if (item.code === 'ESIC_EMPLOYEE') esiEmployee += amt;
          else if (item.code === 'ESIC_EMPLOYER') esiEmployer += amt;
          else if (item.code === 'PROFESSIONAL_TAX') professionalTax += amt;
          else if (item.code === 'TDS') tds += amt;
          else if (item.code === 'GRATUITY') gratuity += amt;
        }
      }

      statutorySummary = {
        period: recentPayrollRun.period.name,
        runNumber: recentPayrollRun.runNumber,
        epfEmployee,
        epfEmployer,
        epfTotalChallan: epfEmployee + epfEmployer,
        esiEmployee,
        esiEmployer,
        esiTotalChallan: esiEmployee + esiEmployer,
        professionalTax,
        tds,
        gratuity,
        totalStatutoryRemittance: epfEmployee + epfEmployer + esiEmployee + esiEmployer + professionalTax + tds
      };
    }

    res.status(200).json({
      metrics: {
        totalEmployees,
        activeOpenings,
        openTickets,
        departmentDistribution: departmentStats.map(d => ({ department: d.name, count: d._count.employees })),
        latestPayroll: recentPayrollRun ? {
          id: recentPayrollRun.id,
          period: recentPayrollRun.period.name,
          runNumber: recentPayrollRun.runNumber,
          status: recentPayrollRun.status,
          totalGross: Number(recentPayrollRun.totalGross),
          totalDeductions: Number(recentPayrollRun.totalDeductions),
          totalNetPay: Number(recentPayrollRun.totalNetPay),
          totalEmployerCost: Number(recentPayrollRun.totalEmployerCost),
          totalEmployees: recentPayrollRun.totalEmployees,
          paymentReference: recentPayrollRun.paymentReference
        } : null,
        statutorySummary
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. Monthly Payroll Register
corporateReportRouter.get(
  '/payroll-register',
  authenticate,
  requireRole(['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const where: any = { companyId: req.user!.companyId };
      if (runId) where.id = runId;

      const run = await prisma.corporatePayrollRun.findFirst({
        where,
        include: {
          period: true,
          slips: {
            include: {
              employee: {
                include: { department: true, designation: true, branch: true }
              },
              items: true
            },
            orderBy: { employee: { employeeCode: 'asc' } }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!run) {
        res.status(200).json({ register: [] });
        return;
      }

      const register = run.slips.map(s => {
        const itemMap = new Map(s.items.map(i => [i.code, Number(i.amount)]));
        return {
          id: s.id,
          employeeCode: s.employee.employeeCode,
          name: `${s.employee.firstName} ${s.employee.lastName}`,
          employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
          department: s.employee.department.name,
          designation: s.employee.designation.name,
          branch: s.employee.branch.name,
          workingDays: s.workingDays,
          paidDays: Number(s.payableDays),
          payableDays: Number(s.payableDays),
          lopDays: Number(s.lopDays),
          unpaidDays: Number(s.unpaidDays),
          basic: itemMap.get('BASIC') || 0,
          hra: itemMap.get('HRA') || 0,
          specialAllowance: itemMap.get('SPECIAL_ALLOWANCE') || 0,
          conveyance: itemMap.get('CONVEYANCE') || 0,
          medical: itemMap.get('MEDICAL') || 0,
          grossPay: Number(s.grossPay),
          grossEarnings: Number(s.grossPay),
          epfEmployee: itemMap.get('EPF_EMPLOYEE') || 0,
          esiEmployee: itemMap.get('ESIC_EMPLOYEE') || 0,
          professionalTax: itemMap.get('PROFESSIONAL_TAX') || 0,
          tds: itemMap.get('TDS') || 0,
          loanEmi: itemMap.get('LOAN_EMI') || 0,
          deductionsPay: Number(s.deductionsPay),
          totalDeductions: Number(s.deductionsPay),
          netPay: Number(s.netPay),
          netSalary: Number(s.netPay),
          employerPf: itemMap.get('EPF_EMPLOYER') || 0,
          employerEsi: itemMap.get('ESIC_EMPLOYER') || 0,
          gratuity: itemMap.get('GRATUITY') || 0,
          employerCost: Number(s.employerCost),
          bankName: s.employee.bankName,
          bankAccount: s.employee.bankAccountNumber,
          ifscCode: s.employee.ifscCode
        };
      });

      res.status(200).json({
        period: run.period.name,
        runNumber: run.runNumber,
        status: run.status,
        totals: {
          totalGross: Number(run.totalGross),
          totalDeductions: Number(run.totalDeductions),
          totalNet: Number(run.totalNetPay),
          totalEmployerCost: Number(run.totalEmployerCost),
          employeeCount: run.slips.length
        },
        register
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. Bank Advice Export Data (NEFT instruction format)
corporateReportRouter.get(
  '/bank-advice',
  authenticate,
  requireRole(['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const where: any = { companyId: req.user!.companyId };
      if (runId) where.id = runId;

      const run = await prisma.corporatePayrollRun.findFirst({
        where,
        include: {
          period: true,
          slips: {
            include: {
              employee: true
            },
            orderBy: { employee: { employeeCode: 'asc' } }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!run) {
        res.status(200).json({ bankAdvice: [], totalDisbursement: 0 });
        return;
      }

      const bankAdvice = run.slips.map((s, idx) => ({
        srNo: idx + 1,
        employeeCode: s.employee.employeeCode,
        employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
        beneficiaryName: `${s.employee.firstName} ${s.employee.lastName}`,
        accountNumber: s.employee.bankAccountNumber ?? 'N/A',
        bankName: s.employee.bankName ?? 'N/A',
        ifscCode: s.employee.ifscCode ?? 'N/A',
        amount: Number(s.netPay),
        netPay: Number(s.netPay),
        paymentMethod: 'NEFT',
        narration: `Salary for ${run.period.name}`
      }));

      const totalDisbursement = bankAdvice.reduce((sum, item) => sum + item.netPay, 0);

      res.status(200).json({
        runId: run.id,
        runNumber: run.runNumber,
        period: run.period?.name,
        totalDisbursement,
        bankAdvice
      });
    } catch (error) {
      next(error);
    }
  }
);

// 4. Statutory Compliance Breakdown (EPFO, ESIC, PT, TDS)
corporateReportRouter.get(
  '/statutory-compliance',
  authenticate,
  requireRole(['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const where: any = { companyId: req.user!.companyId };
      if (runId) where.id = runId;

      const run = await prisma.corporatePayrollRun.findFirst({
        where,
        include: {
          period: true,
          slips: {
            include: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!run) {
        res.status(200).json({ complianceSummary: null });
        return;
      }

      let epfEmployee = 0;
      let epfEmployer = 0;
      let esiEmployee = 0;
      let esiEmployer = 0;
      let professionalTax = 0;
      let tds = 0;
      let gratuity = 0;

      for (const slip of run.slips) {
        for (const item of slip.items) {
          const amt = Number(item.amount);
          if (item.code === 'EPF_EMPLOYEE') epfEmployee += amt;
          else if (item.code === 'EPF_EMPLOYER') epfEmployer += amt;
          else if (item.code === 'ESIC_EMPLOYEE') esiEmployee += amt;
          else if (item.code === 'ESIC_EMPLOYER') esiEmployer += amt;
          else if (item.code === 'PROFESSIONAL_TAX') professionalTax += amt;
          else if (item.code === 'TDS') tds += amt;
          else if (item.code === 'GRATUITY') gratuity += amt;
        }
      }

      res.status(200).json({
        complianceSummary: {
          period: run.period.name,
          runNumber: run.runNumber,
          epfSummary: {
            totalEmployeePf: epfEmployee,
            totalEmployerPf: epfEmployer,
            totalEpfChallan: epfEmployee + epfEmployer
          },
          ptSummary: {
            totalPt: professionalTax
          },
          esiSummary: {
            totalEmployeeEsi: esiEmployee,
            totalEmployerEsi: esiEmployer,
            totalEsiChallan: esiEmployee + esiEmployer
          },
          tdsSummary: {
            totalTds: tds
          },
          gratuitySummary: {
            totalGratuity: gratuity
          },
          totalStatutoryRemittance: epfEmployee + epfEmployer + esiEmployee + esiEmployer + professionalTax + tds
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// 5. Payroll Variance Report (Comparing two runs or consecutive periods)
corporateReportRouter.get(
  '/variance',
  authenticate,
  requireRole(['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { runId, priorRunId } = req.query;
      const companyId = req.user!.companyId;

      const currentRun = await prisma.corporatePayrollRun.findFirst({
        where: runId ? { id: String(runId), companyId } : { companyId },
        include: { period: true, slips: { include: { items: true, employee: true } } },
        orderBy: { createdAt: 'desc' }
      });

      if (!currentRun) {
        res.status(200).json({ variance: null });
        return;
      }

      const priorRun = await prisma.corporatePayrollRun.findFirst({
        where: priorRunId
          ? { id: String(priorRunId), companyId }
          : { companyId, id: { not: currentRun.id }, status: { in: ['PAID', 'APPROVED', 'REVIEWED'] } },
        include: { period: true, slips: { include: { items: true, employee: true } } },
        orderBy: { createdAt: 'desc' }
      });

      const currentGross = Number(currentRun.totalGross);
      const priorGross = priorRun ? Number(priorRun.totalGross) : 0;
      const grossDelta = currentGross - priorGross;

      const currentNet = Number(currentRun.totalNetPay);
      const priorNet = priorRun ? Number(priorRun.totalNetPay) : 0;
      const netDelta = currentNet - priorNet;

      const currentCount = currentRun.totalEmployees;
      const priorCount = priorRun ? priorRun.totalEmployees : 0;
      const countDelta = currentCount - priorCount;

      res.status(200).json({
        variance: {
          current: {
            runId: currentRun.id,
            runNumber: currentRun.runNumber,
            period: currentRun.period.name,
            totalGross: currentGross,
            totalNet: currentNet,
            totalEmployees: currentCount
          },
          prior: priorRun ? {
            runId: priorRun.id,
            runNumber: priorRun.runNumber,
            period: priorRun.period.name,
            totalGross: priorGross,
            totalNet: priorNet,
            totalEmployees: priorCount
          } : null,
          deltas: {
            grossDelta,
            grossDeltaPct: priorGross > 0 ? ((grossDelta / priorGross) * 100).toFixed(2) + '%' : '100%',
            netDelta,
            netDeltaPct: priorNet > 0 ? ((netDelta / priorNet) * 100).toFixed(2) + '%' : '100%',
            countDelta
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

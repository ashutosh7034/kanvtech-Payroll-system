import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const offboardingRouter = Router();

// 1. List Resignations
offboardingRouter.get('/resignations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isHr = req.user!.roles.includes('hr_manager') || req.user!.roles.includes('company_admin');
    const where: any = {
      employee: { companyId: req.user!.companyId }
    };
    if (!isHr) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const resignations = await prisma.resignation.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true, designation: true, dateOfJoining: true }
        },
        fnfSettlement: true
      },
      orderBy: { submittedAt: 'desc' }
    });

    res.status(200).json({ resignations });
  } catch (error) {
    next(error);
  }
});

// 2. Submit Resignation
offboardingRouter.post('/resignations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee ID required', 400);

    const schema = z.object({
      requestedLwd: z.string(),
      reason: z.string().min(1)
    });
    const data = schema.parse(req.body);

    const resignation = await prisma.$transaction(async (tx) => {
      const r = await tx.resignation.create({
        data: {
          employeeId,
          requestedLwd: new Date(data.requestedLwd),
          reason: data.reason,
          status: 'PENDING'
        }
      });

      await tx.employee.update({
        where: { id: employeeId },
        data: { status: 'NOTICE_PERIOD' }
      });

      await tx.employmentTimeline.create({
        data: {
          employeeId,
          eventType: 'RESIGNATION',
          title: 'Resignation Submitted',
          description: `Requested LWD: ${data.requestedLwd}. Reason: ${data.reason}`,
          effectiveDate: new Date(),
          recordedBy: req.user!.fullName
        }
      });

      return r;
    });

    res.status(201).json({ resignation });
  } catch (error) {
    next(error);
  }
});

// 3. Calculate & Generate Full-and-Final (F&F) Settlement
offboardingRouter.post('/settlement/calculate', authenticate, requireRole(['hr_manager', 'finance_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      resignationId: z.string().min(1),
      agreedLwd: z.string(),
      noticeShortfallDays: z.number().default(0)
    });
    const { resignationId, agreedLwd, noticeShortfallDays } = schema.parse(req.body);

    const resignation = await prisma.resignation.findUnique({
      where: { id: resignationId },
      include: {
        employee: {
          include: {
            salaryStructure: {
              include: { lines: { include: { component: true } } }
            },
            leaveBalances: {
              include: { leavePolicy: true }
            },
            loans: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    if (!resignation) throw new AppError('Resignation record not found', 404);

    const emp = resignation.employee;
    const lwd = new Date(agreedLwd);

    // Basic & Gross from salary structure
    const basicLine = emp.salaryStructure?.lines.find(l => l.component.code === 'BASIC');
    const basicPay = new Decimal(basicLine?.monthlyAmount ?? 50000);
    const monthlyGross = new Decimal(emp.salaryStructure?.monthlyGross ?? 100000);

    // 1. Leave Encashment: (Basic / 30) * Privilege Leave Balance
    const plBal = emp.leaveBalances.find(b => b.leavePolicy.code === 'PL');
    const plDays = new Decimal(plBal?.balance ?? 0);
    const leaveEncashment = plDays.greaterThan(0)
      ? basicPay.dividedBy(30).times(plDays).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    // 2. Gratuity: (15 * Basic * Completed Years) / 26 if >= 5 years
    const serviceYears = Math.floor((lwd.getTime() - new Date(emp.dateOfJoining).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    let gratuityAmount = new Decimal(0);
    if (serviceYears >= 5) {
      gratuityAmount = basicPay.times(15).times(serviceYears).dividedBy(26).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    // 3. Notice Pay Shortfall Recovery: (Gross / 30) * shortfallDays
    const noticeRecovery = noticeShortfallDays > 0
      ? monthlyGross.dividedBy(30).times(noticeShortfallDays).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    // 4. Active Loan dues
    let loanRecoveryDues = new Decimal(0);
    for (const loan of emp.loans) {
      loanRecoveryDues = loanRecoveryDues.plus(new Decimal(loan.outstandingAmount));
    }

    // 5. Salary due for current month
    const daysWorkedInExitMonth = lwd.getDate();
    const salaryDue = monthlyGross.dividedBy(30).times(daysWorkedInExitMonth).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Net Payable: Salary Due + Leave Encashment + Gratuity - Notice Recovery - Loan Dues
    const netSettlementPay = salaryDue
      .plus(leaveEncashment)
      .plus(gratuityAmount)
      .minus(noticeRecovery)
      .minus(loanRecoveryDues)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const settlement = await prisma.$transaction(async (tx) => {
      await tx.resignation.update({
        where: { id: resignation.id },
        data: {
          agreedLwd: lwd,
          status: 'APPROVED',
          approvedBy: req.user!.fullName,
          actionedAt: new Date()
        }
      });

      await tx.employee.update({
        where: { id: emp.id },
        data: {
          status: 'EXITED',
          exitDate: lwd
        }
      });

      const fnf = await tx.fnfSettlement.upsert({
        where: { resignationId: resignation.id },
        update: {
          lastWorkingDay: lwd,
          noticeShortfallDays,
          noticeRecovery,
          leaveEncashment,
          gratuityAmount,
          salaryDue,
          loanRecoveryDues,
          netSettlementPay,
          status: 'APPROVED'
        },
        create: {
          employeeId: emp.id,
          resignationId: resignation.id,
          lastWorkingDay: lwd,
          noticeShortfallDays,
          noticeRecovery,
          leaveEncashment,
          gratuityAmount,
          salaryDue,
          loanRecoveryDues,
          netSettlementPay,
          status: 'APPROVED'
        }
      });

      await tx.employmentTimeline.create({
        data: {
          employeeId: emp.id,
          eventType: 'EXIT',
          title: 'Full & Final Settlement Approved',
          description: `Relieved on ${agreedLwd}. Net Settlement Payable: ₹${netSettlementPay.toFixed(2)}`,
          effectiveDate: lwd,
          recordedBy: req.user!.fullName
        }
      });

      return fnf;
    });

    res.status(200).json({
      message: 'Full and final settlement computed and approved',
      settlement
    });
  } catch (error) {
    next(error);
  }
});

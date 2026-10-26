import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PayrollCalculationEngine } from './calculationEngine.js';
import { calculateIncomeTax } from '../tax/taxEngine.js';

export const corporatePayrollRouter = Router();

// ==========================================
// 1. PERIODS & RUNS LISTING
// ==========================================

// 1.1 List Payroll Periods
corporatePayrollRouter.get('/periods', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const periods = await prisma.payrollPeriod.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        _count: { select: { runs: true } }
      },
      orderBy: { periodNumber: 'asc' }
    });
    res.status(200).json({ periods });
  } catch (error) {
    next(error);
  }
});

// 1.1b Create New Month / Payroll Period (Saral PayPack Parity)
corporatePayrollRouter.post('/periods', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2000).max(2100),
      name: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const companyId = req.user!.companyId;

    // Check if period already exists
    const existing = await prisma.payrollPeriod.findUnique({
      where: {
        companyId_month_year: {
          companyId,
          month: parsed.month,
          year: parsed.year
        }
      }
    });
    if (existing) {
      throw new AppError(`Payroll period for ${parsed.month}/${parsed.year} already exists (${existing.name}).`, 400);
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const periodName = parsed.name || `${monthNames[parsed.month - 1]} ${parsed.year}`;

    // Calculate dates if not provided
    const startDate = parsed.startDate ? new Date(parsed.startDate) : new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
    const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
    const endDate = parsed.endDate ? new Date(parsed.endDate) : new Date(Date.UTC(parsed.year, parsed.month - 1, lastDay, 23, 59, 59));
    const cutoffDate = endDate;

    const count = await prisma.payrollPeriod.count({ where: { companyId } });

    const period = await prisma.payrollPeriod.create({
      data: {
        companyId,
        periodNumber: count + 1,
        name: periodName,
        month: parsed.month,
        year: parsed.year,
        startDate,
        endDate,
        cutoffDate,
        isLocked: false
      }
    });

    await recordAudit(req, 'CREATE_PAYROLL_PERIOD', 'PayrollPeriod', period.id, {
      name: periodName,
      month: parsed.month,
      year: parsed.year
    });

    res.status(201).json({ period });
  } catch (error) {
    next(error);
  }
});

// 1.2 List Payroll Runs
corporatePayrollRouter.get('/runs', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runs = await prisma.corporatePayrollRun.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        period: true,
        _count: { select: { slips: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ runs });
  } catch (error) {
    next(error);
  }
});

// 1.3 Single Run Details with Slips, Transitions, and Notes
corporatePayrollRouter.get('/runs/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        period: true,
        transitions: { orderBy: { timestamp: 'asc' } },
        slips: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
                designation: { select: { name: true } },
                branch: { select: { name: true } },
                panNumber: true,
                bankAccountNumber: true,
                bankName: true,
                ifscCode: true
              }
            },
            items: true
          },
          orderBy: { employee: { employeeCode: 'asc' } }
        }
      }
    });
    if (!run) throw new AppError('Payroll run not found', 404);
    res.status(200).json({ run });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. 7-STAGE PAYROLL WORKFLOW ENGINE
// ==========================================

// STAGE 1: DRAFT (Initialize Scope)
corporatePayrollRouter.post('/runs/draft', authenticate, requireRole(['payroll_admin', 'payroll_processor', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      periodId: z.string().min(1),
      branchId: z.string().optional()
    });
    const { periodId } = schema.parse(req.body);

    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError('Payroll period not found', 404);

    const existingRun = await prisma.corporatePayrollRun.findFirst({
      where: { companyId: req.user!.companyId, periodId }
    });

    if (existingRun && existingRun.status !== 'DRAFT' && existingRun.status !== 'VALIDATED') {
      throw new AppError(`Payroll for ${period.name} is already ${existingRun.status} and locked from re-drafting.`, 400);
    }

    const runNumber = `RUN-${period.year}-${String(period.month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    const run = await prisma.$transaction(async (tx) => {
      if (existingRun && (existingRun.status === 'DRAFT' || existingRun.status === 'VALIDATED')) {
        await tx.corporatePayrollRun.delete({ where: { id: existingRun.id } });
      }

      const eligibleCount = await tx.employee.count({
        where: {
          companyId: req.user!.companyId,
          status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
          dateOfJoining: { lte: period.endDate },
          OR: [
            { exitDate: null },
            { exitDate: { gte: period.startDate } }
          ]
        }
      });

      const newRun = await tx.corporatePayrollRun.create({
        data: {
          companyId: req.user!.companyId,
          periodId: period.id,
          runNumber,
          status: 'DRAFT',
          totalEmployees: eligibleCount
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: newRun.id,
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Initialized payroll batch for ${period.name} (${eligibleCount} eligible employees)`
        }
      });

      return newRun;
    });

    await recordAudit(req, 'INIT_PAYROLL_DRAFT', 'CorporatePayrollRun', run.id, { period: period.name });
    res.status(201).json({ run });
  } catch (error) {
    next(error);
  }
});

// STAGE 2: VALIDATE (Verify Attendance, Leave LOP, Policies & Exceptions)
corporatePayrollRouter.post('/runs/:id/validate', authenticate, requireRole(['payroll_admin', 'payroll_processor', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: { period: true }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status === 'PAID' || run.status === 'APPROVED') {
      throw new AppError(`Cannot re-validate a ${run.status} payroll run.`, 400);
    }

    // Inspect all active employees for potential issues
    const employees = await prisma.employee.findMany({
      where: {
        companyId: req.user!.companyId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
        dateOfJoining: { lte: run.period.endDate },
        OR: [
          { exitDate: null },
          { exitDate: { gte: run.period.startDate } }
        ]
      },
      include: {
        salaryStructure: true,
        payrollPolicy: true,
        department: true,
        branch: true
      }
    });

    const validationExceptions: Array<{ employeeCode: string; name: string; issue: string; severity: 'CRITICAL' | 'WARNING' }> = [];
    let eligibleCount = 0;

    for (const emp of employees) {
      if (!emp.salaryStructure) {
        validationExceptions.push({
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          issue: 'Missing active salary structure (CTC)',
          severity: 'CRITICAL'
        });
      } else {
        eligibleCount++;
      }

      if (!emp.payrollPolicy) {
        validationExceptions.push({
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          issue: 'Payroll policy unset (default statutory policy will be applied)',
          severity: 'WARNING'
        });
      } else if (emp.payrollPolicy.pfStatus === 'PENDING_VERIFICATION') {
        validationExceptions.push({
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          issue: 'PF status is PENDING_VERIFICATION. Compliance review required.',
          severity: 'WARNING'
        });
      }

      // Check for mid-month joining
      if (emp.dateOfJoining > run.period.startDate && emp.dateOfJoining <= run.period.endDate) {
        validationExceptions.push({
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          issue: `Joined mid-month on ${emp.dateOfJoining.toISOString().split('T')[0]}. Salary will be prorated.`,
          severity: 'WARNING'
        });
      }
    }

    const validationNotes = {
      totalEmployeesScanned: employees.length,
      eligibleEmployees: eligibleCount,
      exceptionCount: validationExceptions.length,
      exceptions: validationExceptions,
      validatedById: req.user!.userId,
      validatedAt: new Date().toISOString()
    };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'VALIDATED',
          totalEmployees: eligibleCount,
          validationNotes,
          validatedBy: req.user!.fullName,
          validatedAt: new Date()
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'VALIDATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Validated inputs for ${eligibleCount} employees with ${validationExceptions.length} audit notes`
        }
      });

      return u;
    });

    res.status(200).json({ run: updated, validationNotes });
  } catch (error) {
    next(error);
  }
});

// STAGE 3: CALCULATE (Execute Pure Decimal Payroll Math)
corporatePayrollRouter.post('/runs/:id/calculate', authenticate, requireRole(['payroll_admin', 'payroll_processor', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: { period: true }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status === 'PAID' || run.status === 'APPROVED') {
      throw new AppError(`Cannot re-calculate an ${run.status} payroll run.`, 400);
    }

    // Fetch employees with salary structure, policies, and active loans
    const employees = await prisma.employee.findMany({
      where: {
        companyId: req.user!.companyId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
        salaryStructure: { isNot: null },
        dateOfJoining: { lte: run.period.endDate },
        OR: [
          { exitDate: null },
          { exitDate: { gte: run.period.startDate } }
        ]
      },
      include: {
        salaryStructure: {
          include: {
            lines: {
              include: { component: true },
              orderBy: { component: { displayOrder: 'asc' } }
            }
          }
        },
        payrollPolicy: true,
        branch: true,
        department: true,
        designation: true,
        loans: {
          where: { status: 'ACTIVE' },
          include: { loanType: true }
        }
      }
    });

    // Fetch statutory configuration and PT Slabs
    const [statutoryConfig, ptSlabs] = await Promise.all([
      prisma.statutoryConfig.findUnique({ where: { companyId: req.user!.companyId } }),
      prisma.professionalTaxSlab.findMany()
    ]);

    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalEmployer = new Decimal(0);

    const calculationWarnings: string[] = [];

    const updated = await prisma.$transaction(async (tx) => {
      // Clear any prior calculated slips for this run
      await tx.corporatePayrollSlip.deleteMany({
        where: { payrollRunId: run.id }
      });

      for (const emp of employees) {
        const result = await PayrollCalculationEngine.calculateEmployee(
          emp,
          run.period,
          ptSlabs,
          statutoryConfig
        );

        totalGross = totalGross.plus(result.grossPay);
        totalDeductions = totalDeductions.plus(result.deductionsPay);
        totalNet = totalNet.plus(result.netPay);
        totalEmployer = totalEmployer.plus(result.employerCost);

        if (result.exceptions.length > 0) {
          calculationWarnings.push(`${emp.employeeCode}: ${result.exceptions.join('; ')}`);
        }

        const slip = await tx.corporatePayrollSlip.create({
          data: {
            payrollRunId: run.id,
            employeeId: emp.id,
            workingDays: result.attendance.workingDays,
            payableDays: result.attendance.payableDays,
            lopDays: result.attendance.lopDays,
            unpaidDays: result.attendance.unpaidMidMonthDays,
            arrearsAmount: result.arrearsAmount,
            reimbursementAmount: result.reimbursementAmount,
            variableEarnings: result.variableEarnings,
            pfWageBasis: result.pfWageBasis,
            esiWageBasis: result.esiWageBasis,
            ptWageBasis: result.ptWageBasis,
            grossPay: result.grossPay,
            deductionsPay: result.deductionsPay,
            netPay: result.netPay,
            employerCost: result.employerCost,
            calculationSnapshot: result.snapshot
          }
        });

        for (const item of result.items) {
          await tx.corporatePayrollItem.create({
            data: {
              payrollSlipId: slip.id,
              code: item.code,
              name: item.name,
              type: item.type,
              amount: item.calculatedAmount
            }
          });
        }
      }

      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'CALCULATED',
          totalEmployees: employees.length,
          totalGross,
          totalDeductions,
          totalNetPay: totalNet,
          totalEmployerCost: totalEmployer,
          calculatedAt: new Date()
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'CALCULATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Calculated payroll for ${employees.length} employees with net total ₹${totalNet.toFixed(2)}`
        }
      });

      return u;
    });

    res.status(200).json({ run: updated, warnings: calculationWarnings });
  } catch (error) {
    next(error);
  }
});

// STAGE 4: REVIEW (Audit Variances, Exceptions & High Deductions)
corporatePayrollRouter.post('/runs/:id/review', authenticate, requireRole(['payroll_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        slips: { include: { items: true, employee: true } }
      }
    });
    if (!run) throw new AppError('Run not found', 404);

    // Compute variance against the immediately prior run
    const priorRun = await prisma.corporatePayrollRun.findFirst({
      where: {
        companyId: req.user!.companyId,
        id: { not: run.id },
        status: { in: ['PAID', 'APPROVED', 'REVIEWED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    const varianceNotes: any = {
      reviewedById: req.user!.userId,
      reviewedAt: new Date().toISOString(),
      negativeNetPayCount: 0,
      highDeductionCount: 0,
      warnings: []
    };

    for (const slip of run.slips) {
      if (Number(slip.netPay) < 0) {
        varianceNotes.negativeNetPayCount++;
        varianceNotes.warnings.push(`${slip.employee.employeeCode}: Negative take-home pay (₹${Number(slip.netPay).toFixed(2)})`);
      }
      if (Number(slip.deductionsPay) > Number(slip.grossPay) * 0.50) {
        varianceNotes.highDeductionCount++;
        varianceNotes.warnings.push(`${slip.employee.employeeCode}: Deductions exceed 50% of gross earnings`);
      }
    }

    if (priorRun) {
      const grossDelta = Number(run.totalGross) - Number(priorRun.totalGross);
      const netDelta = Number(run.totalNetPay) - Number(priorRun.totalNetPay);
      varianceNotes.priorRunNumber = priorRun.runNumber;
      varianceNotes.grossDelta = grossDelta;
      varianceNotes.netDelta = netDelta;
      varianceNotes.grossDeltaPct = Number(priorRun.totalGross) > 0 ? ((grossDelta / Number(priorRun.totalGross)) * 100).toFixed(2) + '%' : 'N/A';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'REVIEWED',
          varianceNotes,
          reviewedBy: req.user!.fullName,
          reviewedAt: new Date()
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'REVIEWED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Calculations audited. Negative net pay: ${varianceNotes.negativeNetPayCount}, High deductions: ${varianceNotes.highDeductionCount}`
        }
      });

      return u;
    });

    res.status(200).json({ run: updated, varianceNotes });
  } catch (error) {
    next(error);
  }
});

// STAGE 5: APPROVE (Finance / Executive Approval)
corporatePayrollRouter.post('/runs/:id/approve', authenticate, requireRole(['finance_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status !== 'REVIEWED') {
      throw new AppError(`Cannot approve run with status ${run.status}. Run must be in REVIEWED state.`, 400);
    }

    // Segregation of Duties (SOD): Initiator or validator cannot approve final disbursement
    const isStrictSod = process.env.ENFORCE_STRICT_SOD === 'true' || req.headers['x-enforce-sod'] === 'true';
    const valNotes = run.validationNotes as any;
    const revNotes = run.varianceNotes as any;
    const sameUserById = (valNotes?.validatedById && valNotes.validatedById === req.user!.userId) ||
                         (revNotes?.reviewedById && revNotes.reviewedById === req.user!.userId);
    const sameUserByName = (run.validatedBy && run.validatedBy === req.user!.fullName) ||
                           (run.reviewedBy && run.reviewedBy === req.user!.fullName);
    if (isStrictSod && (sameUserById || sameUserByName)) {
      throw new AppError('Segregation of Duties Violation: You cannot approve a payroll run that you validated or reviewed. An independent executive or finance approver is required.', 403, 'SOD_VIOLATION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'APPROVED',
          approvedBy: req.user!.fullName,
          approvedAt: new Date()
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'APPROVED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'finance_admin',
          remarks: `Disbursement approved by Finance Executive ${req.user!.fullName}`
        }
      });

      return u;
    });

    await recordAudit(req, 'APPROVE_PAYROLL_RUN', 'CorporatePayrollRun', run.id, { totalNetPay: Number(run.totalNetPay) });
    res.status(200).json({ run: updated });
  } catch (error) {
    next(error);
  }
});

// STAGE 6: PAYMENT READY (Generate Payment Register & Advice)
corporatePayrollRouter.post('/runs/:id/payment-ready', authenticate, requireRole(['finance_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status !== 'APPROVED') {
      throw new AppError(`Run must be APPROVED before transitioning to PAYMENT_READY. Current: ${run.status}`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: { status: 'PAYMENT_READY' }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'PAYMENT_READY',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'finance_admin',
          remarks: 'Bank payment register and NEFT electronic advice generated'
        }
      });

      return u;
    });

    res.status(200).json({ run: updated });
  } catch (error) {
    next(error);
  }
});

// STAGE 7: MARK PAID & RELEASE PAYSLIPS
corporatePayrollRouter.post('/runs/:id/mark-paid', authenticate, requireRole(['finance_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      paymentReference: z.string().min(1)
    });
    const { paymentReference } = schema.parse(req.body);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        slips: {
          include: {
            items: true,
            employee: { include: { loans: { where: { status: 'ACTIVE' } } } }
          }
        }
      }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status !== 'PAYMENT_READY') {
      throw new AppError(`Run must be in PAYMENT_READY state before marking PAID. Current: ${run.status}`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Process active loan installment deductions
      for (const slip of run.slips) {
        const loanItem = slip.items.find(i => i.code === 'LOAN_EMI');
        if (loanItem && slip.employee.loans.length > 0) {
          const loan = slip.employee.loans[0];
          const emiPaid = new Decimal(loanItem.amount);
          const newRecovered = new Decimal(loan.recoveredAmount).plus(emiPaid);
          const newOutstanding = Decimal.max(0, new Decimal(loan.principalAmount).minus(newRecovered));

          await tx.employeeLoan.update({
            where: { id: loan.id },
            data: {
              recoveredAmount: newRecovered,
              outstandingAmount: newOutstanding,
              status: newOutstanding.isZero() ? 'COMPLETED' : 'ACTIVE'
            }
          });

          await tx.loanRepayment.create({
            data: {
              loanId: loan.id,
              installmentNumber: Math.round(Number(newRecovered) / Number(loan.monthlyEmi)),
              amountPaid: emiPaid
            }
          });
        }
      }

      // 2. Lock run as PAID
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentReference
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'PAID',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'finance_admin',
          remarks: `Confirmed disbursement with Bank Reference / UTR: ${paymentReference}. Slips released to ESS.`
        }
      });

      return u;
    });

    await recordAudit(req, 'MARK_PAYROLL_PAID', 'CorporatePayrollRun', run.id, { paymentReference });
    res.status(200).json({ run: updated });
  } catch (error) {
    next(error);
  }
});

// CONTROLLED RECALCULATION (Return for correction before approval)
corporatePayrollRouter.post('/runs/:id/recalculate', authenticate, requireRole(['payroll_admin', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!run) throw new AppError('Run not found', 404);
    if (run.status === 'PAID') {
      throw new AppError('Cannot recalculate a finalized PAID payroll batch.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: { status: 'VALIDATED' }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'VALIDATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: 'Returned to validation state for input correction and recalculation'
        }
      });

      return u;
    });

    res.status(200).json({ run: updated, message: 'Run unlocked for recalculation' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. DETAILED SLIP INSPECTION & EXPORTS
// ==========================================

// 3.1 Single Slip Detailed Breakdown
corporatePayrollRouter.get('/runs/:runId/slips/:slipId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slip = await prisma.corporatePayrollSlip.findFirst({
      where: {
        id: String(req.params.slipId),
        payrollRun: { companyId: req.user!.companyId }
      },
      include: {
        payrollRun: { include: { period: true } },
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true,
            payrollPolicy: true
          }
        },
        items: {
          orderBy: { code: 'asc' }
        }
      }
    });

    if (!slip) throw new AppError('Payroll slip not found', 404);

    // Enforce role isolation: non-privileged users can only view their own slip
    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'payroll_admin', 'payroll_processor', 'finance_admin', 'hr_manager'].includes(r)
    );
    if (!isPrivileged && slip.employeeId !== req.user!.employeeId) {
      throw new AppError('Access denied: You are not authorized to view another employee’s payslip.', 403, 'FORBIDDEN');
    }

    res.status(200).json({ slip });
  } catch (error) {
    next(error);
  }
});

// 3.2 Single Slip PDF Generation (Admin / HR)
corporatePayrollRouter.get('/slips/:id/pdf', authenticate, requireRole(['company_admin', 'payroll_admin', 'finance_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slipId = String(req.params.id);
    const slip = await prisma.corporatePayrollSlip.findFirst({
      where: {
        id: slipId,
        payrollRun: { companyId: req.user!.companyId }
      },
      include: {
        payrollRun: { include: { period: true, company: true } },
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true,
            payrollPolicy: true
          }
        },
        items: true
      }
    });

    if (!slip) throw new AppError('Payroll slip not found', 404);

    const { generatePayslipPdf } = await import('../../utils/pdfGenerator.js');

    const pdfBuffer = await generatePayslipPdf({
      companyName: slip.payrollRun.company?.name || 'Apex Global Technologies Pvt. Ltd.',
      periodName: slip.payrollRun.period.name,
      runNumber: slip.payrollRun.runNumber,
      employeeCode: slip.employee.employeeCode,
      employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
      designation: slip.employee.designation?.name || 'Staff Specialist',
      department: slip.employee.department?.name || 'Corporate',
      branch: slip.employee.branch?.name || 'HQ Mumbai',
      dateOfJoining: slip.employee.dateOfJoining ? new Date(slip.employee.dateOfJoining).toISOString().split('T')[0] : '',
      panNumber: slip.employee.panNumber || undefined,
      bankName: slip.employee.bankName || undefined,
      bankAccountNumber: slip.employee.bankAccountNumber || undefined,
      ifscCode: slip.employee.ifscCode || undefined,
      pfUan: slip.employee.payrollPolicy?.uanNumber || undefined,
      esiNumber: slip.employee.payrollPolicy?.esiNumber || undefined,
      calendarDays: 30,
      paidDays: Number(slip.payableDays),
      unpaidDays: Number(slip.unpaidDays || 0),
      pfWageBasis: Number(slip.pfWageBasis || slip.grossPay),
      grossPay: Number(slip.grossPay),
      totalDeductions: Number(slip.deductionsPay),
      netPay: Number(slip.netPay),
      employerCost: Number(slip.employerCost),
      employerPf: Number(slip.employerCost.minus(slip.grossPay)),
      employerEsi: 0,
      items: slip.items.map(it => ({
        name: it.name,
        type: it.type,
        amount: Number(it.amount)
      }))
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Payslip_${slip.employee.employeeCode}_${slip.payrollRun.period.name.replace(/\s+/g, '_')}.pdf"`
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// 3.3 One-Click Bulk Email Payslip Dispatch (VID-32)
// 3.3 One-Click Bulk Email Payslip Dispatch with Real Provider & Per-Recipient Tracking (VID-32)
corporatePayrollRouter.post('/runs/:id/send-payslips', authenticate, requireRole(['company_admin', 'payroll_admin', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const forceResend = Boolean(req.body?.forceResend);
    const retryFailedOnly = Boolean(req.body?.retryFailedOnly);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: {
        id: runId,
        companyId: req.user!.companyId
      },
      include: {
        period: true,
        company: true,
        slips: {
          include: {
            employee: {
              include: {
                department: true,
                designation: true,
                branch: true,
                payrollPolicy: true
              }
            },
            items: true,
            emailDispatches: true
          }
        }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);

    if (run.status !== 'PAID') {
      throw new AppError(`Cannot email payslips: Payroll run must be finalized and in 'PAID' status. Current status: ${run.status}`, 400);
    }

    const { getEmailProvider } = await import('../../utils/emailService.js');
    const { generatePayslipPdf } = await import('../../utils/pdfGenerator.js');
    const emailProvider = getEmailProvider();

    const results: Array<{
      employeeId: string;
      employeeCode: string;
      recipientEmail: string;
      status: 'DELIVERED' | 'FAILED' | 'SKIPPED';
      attemptCount: number;
      messageId?: string;
      error?: string;
    }> = [];

    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const slip of run.slips) {
      const email = slip.employee.workEmail || slip.employee.personalEmail;

      if (!email || !email.includes('@')) {
        results.push({
          employeeId: slip.employee.id,
          employeeCode: slip.employee.employeeCode,
          recipientEmail: email || 'N/A',
          status: 'SKIPPED',
          attemptCount: 0,
          error: 'No valid email address registered for employee'
        });
        skippedCount++;
        continue;
      }

      // Check existing dispatch records to prevent duplicate dispatches
      const existingDispatch = slip.emailDispatches?.[0] || await prisma.payslipDispatchRecord.findFirst({
        where: { payrollRunId: run.id, employeeId: slip.employee.id }
      });

      if (existingDispatch && existingDispatch.status === 'DELIVERED' && !forceResend) {
        // Prevent duplicate sending to employees who already received their slip
        results.push({
          employeeId: slip.employee.id,
          employeeCode: slip.employee.employeeCode,
          recipientEmail: email,
          status: 'SKIPPED',
          attemptCount: existingDispatch.attemptCount,
          messageId: existingDispatch.messageId || undefined,
          error: 'Already delivered previously (use forceResend: true to override)'
        });
        skippedCount++;
        continue;
      }

      if (retryFailedOnly && existingDispatch && existingDispatch.status !== 'FAILED') {
        results.push({
          employeeId: slip.employee.id,
          employeeCode: slip.employee.employeeCode,
          recipientEmail: email,
          status: 'SKIPPED',
          attemptCount: existingDispatch.attemptCount,
          error: 'Skipped during retry-failed-only run'
        });
        skippedCount++;
        continue;
      }

      // 1. Generate authentic PDF payslip buffer
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generatePayslipPdf({
          companyName: run.company?.name || 'Apex Global Technologies Pvt. Ltd.',
          periodName: run.period.name,
          runNumber: run.runNumber,
          employeeCode: slip.employee.employeeCode,
          employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
          designation: slip.employee.designation?.name || 'Staff Specialist',
          department: slip.employee.department?.name || 'Corporate',
          branch: slip.employee.branch?.name || 'HQ Mumbai',
          dateOfJoining: slip.employee.dateOfJoining ? new Date(slip.employee.dateOfJoining).toISOString().split('T')[0] : '',
          panNumber: slip.employee.panNumber || undefined,
          bankName: slip.employee.bankName || undefined,
          bankAccountNumber: slip.employee.bankAccountNumber || undefined,
          ifscCode: slip.employee.ifscCode || undefined,
          pfUan: slip.employee.payrollPolicy?.uanNumber || undefined,
          esiNumber: slip.employee.payrollPolicy?.esiNumber || undefined,
          calendarDays: 30,
          paidDays: Number(slip.payableDays),
          unpaidDays: Number(slip.unpaidDays || 0),
          pfWageBasis: Number(slip.pfWageBasis || slip.grossPay),
          grossPay: Number(slip.grossPay),
          totalDeductions: Number(slip.deductionsPay),
          netPay: Number(slip.netPay),
          employerCost: Number(slip.employerCost),
          employerPf: Number(slip.employerCost.minus(slip.grossPay)),
          employerEsi: 0,
          items: slip.items.map(it => ({
            name: it.name,
            type: it.type,
            amount: Number(it.amount)
          }))
        });
      } catch (pdfErr: any) {
        failedCount++;
        results.push({
          employeeId: slip.employee.id,
          employeeCode: slip.employee.employeeCode,
          recipientEmail: email,
          status: 'FAILED',
          attemptCount: (existingDispatch?.attemptCount || 0) + 1,
          error: `PDF generation error: ${pdfErr.message}`
        });
        continue;
      }

      // 2. Transmit via configured email provider
      const emailOptions = {
        to: email,
        subject: `[CONFIDENTIAL] Salary Payslip for ${run.period.name} — ${run.company?.name || 'Apex Global Tech'}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1e3a8a; padding: 20px; color: #ffffff; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">Apex Global Technologies</h2>
              <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Official Salary Disbursement Advice</p>
            </div>
            <div style="padding: 24px;">
              <p>Dear <strong>${slip.employee.firstName} ${slip.employee.lastName}</strong>,</p>
              <p>Your salary payslip for <strong>${run.period.name}</strong> has been generated and released following electronic bank transfer finalization (Ref: <code>${run.paymentReference || 'NEFT-AUTO'}</code>).</p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin: 16px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: #64748b; font-size: 13px;">Employee Code:</span>
                  <strong style="font-size: 13px;">${slip.employee.employeeCode}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: #64748b; font-size: 13px;">Paid Working Days:</span>
                  <strong style="font-size: 13px;">${slip.payableDays} Days</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b; font-size: 13px;">Net Disbursed Take-Home:</span>
                  <strong style="font-size: 15px; color: #059669;">₹${Number(slip.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <p style="font-size: 13px; color: #475569;">
                Your official, password-protected PDF payslip is attached to this email for your personal tax and financial records. You may also access historical payslips on the Employee Self-Service (ESS) portal.
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                This is an automated confidential payroll notification. If you notice any discrepancies, please raise an inquiry with the corporate payroll desk within 5 business days.
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Payslip_${slip.employee.employeeCode}_${run.period.name.replace(/\s+/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const sendResult = await emailProvider.send(emailOptions);

      const attemptCount = (existingDispatch?.attemptCount || 0) + 1;
      const status = sendResult.success ? 'DELIVERED' : 'FAILED';

      if (sendResult.success) {
        deliveredCount++;
      } else {
        failedCount++;
      }

      // 3. Upsert per-recipient record in database
      await prisma.payslipDispatchRecord.upsert({
        where: {
          payrollRunId_employeeId: {
            payrollRunId: run.id,
            employeeId: slip.employee.id
          }
        },
        update: {
          recipientEmail: email,
          status,
          messageId: sendResult.messageId || null,
          attemptCount,
          errorDetails: sendResult.error || null,
          provider: sendResult.provider,
          dispatchedAt: sendResult.timestamp
        },
        create: {
          payrollRunId: run.id,
          payrollSlipId: slip.id,
          employeeId: slip.employee.id,
          employeeCode: slip.employee.employeeCode,
          recipientEmail: email,
          status,
          messageId: sendResult.messageId || null,
          attemptCount,
          errorDetails: sendResult.error || null,
          provider: sendResult.provider,
          dispatchedAt: sendResult.timestamp
        }
      });

      results.push({
        employeeId: slip.employee.id,
        employeeCode: slip.employee.employeeCode,
        recipientEmail: email,
        status,
        attemptCount,
        messageId: sendResult.messageId,
        error: sendResult.error
      });
    }

    await recordAudit(req, 'DISPATCH_PAYSLIPS', 'CorporatePayrollRun', run.id, {
      runNumber: run.runNumber,
      period: run.period.name,
      provider: emailProvider.name,
      deliveredCount,
      failedCount,
      skippedCount,
      totalSlips: run.slips.length,
      forceResend
    });

    res.status(200).json({
      success: true,
      message: `Payslip dispatch cycle completed: ${deliveredCount} delivered, ${failedCount} failed, ${skippedCount} skipped (provider: ${emailProvider.name}).`,
      provider: emailProvider.name,
      deliveredCount,
      dispatchedCount: deliveredCount,
      failedCount,
      skippedCount,
      totalEmployees: run.slips.length,
      recipients: results
    });
  } catch (error) {
    next(error);
  }
});

// 3.4 Get Detailed Dispatch History & Delivery Status
corporatePayrollRouter.get('/runs/:id/dispatch-status', authenticate, requireRole(['company_admin', 'payroll_admin', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        period: true,
        emailDispatches: {
          orderBy: { dispatchedAt: 'desc' }
        },
        _count: { select: { slips: true } }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);

    const deliveredCount = run.emailDispatches.filter(d => d.status === 'DELIVERED').length;
    const failedCount = run.emailDispatches.filter(d => d.status === 'FAILED').length;
    const skippedCount = run.emailDispatches.filter(d => d.status === 'SKIPPED').length;
    const pendingCount = Math.max(0, run._count.slips - run.emailDispatches.length);

    res.status(200).json({
      runId: run.id,
      runNumber: run.runNumber,
      periodName: run.period.name,
      totalSlips: run._count.slips,
      summary: {
        deliveredCount,
        failedCount,
        skippedCount,
        pendingCount
      },
      dispatches: run.emailDispatches
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4. MONTHLY SALARY EDITOR (Saral PayPack Parity)
// ==========================================

// 4.1 Get Salary Editor Rows with Take-Home Compliance Flag
corporatePayrollRouter.get('/runs/:id/editor', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        period: true,
        slips: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                panNumber: true,
                bankName: true,
                bankAccountNumber: true,
                ifscCode: true,
                status: true,
                department: { select: { name: true } },
                designation: { select: { name: true } }
              }
            },
            items: true
          },
          orderBy: { employee: { employeeCode: 'asc' } }
        }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);

    const rows = run.slips.map(s => {
      const gross = Number(s.grossPay);
      const deductions = Number(s.deductionsPay);
      const net = Number(s.netPay);
      const isNetLessThan25Percent = gross > 0 && net < (gross * 0.25);

      const itemMap = new Map(s.items.map(i => [i.code, Number(i.amount)]));

      return {
        id: s.id,
        employeeId: s.employee.id,
        employeeCode: s.employee.employeeCode,
        employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
        department: s.employee.department?.name || 'General',
        designation: s.employee.designation?.name || 'Staff',
        status: s.employee.status,
        payableDays: Number(s.payableDays),
        lopDays: Number(s.lopDays),
        basic: itemMap.get('BASIC') || 0,
        hra: itemMap.get('HRA') || 0,
        conveyance: itemMap.get('CONVEYANCE') || 0,
        specialAllowance: itemMap.get('SPECIAL_ALLOWANCE') || 0,
        variableEarnings: Number(s.variableEarnings || 0),
        arrearsAmount: Number(s.arrearsAmount || 0),
        reimbursementAmount: Number(s.reimbursementAmount || 0),
        grossPay: gross,
        epfEmployee: itemMap.get('EPF_EMPLOYEE') || 0,
        esiEmployee: itemMap.get('ESIC_EMPLOYEE') || 0,
        professionalTax: itemMap.get('PROFESSIONAL_TAX') || 0,
        tds: itemMap.get('TDS') || 0,
        loanEmi: itemMap.get('LOAN_EMI') || 0,
        deductionsPay: deductions,
        netPay: net,
        employerCost: Number(s.employerCost),
        isNetLessThan25Percent,
        items: s.items.map(it => ({
          code: it.code,
          name: it.name,
          type: it.type,
          amount: Number(it.amount)
        }))
      };
    });

    res.status(200).json({
      runId: run.id,
      runNumber: run.runNumber,
      status: run.status,
      periodName: run.period.name,
      totalEmployees: run.slips.length,
      totals: {
        totalGross: Number(run.totalGross),
        totalDeductions: Number(run.totalDeductions),
        totalNetPay: Number(run.totalNetPay),
        totalEmployerCost: Number(run.totalEmployerCost)
      },
      rows
    });
  } catch (error) {
    next(error);
  }
});

// 4.2 Update Salary Adjustments (Incentives, Bonus, Overtime, Arrears, LOP Override)
corporatePayrollRouter.patch('/runs/:id/adjustments', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const schema = z.object({
      slipId: z.string().min(1),
      arrearsAmount: z.number().min(0).optional(),
      reimbursementAmount: z.number().min(0).optional(),
      variableEarnings: z.number().min(0).optional(),
      lopDaysOverride: z.number().min(0).optional(),
      tdsOverride: z.number().min(0).optional(),
      reason: z.string().optional()
    });
    const parsed = schema.parse(req.body);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        period: true,
        slips: { where: { id: parsed.slipId }, include: { items: true, employee: true } }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status === 'PAID') {
      throw new AppError('Cannot modify finalized PAID payroll run', 400);
    }

    const slip = run.slips[0];
    if (!slip) throw new AppError('Payroll slip not found in this run', 404);

    const updatedSlip = await prisma.$transaction(async (tx) => {
      let arrears = parsed.arrearsAmount !== undefined ? new Decimal(parsed.arrearsAmount) : new Decimal(slip.arrearsAmount);
      let reimbursement = parsed.reimbursementAmount !== undefined ? new Decimal(parsed.reimbursementAmount) : new Decimal(slip.reimbursementAmount);
      let variable = parsed.variableEarnings !== undefined ? new Decimal(parsed.variableEarnings) : new Decimal(slip.variableEarnings);

      // Handle variable earnings item (Incentive / Bonus / Overtime)
      if (parsed.variableEarnings !== undefined) {
        const existingVarItem = slip.items.find(i => i.code === 'VARIABLE_PAY' || i.code === 'INCENTIVE' || i.code === 'BONUS');
        if (existingVarItem) {
          await tx.corporatePayrollItem.update({
            where: { id: existingVarItem.id },
            data: { amount: variable }
          });
        } else if (variable.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: {
              payrollSlipId: slip.id,
              code: 'VARIABLE_PAY',
              name: 'Incentive / Variable Bonus',
              type: 'EARNING',
              amount: variable
            }
          });
        }
      }

      // Handle arrears item
      if (parsed.arrearsAmount !== undefined) {
        const existingArrears = slip.items.find(i => i.code === 'ARREARS');
        if (existingArrears) {
          await tx.corporatePayrollItem.update({
            where: { id: existingArrears.id },
            data: { amount: arrears }
          });
        } else if (arrears.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: {
              payrollSlipId: slip.id,
              code: 'ARREARS',
              name: 'Salary Arrears',
              type: 'EARNING',
              amount: arrears
            }
          });
        }
      }

      // Handle TDS override
      if (parsed.tdsOverride !== undefined) {
        const tdsVal = new Decimal(parsed.tdsOverride);
        const existingTds = slip.items.find(i => i.code === 'TDS');
        if (existingTds) {
          await tx.corporatePayrollItem.update({
            where: { id: existingTds.id },
            data: { amount: tdsVal }
          });
        } else if (tdsVal.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: {
              payrollSlipId: slip.id,
              code: 'TDS',
              name: 'Income Tax (TDS)',
              type: 'DEDUCTION',
              amount: tdsVal
            }
          });
        }
      }

      // Re-sum items
      const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
      let newGross = new Decimal(0);
      let newDeductions = new Decimal(0);

      for (const it of allItems) {
        if (it.type === 'EARNING') {
          newGross = newGross.plus(new Decimal(it.amount));
        } else if (it.type === 'DEDUCTION') {
          newDeductions = newDeductions.plus(new Decimal(it.amount));
        }
      }

      const newNet = Decimal.max(0, newGross.minus(newDeductions).plus(reimbursement));

      // Update slip
      const updated = await tx.corporatePayrollSlip.update({
        where: { id: slip.id },
        data: {
          arrearsAmount: arrears,
          reimbursementAmount: reimbursement,
          variableEarnings: variable,
          grossPay: newGross,
          deductionsPay: newDeductions,
          netPay: newNet
        },
        include: { items: true, employee: true }
      });

      // Recalculate run-level totals
      const allRunSlips = await tx.corporatePayrollSlip.findMany({ where: { payrollRunId: run.id } });
      let runGross = new Decimal(0);
      let runDeductions = new Decimal(0);
      let runNet = new Decimal(0);

      for (const s of allRunSlips) {
        runGross = runGross.plus(new Decimal(s.grossPay));
        runDeductions = runDeductions.plus(new Decimal(s.deductionsPay));
        runNet = runNet.plus(new Decimal(s.netPay));
      }

      await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          totalGross: runGross,
          totalDeductions: runDeductions,
          totalNetPay: runNet
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: run.status,
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Manual Salary Adjustment for ${slip.employee.employeeCode}: ${parsed.reason || 'Salary Editor update'}`
        }
      });

      return updated;
    });

    await recordAudit(req, 'UPDATE_SALARY_ADJUSTMENT', 'CorporatePayrollSlip', slip.id, parsed);
    res.status(200).json({ success: true, slip: updatedSlip });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 5. TDS PROCESS & TAX ASSESSMENT (Saral PayPack Parity)
// ==========================================

// 5.1 Calculate Projected TDS for All Employees
corporatePayrollRouter.get('/tds/summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const requestedFy = (req.query.financialYear as string) || '2026-2027';
    const [fyStartYearStr] = requestedFy.split('-');
    const fyStartYear = parseInt(fyStartYearStr, 10) || 2026;
    const fyStartDate = new Date(Date.UTC(fyStartYear, 3, 1));
    const fyEndDate = new Date(Date.UTC(fyStartYear + 1, 2, 31, 23, 59, 59, 999));

    // Determine current month & remaining withholding periods in the Financial Year
    const reqMonth = req.query.month ? Number(req.query.month) : null;
    const now = new Date();
    const currentMonth = reqMonth || (now.getMonth() + 1);
    const remainingMonths = req.query.remainingMonths
      ? Math.max(1, Math.min(12, Number(req.query.remainingMonths)))
      : Math.max(1, Math.min(12, currentMonth >= 4 ? 16 - currentMonth : 4 - currentMonth));

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] }
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
        salaryStructure: {
          include: { lines: { include: { component: true } } }
        },
        payrollPolicy: true,
        taxDeclarations: { orderBy: { submittedAt: 'desc' } }
      },
      orderBy: { employeeCode: 'asc' }
    });

    // Fetch prior finalized slips for all employees in this company for this FY
    const priorSlips = await prisma.corporatePayrollSlip.findMany({
      where: {
        employee: { companyId },
        payrollRun: {
          status: 'PAID',
          period: {
            startDate: { gte: fyStartDate, lte: fyEndDate }
          }
        }
      },
      include: {
        items: { where: { code: 'TDS' } }
      }
    });

    const priorByEmp = new Map<string, { ytdGross: number; ytdTds: number }>();
    for (const s of priorSlips) {
      const prev = priorByEmp.get(s.employeeId) || { ytdGross: 0, ytdTds: 0 };
      prev.ytdGross += Number(s.grossPay);
      for (const item of s.items) {
        prev.ytdTds += Number(item.amount);
      }
      priorByEmp.set(s.employeeId, prev);
    }

    let totalProjectedTax = 0;
    let totalMonthlyTds = 0;

    const records = employees.map(emp => {
      const policy = emp.payrollPolicy;
      const regime = policy?.taxRegime || 'NEW';
      const declaration = emp.taxDeclarations[0];

      // Monthly gross from structure lines
      let monthlyGross = 0;
      if (emp.salaryStructure?.lines && emp.salaryStructure.lines.length > 0) {
        monthlyGross = emp.salaryStructure.lines
          .filter((l: any) => l.component?.type === 'EARNING' || l.componentType === 'EARNING' || (!l.component?.type && !l.componentType))
          .reduce((acc: number, l: any) => acc + Number(l.monthlyAmount || 0), 0);
      } else if (emp.salaryStructure?.annualCtc) {
        monthlyGross = Number(emp.salaryStructure.annualCtc) / 12;
      }

      const priorData = priorByEmp.get(emp.id) || { ytdGross: 0, ytdTds: 0 };
      const futureMonths = Math.max(0, remainingMonths - 1);
      const annualProjectedGross = priorData.ytdGross > 0
        ? priorData.ytdGross + monthlyGross + (futureMonths * monthlyGross)
        : monthlyGross * 12;

      const taxResult = calculateIncomeTax({
        annualGross: annualProjectedGross,
        regime,
        financialYear: requestedFy,
        remainingMonths,
        tdsAlreadyDeducted: priorData.ytdTds,
        declarations: declaration ? {
          section80C: declaration.section80C,
          section80D: declaration.section80D,
          section24b: declaration.section24b
        } : undefined
      });

      totalProjectedTax += taxResult.totalAnnualTax;
      totalMonthlyTds += taxResult.monthlyTds;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name || 'General',
        designation: emp.designation?.name || 'Staff',
        panNumber: emp.panNumber || 'N/A',
        taxRegime: regime,
        monthlyGross,
        annualProjectedGross,
        ytdGross: priorData.ytdGross,
        tdsAlreadyDeducted: priorData.ytdTds,
        remainingMonths,
        standardDeduction: taxResult.standardDeduction,
        section80C: regime === 'OLD' && declaration ? Math.min(150000, Number(declaration.section80C || 0)) : 0,
        section80D: regime === 'OLD' && declaration ? Math.min(50000, Number(declaration.section80D || 0)) : 0,
        section24b: regime === 'OLD' && declaration ? Math.min(200000, Number(declaration.section24b || 0)) : 0,
        totalDeductions: taxResult.standardDeduction + taxResult.chapterVIA,
        taxableIncome: taxResult.taxableIncome,
        annualTax: taxResult.grossTax,
        cess: taxResult.cess,
        totalTaxPayable: taxResult.totalAnnualTax,
        monthlyTds: taxResult.monthlyTds
      };
    });

    res.status(200).json({
      financialYear: '2026-2027',
      totalEmployees: records.length,
      totalProjectedTax,
      totalMonthlyTds,
      records
    });
  } catch (error) {
    next(error);
  }
});

// 5.2 Port Computed TDS to Active Payroll Slips (Saral PayPack Parity)
corporatePayrollRouter.post('/tds/port-to-salary', authenticate, requireRole(['company_admin', 'payroll_admin', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      runId: z.string().min(1),
      overwrite: z.boolean().default(true)
    });
    const { runId, overwrite } = schema.parse(req.body);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        period: true,
        slips: {
          include: {
            items: true,
            employee: {
              include: {
                payrollPolicy: true,
                salaryStructure: true,
                taxDeclarations: { orderBy: { submittedAt: 'desc' } }
              }
            }
          }
        }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status === 'PAID' || run.status === 'APPROVED') {
      throw new AppError(`Cannot port TDS to an ${run.status} payroll run`, 400);
    }

    const periodMonth = run.period.month;
    const periodYear = run.period.year;
    const remainingMonths = Math.max(1, Math.min(12, periodMonth >= 4 ? 16 - periodMonth : 4 - periodMonth));
    const fyStartYear = periodMonth >= 4 ? periodYear : periodYear - 1;
    const fyStartDate = new Date(Date.UTC(fyStartYear, 3, 1));
    const financialYear = `${fyStartYear}-${fyStartYear + 1}`;

    let portedCount = 0;
    let totalTdsPorted = 0;

    await prisma.$transaction(async (tx) => {
      for (const slip of run.slips) {
        const emp = slip.employee;
        const policy = emp.payrollPolicy;
        const regime = policy?.taxRegime || 'NEW';
        const declaration = emp.taxDeclarations[0];

        // Fetch prior finalized slips for this employee strictly before this period in current FY
        const priorSlips = await tx.corporatePayrollSlip.findMany({
          where: {
            employeeId: emp.id,
            payrollRun: {
              status: 'PAID',
              period: {
                startDate: {
                  gte: fyStartDate,
                  lt: run.period.startDate
                }
              }
            }
          },
          include: {
            items: { where: { code: 'TDS' } }
          }
        });

        let ytdGross = 0;
        let ytdTds = 0;
        for (const ps of priorSlips) {
          ytdGross += Number(ps.grossPay);
          for (const item of ps.items) {
            ytdTds += Number(item.amount);
          }
        }

        const monthlyGross = Number(slip.grossPay);
        const futureMonths = Math.max(0, remainingMonths - 1);
        const regularMonthly = emp.salaryStructure?.annualCtc ? Number(emp.salaryStructure.annualCtc) / 12 : monthlyGross;
        const annualProjectedGross = ytdGross > 0
          ? ytdGross + monthlyGross + (futureMonths * regularMonthly)
          : monthlyGross + (futureMonths * regularMonthly);

        const taxResult = calculateIncomeTax({
          annualGross: annualProjectedGross,
          regime,
          financialYear,
          remainingMonths,
          tdsAlreadyDeducted: ytdTds,
          declarations: declaration ? {
            section80C: declaration.section80C,
            section80D: declaration.section80D,
            section24b: declaration.section24b
          } : undefined
        });

        const monthlyTds = taxResult.monthlyTds;

        const existingTds = slip.items.find(i => i.code === 'TDS');
        if (existingTds && !overwrite) {
          continue;
        }

        if (existingTds) {
          await tx.corporatePayrollItem.update({
            where: { id: existingTds.id },
            data: { amount: new Decimal(monthlyTds) }
          });
        } else if (monthlyTds > 0) {
          await tx.corporatePayrollItem.create({
            data: {
              payrollSlipId: slip.id,
              code: 'TDS',
              name: `Income Tax (TDS - ${regime} Regime)`,
              type: 'DEDUCTION',
              amount: new Decimal(monthlyTds)
            }
          });
        }

        // Re-calculate slip totals
        const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
        let deductions = new Decimal(0);
        for (const it of allItems) {
          if (it.type === 'DEDUCTION') {
            deductions = deductions.plus(new Decimal(it.amount));
          }
        }
        const gross = new Decimal(slip.grossPay);
        const net = Decimal.max(0, gross.minus(deductions).plus(new Decimal(slip.reimbursementAmount)));

        await tx.corporatePayrollSlip.update({
          where: { id: slip.id },
          data: {
            deductionsPay: deductions,
            netPay: net
          }
        });

        portedCount++;
        totalTdsPorted += monthlyTds;
      }

      // Re-sum run totals
      const allSlips = await tx.corporatePayrollSlip.findMany({ where: { payrollRunId: run.id } });
      let runDeductions = new Decimal(0);
      let runNet = new Decimal(0);
      for (const s of allSlips) {
        runDeductions = runDeductions.plus(new Decimal(s.deductionsPay));
        runNet = runNet.plus(new Decimal(s.netPay));
      }

      await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          totalDeductions: runDeductions,
          totalNetPay: runNet
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: run.status,
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Ported monthly TDS for ${portedCount} staff. Total TDS ported: ₹${totalTdsPorted.toLocaleString('en-IN')}`
        }
      });
    });

    await recordAudit(req, 'PORT_TDS_TO_SALARY', 'CorporatePayrollRun', run.id, {
      portedCount,
      totalTdsPorted
    });

    res.status(200).json({
      success: true,
      message: `Successfully ported computed TDS to ${portedCount} employee payroll slips. Total TDS: ₹${totalTdsPorted.toLocaleString('en-IN')}`,
      portedCount,
      totalTdsPorted
    });
  } catch (error) {
    next(error);
  }
});



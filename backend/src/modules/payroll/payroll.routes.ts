import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { PayrollEngine, CalculationInput } from './engine.js';

export const payrollRouter = Router();

// List Payroll Runs
payrollRouter.get('/runs', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const financialYearId = req.query.financialYearId ? String(req.query.financialYearId) : undefined;

    const runs = await prisma.payrollRun.findMany({
      where: {
        institutionId: req.user!.institutionId,
        ...(status ? { status: status as any } : {}),
        ...(financialYearId ? { financialYearId } : {})
      },
      include: {
        period: true,
        financialYear: true,
        ou: true,
        _count: { select: { records: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ runs });
  } catch (error) {
    next(error);
  }
});

// Single Run Details with Records and Transitions
payrollRouter.get('/runs/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where: {
        id: String(req.params.id),
        institutionId: req.user!.institutionId
      },
      include: {
        period: true,
        financialYear: true,
        ou: true,
        transitions: {
          orderBy: { createdAt: 'asc' }
        },
        records: {
          include: {
            employee: {
              include: {
                designation: true,
                department: true,
                ou: true
              }
            },
            lines: true
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

// Preview Payroll Generation (PDA / Admin)
payrollRouter.post('/runs/preview', authenticate, requireRole(['payroll_pda', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      periodId: z.string().min(1),
      ouId: z.string().optional(),
      employeeIds: z.array(z.string()).optional()
    });
    const { periodId, ouId, employeeIds } = schema.parse(req.body);

    const period = await prisma.payrollPeriod.findUnique({
      where: { id: periodId },
      include: { financialYear: true }
    });
    if (!period) throw new AppError('Payroll period not found', 404);

    // Fetch eligible active employees
    const employees = await prisma.employee.findMany({
      where: {
        institutionId: req.user!.institutionId,
        active: true,
        ...(ouId ? { ouId } : {}),
        ...(employeeIds && employeeIds.length > 0 ? { id: { in: employeeIds } } : {})
      },
      include: {
        designation: true,
        department: true,
        ou: true,
        salaryAssignments: {
          where: { active: true },
          include: {
            structure: {
              include: {
                lines: {
                  include: { salaryHead: true },
                  orderBy: { displayOrder: 'asc' }
                }
              }
            }
          },
          take: 1
        },
        loans: {
          where: { status: 'ACTIVE' },
          include: { loanType: true }
        },
        leaveRecords: {
          where: {
            status: 'APPROVED',
            fromDate: { lte: period.endDate },
            toDate: { gte: period.startDate }
          },
          include: { leaveType: true }
        },
        otherPayments: {
          where: {
            periodId: period.id,
            status: 'APPROVED'
          },
          include: { paymentType: true }
        },
        bankAccounts: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    const previewResults: any[] = [];
    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalNet = new Decimal(0);

    for (const emp of employees) {
      const assignment = emp.salaryAssignments[0];
      if (!assignment || !assignment.structure) continue;

      // Calculate LOP leave days
      let lopDays = 0;
      for (const leave of emp.leaveRecords) {
        const ratio = Number(leave.leaveType.deductionRatio);
        lopDays += Number(leave.daysCount) * ratio;
      }

      const activeLoans = emp.loans.map(loan => ({
        loanId: loan.id,
        loanTypeCode: loan.loanType.code,
        loanTypeName: loan.loanType.name,
        installmentNumber: loan.recoveredInstallments + 1,
        monthlyInstallment: Number(loan.monthlyInstallment),
        outstandingAmount: Number(loan.outstandingAmount)
      }));

      const otherPay = emp.otherPayments.map(op => ({
        typeCode: op.paymentType.code,
        typeName: op.paymentType.name,
        amount: Number(op.amount),
        isTaxable: op.paymentType.isTaxable
      }));

      const calcInput: CalculationInput = {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        pan: emp.pan,
        bankAccount: emp.bankAccounts[0]?.accountNumber,
        bankName: emp.bankAccounts[0]?.bankName,
        ifscCode: emp.bankAccounts[0]?.ifscCode,
        cityCategory: emp.cityCategory,
        basicPay: Number(assignment.basicPay),
        workingDays: 30,
        payableDays: Math.max(0, 30 - lopDays),
        leaveLossOfPayDays: lopDays,
        structureLines: assignment.structure.lines.map(l => ({
          salaryHeadId: l.salaryHeadId,
          headCode: l.salaryHead.code,
          headName: l.salaryHead.name,
          headType: l.salaryHead.type,
          calculationType: l.calculationType,
          baseHeadCode: l.baseHeadCode,
          percentage: l.percentage ? Number(l.percentage) : null,
          fixedAmount: l.fixedAmount ? Number(l.fixedAmount) : null,
          isTaxable: l.salaryHead.isTaxable,
          isLeaveImpacted: l.salaryHead.isLeaveImpacted
        })),
        activeLoanRecoveries: activeLoans,
        otherPayments: otherPay
      };

      const result = PayrollEngine.calculate(calcInput);
      totalGross = totalGross.plus(result.grossAmount);
      totalDeductions = totalDeductions.plus(result.deductionAmount);
      totalNet = totalNet.plus(result.netAmount);

      previewResults.push({
        employee: {
          id: emp.id,
          code: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          designation: emp.designation.name,
          department: emp.department.name
        },
        summary: result.calculationSnapshot.summary,
        lopDays,
        earnings: result.earnings,
        deductions: result.deductions
      });
    }

    res.status(200).json({
      period: { id: period.id, name: period.name, fy: period.financialYear.name },
      totalEmployees: previewResults.length,
      totals: {
        gross: Number(totalGross.toFixed(2)),
        deductions: Number(totalDeductions.toFixed(2)),
        net: Number(totalNet.toFixed(2))
      },
      preview: previewResults
    });
  } catch (error) {
    next(error);
  }
});

// Generate Real Payroll Run (PDA / Admin)
payrollRouter.post('/runs/generate', authenticate, requireRole(['payroll_pda', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      periodId: z.string().min(1),
      ouId: z.string().optional(),
      remarks: z.string().optional()
    });
    const { periodId, ouId, remarks } = schema.parse(req.body);

    const period = await prisma.payrollPeriod.findUnique({
      where: { id: periodId },
      include: { financialYear: true }
    });
    if (!period) throw new AppError('Period not found', 404);

    // Check existing run for period
    const existingRun = await prisma.payrollRun.findFirst({
      where: {
        institutionId: req.user!.institutionId,
        periodId,
        status: { in: ['GENERATED', 'VERIFIED', 'FINALIZED', 'APPROVED'] }
      }
    });

    if (existingRun && existingRun.status === 'APPROVED') {
      throw new AppError(`Payroll for ${period.name} is already APPROVED. Cannot regenerate.`, 400, 'ALREADY_APPROVED');
    }

    // Fetch employees
    const employees = await prisma.employee.findMany({
      where: {
        institutionId: req.user!.institutionId,
        active: true,
        ...(ouId ? { ouId } : {})
      },
      include: {
        designation: true,
        department: true,
        ou: true,
        salaryAssignments: {
          where: { active: true },
          include: {
            structure: {
              include: {
                lines: {
                  include: { salaryHead: true },
                  orderBy: { displayOrder: 'asc' }
                }
              }
            }
          },
          take: 1
        },
        loans: {
          where: { status: 'ACTIVE' },
          include: { loanType: true }
        },
        leaveRecords: {
          where: {
            status: 'APPROVED',
            fromDate: { lte: period.endDate },
            toDate: { gte: period.startDate }
          },
          include: { leaveType: true }
        },
        otherPayments: {
          where: {
            periodId: period.id,
            status: 'APPROVED'
          },
          include: { paymentType: true }
        },
        bankAccounts: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    if (employees.length === 0) {
      throw new AppError('No eligible active employees found for this period', 400);
    }

    const calculatedRecords: any[] = [];
    let grossTotal = new Decimal(0);
    let deductionsTotal = new Decimal(0);
    let netTotal = new Decimal(0);

    for (const emp of employees) {
      const assignment = emp.salaryAssignments[0];
      if (!assignment || !assignment.structure) continue;

      let lopDays = 0;
      for (const leave of emp.leaveRecords) {
        const ratio = Number(leave.leaveType.deductionRatio);
        lopDays += Number(leave.daysCount) * ratio;
      }

      const activeLoans = emp.loans.map(loan => ({
        loanId: loan.id,
        loanTypeCode: loan.loanType.code,
        loanTypeName: loan.loanType.name,
        installmentNumber: loan.recoveredInstallments + 1,
        monthlyInstallment: Number(loan.monthlyInstallment),
        outstandingAmount: Number(loan.outstandingAmount)
      }));

      const otherPay = emp.otherPayments.map(op => ({
        typeCode: op.paymentType.code,
        typeName: op.paymentType.name,
        amount: Number(op.amount),
        isTaxable: op.paymentType.isTaxable
      }));

      const calcInput: CalculationInput = {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        pan: emp.pan,
        bankAccount: emp.bankAccounts[0]?.accountNumber,
        bankName: emp.bankAccounts[0]?.bankName,
        ifscCode: emp.bankAccounts[0]?.ifscCode,
        cityCategory: emp.cityCategory,
        basicPay: Number(assignment.basicPay),
        workingDays: 30,
        payableDays: Math.max(0, 30 - lopDays),
        leaveLossOfPayDays: lopDays,
        structureLines: assignment.structure.lines.map(l => ({
          salaryHeadId: l.salaryHeadId,
          headCode: l.salaryHead.code,
          headName: l.salaryHead.name,
          headType: l.salaryHead.type,
          calculationType: l.calculationType,
          baseHeadCode: l.baseHeadCode,
          percentage: l.percentage ? Number(l.percentage) : null,
          fixedAmount: l.fixedAmount ? Number(l.fixedAmount) : null,
          isTaxable: l.salaryHead.isTaxable,
          isLeaveImpacted: l.salaryHead.isLeaveImpacted
        })),
        activeLoanRecoveries: activeLoans,
        otherPayments: otherPay
      };

      const result = PayrollEngine.calculate(calcInput);
      grossTotal = grossTotal.plus(result.grossAmount);
      deductionsTotal = deductionsTotal.plus(result.deductionAmount);
      netTotal = netTotal.plus(result.netAmount);

      calculatedRecords.push({ emp, result });
    }

    // Persist in transaction
    const newRun = await prisma.$transaction(async (tx) => {
      // If previous unfinalized run exists, remove it or increment version
      if (existingRun && existingRun.status === 'GENERATED') {
        await tx.payrollRun.delete({ where: { id: existingRun.id } });
      }

      const run = await tx.payrollRun.create({
        data: {
          institutionId: req.user!.institutionId,
          ouId: ouId ?? null,
          financialYearId: period.financialYearId,
          periodId: period.id,
          status: 'GENERATED',
          version: 1,
          totalEmployees: calculatedRecords.length,
          grossTotal: Number(grossTotal.toFixed(2)),
          deductionsTotal: Number(deductionsTotal.toFixed(2)),
          netTotal: Number(netTotal.toFixed(2)),
          generatedBy: req.user!.fullName,
          remarks
        }
      });

      // Insert transition log
      await tx.payrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: 'GENERATED',
          toStatus: 'GENERATED',
          actorId: req.user!.userId,
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] ?? 'payroll_pda',
          remarks: remarks ?? 'Initial payroll generation'
        }
      });

      // Insert records and lines
      for (const item of calculatedRecords) {
        const { emp, result } = item;
        const rec = await tx.payrollRecord.create({
          data: {
            payrollRunId: run.id,
            employeeId: emp.id,
            workingDays: result.workingDays,
            payableDays: result.payableDays,
            leaveLossOfPayDays: result.leaveLossOfPayDays,
            basicPay: Number(result.effectiveBasicPay.toFixed(2)),
            grossAmount: Number(result.grossAmount.toFixed(2)),
            deductionAmount: Number(result.deductionAmount.toFixed(2)),
            netAmount: Number(result.netAmount.toFixed(2)),
            calculationSnapshot: result.calculationSnapshot
          }
        });

        // Insert individual lines
        const linesToCreate = [
          ...result.earnings,
          ...result.deductions,
          ...result.employerContributions
        ];

        for (const line of linesToCreate) {
          // If synthetic head (like loan or other), use real BASIC head or skip relation
          const realHead = await tx.salaryHead.findFirst({
            where: { institutionId: req.user!.institutionId, code: line.headCode }
          });
          const headIdToUse = realHead ? realHead.id : (await tx.salaryHead.findFirst({ where: { institutionId: req.user!.institutionId } }))!.id;

          await tx.payrollLine.create({
            data: {
              payrollRecordId: rec.id,
              salaryHeadId: headIdToUse,
              headCode: line.headCode,
              headName: line.headName,
              headType: line.headType,
              amount: Number(line.amount.toFixed(2)),
              ruleVersion: '2.1.26',
              formulaNote: line.ruleExplanation
            }
          });
        }
      }

      return run;
    });

    await recordAudit(req, 'GENERATE_PAYROLL', 'PayrollRun', newRun.id, {
      period: period.name,
      totalEmployees: calculatedRecords.length,
      netTotal: Number(netTotal.toFixed(2))
    });

    res.status(201).json({
      message: `Payroll successfully generated for ${period.name}`,
      run: newRun
    });
  } catch (error) {
    next(error);
  }
});

// Stage Transition: Verify Payroll (PVO)
payrollRouter.post('/runs/:id/verify', authenticate, requireRole(['payroll_pvo', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { remarks } = req.body;
    const run = await prisma.payrollRun.findUnique({ where: { id: String(req.params.id) } });
    if (!run) throw new AppError('Run not found', 404);

    if (run.status !== 'GENERATED') {
      throw new AppError(`Cannot verify run in status ${run.status}. Must be GENERATED.`, 400, 'INVALID_WORKFLOW_STATE');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'VERIFIED',
          verifiedBy: req.user!.fullName,
          verifiedAt: new Date()
        }
      });

      await tx.payrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: 'GENERATED',
          toStatus: 'VERIFIED',
          actorId: req.user!.userId,
          actorName: req.user!.fullName,
          actorRole: 'payroll_pvo',
          remarks: remarks ?? 'Payroll verified by PVO'
        }
      });

      return u;
    });

    await recordAudit(req, 'VERIFY_PAYROLL', 'PayrollRun', run.id, { remarks });
    res.status(200).json({ message: 'Payroll run verified', run: updated });
  } catch (error) {
    next(error);
  }
});

// Stage Transition: Finalize Payroll (PFO)
payrollRouter.post('/runs/:id/finalize', authenticate, requireRole(['payroll_pfo', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { remarks } = req.body;
    const run = await prisma.payrollRun.findUnique({ where: { id: String(req.params.id) } });
    if (!run) throw new AppError('Run not found', 404);

    if (run.status !== 'VERIFIED') {
      throw new AppError(`Cannot finalize run in status ${run.status}. Must be VERIFIED.`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'FINALIZED',
          finalizedBy: req.user!.fullName,
          finalizedAt: new Date()
        }
      });

      await tx.payrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: 'VERIFIED',
          toStatus: 'FINALIZED',
          actorId: req.user!.userId,
          actorName: req.user!.fullName,
          actorRole: 'payroll_pfo',
          remarks: remarks ?? 'Payroll calculation snapshot frozen and finalized'
        }
      });

      return u;
    });

    await recordAudit(req, 'FINALIZE_PAYROLL', 'PayrollRun', run.id, { remarks });
    res.status(200).json({ message: 'Payroll run finalized', run: updated });
  } catch (error) {
    next(error);
  }
});

// Stage Transition: Approve Payroll (AR Salary Approver)
payrollRouter.post('/runs/:id/approve', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const remarks = req.body?.remarks;
    const runId = String(req.params.id);
    const run: any = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        records: {
          include: {
            employee: { include: { gpfAccount: true } }
          }
        },
        period: true
      }
    });
    if (!run) throw new AppError('Run not found', 404);

    if (run.status !== 'FINALIZED') {
      throw new AppError(`Cannot approve run in status ${run.status}. Must be FINALIZED.`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'APPROVED',
          approvedBy: req.user!.fullName,
          approvedAt: new Date()
        }
      });

      await tx.payrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: 'FINALIZED',
          toStatus: 'APPROVED',
          actorId: req.user!.userId,
          actorName: req.user!.fullName,
          actorRole: 'payroll_ar_salary',
          remarks: remarks ?? 'Payroll approved for bank disbursement'
        }
      });

      // Post GPF monthly deductions into GPF ledger for eligible employees
      for (const rec of run.records) {
        if (rec.employee.gpfAccount) {
          const snapshot = rec.calculationSnapshot as any;
          const gpfDeduction = snapshot?.breakdown?.deductions?.find((d: any) => d.code === 'GPF');
          if (gpfDeduction && gpfDeduction.amount > 0) {
            const currentBal = new Decimal(rec.employee.gpfAccount.currentBalance);
            const subAmount = new Decimal(gpfDeduction.amount);
            const newBal = currentBal.plus(subAmount);

            await tx.gpfTransaction.create({
              data: {
                gpfAccountId: rec.employee.gpfAccount.id,
                periodId: run.periodId,
                transactionType: 'MONTHLY_SUBSCRIPTION',
                amount: Number(subAmount.toFixed(2)),
                balanceAfter: Number(newBal.toFixed(2)),
                referenceNumber: `SAL-${run.period.name}`,
                remarks: `Salary deduction subscription for ${run.period.name}`
              }
            });

            await tx.gpfAccount.update({
              where: { id: rec.employee.gpfAccount.id },
              data: { currentBalance: Number(newBal.toFixed(2)) }
            });
          }
        }
      }

      return u;
    });

    await recordAudit(req, 'APPROVE_PAYROLL', 'PayrollRun', run.id, { remarks });
    res.status(200).json({ message: 'Payroll run approved', run: updated });
  } catch (error) {
    next(error);
  }
});

// Stage Transition: Return / Reject for correction
payrollRouter.post('/runs/:id/return', authenticate, requireRole(['payroll_pvo', 'payroll_pfo', 'payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { remarks } = req.body;
    if (!remarks) throw new AppError('Rejection reason / return remarks are required', 400);

    const run = await prisma.payrollRun.findUnique({ where: { id: String(req.params.id) } });
    if (!run) throw new AppError('Run not found', 404);

    if (run.status === 'APPROVED') {
      throw new AppError('Approved payroll cannot be returned. Requires formal reversal.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: 'RETURNED' }
      });

      await tx.payrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'RETURNED',
          actorId: req.user!.userId,
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] ?? 'officer',
          remarks
        }
      });

      return u;
    });

    await recordAudit(req, 'RETURN_PAYROLL', 'PayrollRun', run.id, { remarks });
    res.status(200).json({ message: 'Payroll returned for correction', run: updated });
  } catch (error) {
    next(error);
  }
});

// Single Record Details & Explanation
payrollRouter.get('/records/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: {
          include: {
            designation: true,
            department: true,
            ou: true,
            bankAccounts: { where: { isPrimary: true } }
          }
        },
        payrollRun: {
          include: { period: true, financialYear: true }
        },
        lines: true
      }
    });

    if (!record) throw new AppError('Payroll record not found', 404);

    // If employee self service, verify ownership
    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      if (req.user!.employeeId !== record.employeeId) {
        throw new AppError('Access denied: You cannot view another employee\'s payroll record', 403);
      }
    }

    res.status(200).json({ record });
  } catch (error) {
    next(error);
  }
});

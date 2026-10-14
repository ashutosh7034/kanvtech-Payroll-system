import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const selfServiceRouter = Router();

// Employee Self-Service Dashboard Profile
selfServiceRouter.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('No employee profile linked to current account', 400);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        ou: true,
        department: true,
        designation: true,
        employeeGroup: true,
        bankAccounts: { where: { isPrimary: true } },
        salaryAssignments: {
          where: { active: true },
          include: { structure: true, payLevel: true, payMatrixCell: true },
          take: 1
        },
        gpfAccount: true,
        loans: { where: { status: 'ACTIVE' }, include: { loanType: true } }
      }
    });

    if (!employee) throw new AppError('Employee record not found', 404);

    res.status(200).json({ profile: employee });
  } catch (error) {
    next(error);
  }
});

// Employee Own Payslips
selfServiceRouter.get('/payslips', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('No employee profile linked to current account', 400);

    const records = await prisma.payrollRecord.findMany({
      where: {
        employeeId,
        payrollRun: { status: { in: ['FINALIZED', 'APPROVED'] } }
      },
      include: {
        payrollRun: {
          include: { period: true, financialYear: true }
        },
        lines: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format payslip cards
    const payslips = records.map(r => ({
      recordId: r.id,
      runId: r.payrollRunId,
      periodName: r.payrollRun.period.name,
      financialYear: r.payrollRun.financialYear.name,
      workingDays: r.workingDays,
      payableDays: r.payableDays,
      basicPay: Number(r.basicPay),
      grossAmount: Number(r.grossAmount),
      deductionAmount: Number(r.deductionAmount),
      netAmount: Number(r.netAmount),
      status: r.payrollRun.status,
      approvedAt: r.payrollRun.approvedAt,
      snapshot: r.calculationSnapshot
    }));

    res.status(200).json({ payslips });
  } catch (error) {
    next(error);
  }
});

// Detailed Payslip View for a Single Record (with Masking based on Institution settings)
selfServiceRouter.get('/payslips/:recordId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recordId = String(req.params.recordId);
    const record: any = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: {
          include: {
            ou: true,
            department: true,
            designation: true,
            bankAccounts: { where: { isPrimary: true } },
            gpfAccount: true,
            institution: { include: { settings: true } }
          }
        },
        payrollRun: {
          include: { period: true, financialYear: true }
        },
        lines: true
      }
    });

    if (!record) throw new AppError('Payslip record not found', 404);

    // If regular employee, verify ownership
    if (req.user!.roles.includes('employee_self_service') && !req.user!.roles.includes('payroll_admin')) {
      if (req.user!.employeeId !== record.employeeId) {
        throw new AppError('Access denied: You cannot view another employee\'s payslip', 403);
      }
    }

    const settingsMap = new Map(record.employee.institution.settings.map((s: any) => [s.key, s.value]));
    const maskPan = settingsMap.get('mask_pan') !== 'false';
    const maskBank = settingsMap.get('mask_bank') !== 'false';
    const showContributions = settingsMap.get('show_employer_contributions') !== 'false';

    const bank = record.employee.bankAccounts[0];
    const displayAccount = maskBank ? bank?.maskedAccount : bank?.accountNumber;
    const displayPan = maskPan ? record.employee.maskedPan : record.employee.pan;

    const earnings = record.lines.filter((l: any) => l.headType === 'EARNING').map((l: any) => ({
      code: l.headCode,
      name: l.headName,
      amount: Number(l.amount)
    }));

    const deductions = record.lines.filter((l: any) => l.headType === 'DEDUCTION').map((l: any) => ({
      code: l.headCode,
      name: l.headName,
      amount: Number(l.amount)
    }));

    const employerContributions = showContributions
      ? record.lines.filter((l: any) => l.headType === 'EMPLOYER_CONTRIBUTION').map((l: any) => ({
          code: l.headCode,
          name: l.headName,
          amount: Number(l.amount)
        }))
      : [];

    res.status(200).json({
      payslip: {
        institution: {
          name: record.employee.institution.name,
          brandName: record.employee.institution.brandName ?? record.employee.institution.name,
          logoUrl: record.employee.institution.logoUrl,
          currency: record.employee.institution.currencySymbol
        },
        period: record.payrollRun.period.name,
        financialYear: record.payrollRun.financialYear.name,
        employee: {
          code: record.employee.employeeCode,
          name: `${record.employee.firstName} ${record.employee.lastName}`,
          designation: record.employee.designation.name,
          department: record.employee.department.name,
          ou: record.employee.ou.name,
          pan: displayPan,
          bankName: bank?.bankName ?? 'N/A',
          accountNumber: displayAccount,
          ifscCode: bank?.ifscCode ?? 'N/A',
          gpfNumber: record.employee.gpfAccount?.accountNumber ?? 'N/A'
        },
        attendance: {
          workingDays: record.workingDays,
          payableDays: record.payableDays,
          lossOfPayDays: Number(record.leaveLossOfPayDays)
        },
        earnings,
        deductions,
        employerContributions,
        grossAmount: Number(record.grossAmount),
        deductionAmount: Number(record.deductionAmount),
        netAmount: Number(record.netAmount),
        generatedDate: record.createdAt,
        approvedDate: record.payrollRun.approvedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

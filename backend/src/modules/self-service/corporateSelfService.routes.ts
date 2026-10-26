import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const corporateSelfServiceRouter = Router();

// 1. ESS Dashboard Metrics
corporateSelfServiceRouter.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.status(200).json({
        profile: {
          id: req.user!.userId,
          employeeCode: 'ADMIN',
          fullName: req.user!.fullName,
          email: req.user!.email,
          department: 'Administration',
          designation: 'System Administrator',
          branch: 'HQ Mumbai',
          dateOfJoining: new Date(),
          status: 'CONFIRMED',
          annualCtc: 0,
          monthlyGross: 0,
          payrollPolicy: null
        },
        leaveBalances: [],
        latestSlip: null,
        pendingRequests: {
          leaves: 0,
          expenses: 0
        }
      });
      return;
    }

    const [employee, leaveBalances, latestSlip, pendingLeaves, pendingClaims] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          department: true,
          designation: true,
          branch: true,
          salaryStructure: true,
          payrollPolicy: true
        }
      }),
      prisma.employeeLeaveBalance.findMany({
        where: { employeeId },
        include: { leavePolicy: true }
      }),
      prisma.corporatePayrollSlip.findFirst({
        where: { employeeId },
        include: {
          payrollRun: { include: { period: true } },
          items: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.leaveRequest.count({
        where: { employeeId, status: 'PENDING' }
      }),
      prisma.expenseClaim.count({
        where: { employeeId, status: 'PENDING' }
      })
    ]);

    if (!employee) throw new AppError('Employee not found', 404);

    res.status(200).json({
      profile: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: `${employee.firstName} ${employee.lastName}`,
        email: employee.workEmail,
        department: employee.department.name,
        designation: employee.designation.name,
        branch: employee.branch.name,
        dateOfJoining: employee.dateOfJoining,
        status: employee.status,
        annualCtc: employee.salaryStructure?.annualCtc,
        monthlyGross: employee.salaryStructure?.monthlyGross,
        payrollPolicy: employee.payrollPolicy
      },
      leaveBalances,
      latestSlip,
      pendingRequests: {
        leaves: pendingLeaves,
        expenses: pendingClaims
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. My Payslips Catalog
corporateSelfServiceRouter.get('/payslips', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.status(200).json({ slips: [] });
      return;
    }

    const slips = await prisma.corporatePayrollSlip.findMany({
      where: { employeeId },
      include: {
        payrollRun: { include: { period: true } },
        items: true,
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            panNumber: true,
            bankAccountNumber: true,
            bankName: true,
            ifscCode: true,
            designation: { select: { name: true } },
            department: { select: { name: true } },
            branch: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ slips });
  } catch (error) {
    next(error);
  }
});

// 3. Single Payslip Details with Server-Enforced Boundary
corporateSelfServiceRouter.get('/payslips/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slipId = String(req.params.id);
    const slip = await prisma.corporatePayrollSlip.findUnique({
      where: { id: slipId },
      include: {
        payrollRun: {
          include: { period: true, company: true }
        },
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

    if (!slip) throw new AppError('Payslip not found', 404);

    // Enforce role and employee isolation boundary
    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'payroll_admin', 'finance_admin', 'hr_manager'].includes(r)
    );

    if (!isPrivileged && slip.employeeId !== req.user!.employeeId) {
      throw new AppError('Access denied: You are not authorized to view another employee’s payslip.', 403, 'FORBIDDEN');
    }

    res.status(200).json({ slip });
  } catch (error) {
    next(error);
  }
});

// 3b. Real PDF Payslip Generator & Stream
corporateSelfServiceRouter.get('/payslips/:id/pdf', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slipId = String(req.params.id);
    const slip = await prisma.corporatePayrollSlip.findUnique({
      where: { id: slipId },
      include: {
        payrollRun: {
          include: { period: true, company: true }
        },
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

    if (!slip) throw new AppError('Payslip not found', 404);

    // Enforce role and employee isolation boundary
    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'payroll_admin', 'finance_admin', 'hr_manager'].includes(r)
    );

    if (!isPrivileged && slip.employeeId !== req.user!.employeeId) {
      throw new AppError('Access denied: You are not authorized to download another employee’s payslip.', 403, 'FORBIDDEN');
    }

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

// 4. Tax Declarations (Accept both singular and plural routes)
const handleGetTaxDeclaration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.status(200).json({ declaration: null });
      return;
    }

    const declaration = await prisma.employeeTaxDeclaration.findFirst({
      where: { employeeId },
      orderBy: { submittedAt: 'desc' }
    });

    res.status(200).json({ declaration });
  } catch (error) {
    next(error);
  }
};

const handlePostTaxDeclaration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee record required', 400);

    const schema = z.object({
      financialYear: z.string().default('2026-2027'),
      regime: z.enum(['OLD', 'NEW']).default('NEW'),
      section80C: z.number().default(0),
      section80D: z.number().default(0),
      section24b: z.number().default(0),
      hraRentPaid: z.number().default(0)
    });
    const data = schema.parse(req.body);

    const declaration = await prisma.employeeTaxDeclaration.create({
      data: {
        employeeId,
        financialYear: data.financialYear,
        regime: data.regime,
        section80C: new Decimal(data.section80C),
        section80D: new Decimal(data.section80D),
        section24b: new Decimal(data.section24b),
        hraRentPaid: new Decimal(data.hraRentPaid),
        status: 'SUBMITTED'
      }
    });

    // Also update taxRegime on employee payroll policy if present
    await prisma.employeePayrollPolicy.updateMany({
      where: { employeeId },
      data: { taxRegime: data.regime }
    });

    res.status(201).json({ declaration });
  } catch (error) {
    next(error);
  }
};

corporateSelfServiceRouter.get('/tax-declaration', authenticate, handleGetTaxDeclaration);
corporateSelfServiceRouter.get('/tax-declarations', authenticate, handleGetTaxDeclaration);
corporateSelfServiceRouter.post('/tax-declaration', authenticate, handlePostTaxDeclaration);
corporateSelfServiceRouter.post('/tax-declarations', authenticate, handlePostTaxDeclaration);

// 5. ESS Employee Loans & Advances (VID-28)
corporateSelfServiceRouter.get('/loans', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.status(200).json({
        loans: [],
        availableTypes: [],
        summary: {
          activeLoansCount: 0,
          totalPrincipal: 0,
          totalRecovered: 0,
          totalOutstanding: 0,
          monthlyEmiTotal: 0
        }
      });
      return;
    }

    const [loans, availableTypes] = await Promise.all([
      prisma.employeeLoan.findMany({
        where: { employeeId },
        include: {
          loanType: true,
          repayments: {
            orderBy: { paidDate: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.loanType.findMany({
        where: { companyId: req.user!.companyId },
        orderBy: { code: 'asc' }
      })
    ]);

    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const totalPrincipal = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.principalAmount)), new Decimal(0));
    const totalRecovered = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.recoveredAmount)), new Decimal(0));
    const totalOutstanding = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.outstandingAmount)), new Decimal(0));
    const monthlyEmiTotal = activeLoans.reduce((acc, l) => acc.plus(new Decimal(l.monthlyEmi)), new Decimal(0));

    res.status(200).json({
      loans,
      availableTypes,
      summary: {
        activeLoansCount: activeLoans.length,
        totalPrincipal: totalPrincipal.toNumber(),
        totalRecovered: totalRecovered.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        monthlyEmiTotal: monthlyEmiTotal.toNumber()
      }
    });
  } catch (error) {
    next(error);
  }
});

// 6. ESS Apply for Loan / Salary Advance (VID-28)
corporateSelfServiceRouter.post('/loans/request', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('Employee record required', 400);

    const schema = z.object({
      loanTypeId: z.string().uuid(),
      principalAmount: z.number().positive(),
      tenureMonths: z.number().int().min(1).max(60),
      reason: z.string().optional()
    });

    const parsed = schema.parse(req.body);

    const loanType = await prisma.loanType.findFirst({
      where: { id: parsed.loanTypeId, companyId: req.user!.companyId }
    });
    if (!loanType) throw new AppError('Invalid loan type', 404);

    if (new Decimal(parsed.principalAmount).gt(loanType.maxAmount)) {
      throw new AppError(`Principal exceeds maximum allowed limit of ₹${loanType.maxAmount}`, 400);
    }
    if (parsed.tenureMonths > loanType.maxTenureMonths) {
      throw new AppError(`Tenure exceeds maximum allowed of ${loanType.maxTenureMonths} months`, 400);
    }

    const principal = new Decimal(parsed.principalAmount);
    const monthlyEmi = principal.dividedBy(parsed.tenureMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId,
        loanTypeId: parsed.loanTypeId,
        principalAmount: principal,
        monthlyEmi,
        tenureMonths: parsed.tenureMonths,
        recoveredAmount: new Decimal(0),
        outstandingAmount: principal,
        status: 'PENDING'
      },
      include: {
        loanType: true
      }
    });

    await recordAudit(req, 'REQUEST_LOAN', 'EmployeeLoan', loan.id, {
      employeeId,
      principal: principal.toNumber(),
      emi: monthlyEmi.toNumber(),
      reason: parsed.reason || 'Employee Self-Service application'
    });

    res.status(201).json({
      loan,
      message: 'Loan application submitted successfully. Pending HR/Finance approval.'
    });
  } catch (error) {
    next(error);
  }
});


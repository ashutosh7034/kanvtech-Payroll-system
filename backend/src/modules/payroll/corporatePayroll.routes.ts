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

// 1.3 Preview Eligible Employees for Department or Group (Must precede /runs/:id)
corporatePayrollRouter.get('/runs/preview-eligible', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const periodId = String(req.query.periodId || '');
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    if (!periodId) {
      throw new AppError('periodId query parameter is required', 400);
    }

    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError('Payroll period not found', 404);

    const employeeWhere: any = {
      companyId: req.user!.companyId,
      status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
      dateOfJoining: { lte: period.endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: period.startDate } }
      ]
    };

    if (departmentId && departmentId !== 'ALL') {
      employeeWhere.departmentId = departmentId;
    }
    if (branchId && branchId !== 'ALL') {
      employeeWhere.branchId = branchId;
    }
    if (search) {
      employeeWhere.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        salaryStructure: {
          select: {
            id: true,
            monthlyGross: true,
            annualCtc: true,
            lines: {
              select: { id: true }
            }
          }
        },
        payrollPolicy: true
      },
      orderBy: { employeeCode: 'asc' }
    });

    // Check which employees already have slips in this period
    const existingSlips = await prisma.corporatePayrollSlip.findMany({
      where: {
        employeeId: { in: employees.map(e => e.id) },
        payrollRun: {
          periodId,
          companyId: req.user!.companyId,
          status: { in: ['VALIDATED', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAYMENT_READY', 'PAID'] }
        }
      },
      include: {
        payrollRun: { select: { id: true, runNumber: true, status: true } }
      }
    });

    const slipMap = new Map<string, any>();
    for (const s of existingSlips) {
      slipMap.set(s.employeeId, s.payrollRun);
    }

    const enriched = employees.map(emp => {
      const hasSalaryStructure = Boolean(emp.salaryStructure && emp.salaryStructure.lines.length > 0);
      const alreadyProcessedRun = slipMap.get(emp.id) || null;
      let isEligible = true;
      let ineligibilityReason: string | null = null;

      if (!hasSalaryStructure) {
        isEligible = false;
        ineligibilityReason = 'Missing salary structure (CTC not configured)';
      } else if (alreadyProcessedRun) {
        isEligible = false;
        ineligibilityReason = `Already included in active run ${alreadyProcessedRun.runNumber} (${alreadyProcessedRun.status})`;
      }

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department,
        designation: emp.designation,
        branch: emp.branch,
        hasSalaryStructure,
        monthlyGross: emp.salaryStructure?.monthlyGross ? Number(emp.salaryStructure.monthlyGross) : 0,
        annualCtc: emp.salaryStructure?.annualCtc ? Number(emp.salaryStructure.annualCtc) : 0,
        status: emp.status,
        isEligible,
        ineligibilityReason,
        alreadyProcessedRun
      };
    });

    // Get departments and branches for filters
    const [departments, branches] = await Promise.all([
      prisma.department.findMany({ where: { companyId: req.user!.companyId }, select: { id: true, name: true } }),
      prisma.branch.findMany({ where: { companyId: req.user!.companyId }, select: { id: true, name: true } })
    ]);

    const eligibleCount = enriched.filter(e => e.isEligible).length;
    const missingStructureCount = enriched.filter(e => !e.hasSalaryStructure).length;
    const alreadyProcessedCount = enriched.filter(e => Boolean(e.alreadyProcessedRun)).length;

    res.status(200).json({
      period,
      totalCount: enriched.length,
      eligibleCount,
      missingStructureCount,
      alreadyProcessedCount,
      employees: enriched,
      departments,
      branches
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 1.3b DEPARTMENT PAYROLL PROCESS WORKSPACE (PHASE B, C, D, E)
// ==========================================
corporatePayrollRouter.get('/department/workspace', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      periodId,
      departmentId,
      employeeId,
      status: employmentStatus,
      eligibility,
      processingStatus,
      search
    } = req.query;

    if (!periodId) {
      throw new AppError('Payroll periodId is required', 400);
    }

    const companyId = req.user!.companyId;

    // 1. Fetch Payroll Period
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: String(periodId), companyId }
    });
    if (!period) {
      throw new AppError('Payroll period not found for this organization', 404);
    }

    // 2. Fetch Department details if provided
    let department: any = null;
    if (departmentId && departmentId !== 'ALL') {
      department = await prisma.department.findFirst({
        where: { id: String(departmentId), companyId }
      });
      if (!department) {
        throw new AppError('Selected department not found or unauthorized', 404);
      }
    }

    // 3. Find active or existing CorporatePayrollRun for this period & department
    const runsForPeriod = await prisma.corporatePayrollRun.findMany({
      where: { companyId, periodId: period.id },
      include: {
        period: true,
        transitions: { orderBy: { timestamp: 'desc' }, take: 10 },
        slips: {
          include: {
            items: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeRun = runsForPeriod.find(r => {
      if (!departmentId || departmentId === 'ALL') return true;
      const scope = (r.validationNotes as any)?.scope;
      return scope?.type === 'DEPARTMENT' && scope?.departmentId === String(departmentId);
    }) || runsForPeriod[0] || null;

    // Map slips by employeeId
    const slipMap = new Map<string, any>();
    if (activeRun && activeRun.slips) {
      for (const slip of activeRun.slips) {
        slipMap.set(slip.employeeId, slip);
      }
    }

    // Also find any locked/paid slips in other runs for duplicate prevention
    const otherRunsSlips = await prisma.corporatePayrollSlip.findMany({
      where: {
        payrollRun: {
          companyId,
          periodId: period.id,
          id: activeRun ? { not: activeRun.id } : undefined,
          status: { in: ['APPROVED', 'PAYMENT_READY', 'PAID'] }
        }
      },
      include: {
        payrollRun: { select: { id: true, runNumber: true, status: true } }
      }
    });
    const finalizedInOtherRunMap = new Map<string, any>();
    for (const s of otherRunsSlips) {
      finalizedInOtherRunMap.set(s.employeeId, s.payrollRun);
    }

    // 4. Fetch Employees in scope
    const employeeWhere: any = {
      companyId
    };

    if (departmentId && departmentId !== 'ALL') {
      employeeWhere.departmentId = String(departmentId);
    }
    if (employeeId && String(employeeId) !== 'ALL') {
      employeeWhere.id = String(employeeId);
    }
    if (employmentStatus && employmentStatus !== 'ALL') {
      employeeWhere.status = String(employmentStatus);
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      employeeWhere.OR = [
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [employees, ptSlabs, statutoryConfig, departmentsList] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        include: {
          department: true,
          designation: true,
          branch: true,
          salaryStructure: {
            include: {
              template: { select: { name: true } },
              lines: {
                include: { component: true },
                orderBy: { component: { displayOrder: 'asc' } }
              }
            }
          },
          payrollPolicy: true,
          loans: {
            where: { status: 'ACTIVE' },
            include: { loanType: true }
          }
        },
        orderBy: { employeeCode: 'asc' }
      }),
      prisma.professionalTaxSlab.findMany(),
      prisma.statutoryConfig.findUnique({ where: { companyId } }),
      prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, code: true } })
    ]);

    // 5. Evaluate Eligibility & Calculate Preview
    const evaluatedRows: any[] = [];

    for (const emp of employees) {
      const ineligibilityReasons: string[] = [];
      const validStatuses = ['ACTIVE', 'CONFIRMED', 'PROBATION'];

      // Check Employment Status
      if (!validStatuses.includes(emp.status)) {
        ineligibilityReasons.push(`Employee status is ${emp.status} (only ACTIVE, CONFIRMED, or PROBATION employees are eligible)`);
      }

      // Check Date of Joining
      if (new Date(emp.dateOfJoining) > new Date(period.endDate)) {
        ineligibilityReasons.push(`Date of joining (${new Date(emp.dateOfJoining).toISOString().split('T')[0]}) is after period end date (${new Date(period.endDate).toISOString().split('T')[0]})`);
      }

      // Check Exit Date
      if (emp.exitDate && new Date(emp.exitDate) < new Date(period.startDate)) {
        ineligibilityReasons.push(`Employee exited on ${new Date(emp.exitDate).toISOString().split('T')[0]} prior to pay period start`);
      }

      // Check Salary Structure
      const hasStructure = Boolean(emp.salaryStructure && emp.salaryStructure.lines && emp.salaryStructure.lines.length > 0);
      if (!hasStructure) {
        ineligibilityReasons.push('Missing active salary structure (CTC components not configured)');
      } else {
        if (new Date(emp.salaryStructure!.effectiveFrom) > new Date(period.endDate)) {
          ineligibilityReasons.push(`Salary structure effective date (${new Date(emp.salaryStructure!.effectiveFrom).toISOString().split('T')[0]}) is after period end date`);
        }
        if (emp.salaryStructure!.effectiveTo && new Date(emp.salaryStructure!.effectiveTo) < new Date(period.startDate)) {
          ineligibilityReasons.push(`Salary structure expired on ${new Date(emp.salaryStructure!.effectiveTo).toISOString().split('T')[0]}`);
        }
      }

      // Check Prior Finalized Runs (Duplicate Prevention)
      const priorRun = finalizedInOtherRunMap.get(emp.id);
      if (priorRun) {
        ineligibilityReasons.push(`Already finalized in locked payroll run ${priorRun.runNumber} (${priorRun.status})`);
      }

      // Evaluate Attendance & Loss of Pay
      let att: any = {
        calendarDays: 30,
        workingDays: 30,
        payableDays: new Decimal(30),
        lopDays: new Decimal(0),
        notes: [] as string[]
      };

      try {
        att = await PayrollCalculationEngine.evaluateAttendance(emp, period);
      } catch (attErr) {
        console.warn(`Attendance evaluation fallback for ${emp.employeeCode}:`, attErr);
      }

      if (new Decimal(att.payableDays).isZero()) {
        ineligibilityReasons.push(`Zero payable days in period (${att.lopDays.toString()} LOP days recorded)`);
      }

      const isEligible = ineligibilityReasons.length === 0;

      // Calculation values
      const existingSlip = slipMap.get(emp.id);
      let gross = 0;
      let deductions = 0;
      let netPay = 0;
      let employerCost = 0;
      let items: any[] = [];
      let payableDays = att.payableDays.toNumber();
      let lopDays = att.lopDays.toNumber();
      let processingStatusVal = 'PENDING';

      if (existingSlip) {
        gross = Number(existingSlip.grossPay);
        deductions = Number(existingSlip.deductionsPay);
        netPay = Number(existingSlip.netPay);
        employerCost = Number(existingSlip.employerCost);
        payableDays = Number(existingSlip.payableDays);
        lopDays = Number(existingSlip.lopDays);
        processingStatusVal = 'PROCESSED';
        items = (existingSlip.items || []).map((it: any) => ({
          code: it.code,
          name: it.name,
          type: it.type,
          amount: Number(it.amount)
        }));
      } else if (hasStructure) {
        try {
          const calc = await PayrollCalculationEngine.calculateEmployee(
            emp,
            period,
            ptSlabs,
            statutoryConfig
          );
          gross = calc.grossPay.toNumber();
          deductions = calc.deductionsPay.toNumber();
          netPay = calc.netPay.toNumber();
          employerCost = calc.employerCost.toNumber();
          payableDays = calc.attendance.payableDays.toNumber();
          lopDays = calc.attendance.lopDays.toNumber();
          items = calc.items.map(it => ({
            code: it.code,
            name: it.name,
            type: it.type,
            amount: it.calculatedAmount.toNumber(),
            ruleApplied: it.ruleApplied
          }));
          processingStatusVal = isEligible ? 'PENDING' : 'INELIGIBLE';
          if (calc.netPay.isNegative()) {
            processingStatusVal = 'FAILED';
          }
        } catch (calcErr: any) {
          processingStatusVal = 'FAILED';
          ineligibilityReasons.push(`Calculation error: ${calcErr?.message || 'Unable to compute pay lines'}`);
        }
      } else {
        gross = 0;
        deductions = 0;
        netPay = 0;
        employerCost = 0;
        items = [];
        processingStatusVal = 'INELIGIBLE';
      }

      // Check filtering criteria
      if (eligibility && eligibility !== 'ALL') {
        if (eligibility === 'ELIGIBLE' && !isEligible) continue;
        if (eligibility === 'INELIGIBLE' && isEligible) continue;
      }
      if (processingStatus && processingStatus !== 'ALL') {
        if (processingStatus !== processingStatusVal) continue;
      }

      const structName = emp.salaryStructure?.template?.name ||
        (hasStructure ? `CTC ₹${Number(emp.salaryStructure!.monthlyGross).toLocaleString('en-IN')}/mo` : 'No Structure');

      evaluatedRows.push({
        id: emp.id,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
        department: emp.department?.name || 'General',
        departmentId: emp.departmentId,
        designation: emp.designation?.name || 'Staff',
        status: emp.status,
        employmentStatus: emp.status,
        isEligible,
        payrollEligibility: isEligible ? 'ELIGIBLE' : 'INELIGIBLE',
        ineligibilityReasons,
        salaryStructure: structName,
        monthlyGrossConfigured: emp.salaryStructure?.monthlyGross ? Number(emp.salaryStructure.monthlyGross) : 0,
        annualCtc: emp.salaryStructure?.annualCtc ? Number(emp.salaryStructure.annualCtc) : 0,
        payableDays,
        lopDays,
        calendarDays: Number(att.calendarDays),
        earnings: gross,
        grossEarnings: gross,
        deductions,
        totalDeductions: deductions,
        netPay,
        employerCost,
        processingStatus: processingStatusVal,
        items,
        slipId: existingSlip?.id || null
      });
    }

    // 6. Compute Aggregated Summary Cards
    const totalEmployees = evaluatedRows.length;
    const eligibleCount = evaluatedRows.filter(r => r.isEligible).length;
    const ineligibleCount = evaluatedRows.filter(r => !r.isEligible).length;
    const processedCount = evaluatedRows.filter(r => r.processingStatus === 'PROCESSED').length;
    const pendingCount = evaluatedRows.filter(r => r.processingStatus === 'PENDING').length;
    const failedCount = evaluatedRows.filter(r => r.processingStatus === 'FAILED').length;

    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalNetPay = new Decimal(0);
    let totalEmployerCost = new Decimal(0);

    for (const row of evaluatedRows) {
      if (row.isEligible || row.processingStatus === 'PROCESSED') {
        totalGross = totalGross.plus(row.earnings || 0);
        totalDeductions = totalDeductions.plus(row.deductions || 0);
        totalNetPay = totalNetPay.plus(row.netPay || 0);
        totalEmployerCost = totalEmployerCost.plus(row.employerCost || 0);
      }
    }

    res.status(200).json({
      period,
      department,
      departments: departmentsList,
      activeRun,
      summary: {
        totalEmployees,
        eligibleCount,
        ineligibleCount,
        processedCount,
        pendingCount,
        failedCount,
        totalGross: totalGross.toNumber(),
        totalDeductions: totalDeductions.toNumber(),
        totalNetPay: totalNetPay.toNumber(),
        totalEmployerCost: totalEmployerCost.toNumber()
      },
      employees: evaluatedRows
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 1.3c PROCESS DEPARTMENT PAYROLL BATCH (PHASE E, F)
// ==========================================
corporatePayrollRouter.post('/department/process', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      periodId: z.string().uuid(),
      departmentId: z.string().uuid(),
      selectedEmployeeIds: z.array(z.string().uuid()).optional(),
      remarks: z.string().optional()
    });

    const parsed = schema.parse(req.body);
    const companyId = req.user!.companyId;

    // 1. Validate Period
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: parsed.periodId, companyId }
    });
    if (!period) throw new AppError('Payroll period not found for this organization', 404);
    if (period.isLocked) throw new AppError('Payroll period is locked and cannot be processed', 400);

    // 2. Validate Department
    const department = await prisma.department.findFirst({
      where: { id: parsed.departmentId, companyId }
    });
    if (!department) throw new AppError('Department not found or belongs to another organization', 404);

    // 3. Check for existing runs to enforce duplicate prevention and idempotency
    const existingRuns = await prisma.corporatePayrollRun.findMany({
      where: { companyId, periodId: period.id },
      include: { slips: true }
    });

    const deptRun = existingRuns.find(r => {
      const scope = (r.validationNotes as any)?.scope;
      return scope?.type === 'DEPARTMENT' && scope?.departmentId === department.id;
    });

    if (deptRun) {
      if (deptRun.status === 'PAID') {
        throw new AppError(`Department payroll for ${department.name} in ${period.name} is already PAID and locked.`, 400);
      }
      if (deptRun.status === 'APPROVED') {
        throw new AppError(`Department payroll for ${department.name} is already APPROVED. Reopening requires authorized recalculation.`, 400);
      }
    }

    // 4. Query employees in target department
    const employeeWhere: any = {
      companyId,
      departmentId: department.id,
      status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
      dateOfJoining: { lte: period.endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: period.startDate } }
      ]
    };

    if (parsed.selectedEmployeeIds && parsed.selectedEmployeeIds.length > 0) {
      employeeWhere.id = { in: parsed.selectedEmployeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
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
      },
      orderBy: { employeeCode: 'asc' }
    });

    // Filter to eligible candidates with active structures
    const eligibleEmployees = employees.filter(e => Boolean(e.salaryStructure && e.salaryStructure.lines && e.salaryStructure.lines.length > 0));
    if (eligibleEmployees.length === 0) {
      throw new AppError(`No eligible employees with active salary structures found in department ${department.name}.`, 400);
    }

    // 5. Fetch statutory and PT configurations
    const [statutoryConfig, ptSlabs] = await Promise.all([
      prisma.statutoryConfig.findUnique({ where: { companyId } }),
      prisma.professionalTaxSlab.findMany()
    ]);

    // 6. Create or reuse CorporatePayrollRun
    let runId: string;
    let initialStatus: any = 'DRAFT';

    if (deptRun) {
      runId = deptRun.id;
      initialStatus = deptRun.status;
      await prisma.corporatePayrollRun.update({
        where: { id: runId },
        data: {
          status: 'VALIDATED',
          validatedBy: req.user!.fullName,
          validatedAt: new Date()
        }
      });
    } else {
      const runNumber = `PR-${period.year}${String(period.month).padStart(2, '0')}-DEPT-${department.code || department.id.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const createdRun = await prisma.corporatePayrollRun.create({
        data: {
          companyId,
          periodId: period.id,
          runNumber,
          status: 'VALIDATED',
          validatedBy: req.user!.fullName,
          validatedAt: new Date(),
          totalEmployees: eligibleEmployees.length,
          validationNotes: {
            scope: {
              type: 'DEPARTMENT',
              departmentId: department.id,
              departmentName: department.name,
              targetCount: eligibleEmployees.length,
              selectedEmployeeIds: parsed.selectedEmployeeIds || eligibleEmployees.map(e => e.id)
            },
            remarks: parsed.remarks || `Department batch for ${department.name}`
          }
        }
      });
      runId = createdRun.id;

      await prisma.corporatePayrollTransition.create({
        data: {
          payrollRunId: runId,
          fromStatus: 'DRAFT',
          toStatus: 'VALIDATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Initialized & validated department batch for ${department.name}`
        }
      });
    }

    // 7. Execute transactional calculations with per-employee outcome recording
    let totalGross = new Decimal(0);
    let totalDeductions = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalEmployer = new Decimal(0);

    const outcomes: any[] = [];

    const updatedRun = await prisma.$transaction(async (tx) => {
      // Clear existing slips for the employees being processed
      await tx.corporatePayrollSlip.deleteMany({
        where: {
          payrollRunId: runId,
          employeeId: { in: eligibleEmployees.map(e => e.id) }
        }
      });

      for (const emp of eligibleEmployees) {
        try {
          const result = await PayrollCalculationEngine.calculateEmployee(
            emp,
            period,
            ptSlabs,
            statutoryConfig
          );

          totalGross = totalGross.plus(result.grossPay);
          totalDeductions = totalDeductions.plus(result.deductionsPay);
          totalNet = totalNet.plus(result.netPay);
          totalEmployer = totalEmployer.plus(result.employerCost);

          const slip = await tx.corporatePayrollSlip.create({
            data: {
              payrollRunId: runId,
              employeeId: emp.id,
              workingDays: Number(result.attendance.calendarDays),
              payableDays: result.attendance.payableDays.toNumber(),
              lopDays: result.attendance.lopDays.toNumber(),
              unpaidDays: result.attendance.unpaidMidMonthDays.toNumber(),
              arrearsAmount: 0,
              reimbursementAmount: 0,
              variableEarnings: 0,
              pfWageBasis: result.pfWageBasis.toNumber(),
              esiWageBasis: result.esiWageBasis.toNumber(),
              ptWageBasis: result.ptWageBasis.toNumber(),
              grossPay: result.grossPay.toNumber(),
              deductionsPay: result.deductionsPay.toNumber(),
              netPay: result.netPay.toNumber(),
              employerCost: result.employerCost.toNumber(),
              calculationSnapshot: {
                attendance: result.attendance as any,
                exceptions: result.exceptions,
                calculatedAt: new Date().toISOString()
              },
              items: {
                create: result.items.map(i => ({
                  code: i.code,
                  name: i.name,
                  type: i.type,
                  amount: i.calculatedAmount.toNumber()
                }))
              }
            }
          });

          outcomes.push({
            employeeId: emp.id,
            employeeCode: emp.employeeCode,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            success: true,
            slipId: slip.id,
            payableDays: result.attendance.payableDays.toNumber(),
            lopDays: result.attendance.lopDays.toNumber(),
            grossPay: result.grossPay.toNumber(),
            deductionsPay: result.deductionsPay.toNumber(),
            netPay: result.netPay.toNumber(),
            employerCost: result.employerCost.toNumber(),
            warnings: result.exceptions
          });
        } catch (empErr: any) {
          outcomes.push({
            employeeId: emp.id,
            employeeCode: emp.employeeCode,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            success: false,
            error: empErr?.message || 'Calculation failed'
          });
        }
      }

      // Update Run Status and Totals
      const finalRun = await tx.corporatePayrollRun.update({
        where: { id: runId },
        data: {
          status: 'CALCULATED',
          totalEmployees: eligibleEmployees.length,
          totalGross: totalGross.toNumber(),
          totalDeductions: totalDeductions.toNumber(),
          totalNetPay: totalNet.toNumber(),
          totalEmployerCost: totalEmployer.toNumber(),
          calculatedAt: new Date()
        },
        include: {
          period: true,
          transitions: { orderBy: { timestamp: 'desc' } }
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: runId,
          fromStatus: 'VALIDATED',
          toStatus: 'CALCULATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Processed department payroll for ${department.name}: ${outcomes.filter(o => o.success).length} slips created.`
        }
      });

      return finalRun;
    });

    await recordAudit(req, 'PROCESS_DEPARTMENT_PAYROLL', 'CorporatePayrollRun', runId, {
      departmentId: department.id,
      departmentName: department.name,
      processedEmployees: outcomes.filter(o => o.success).length,
      totalNetPay: totalNet.toNumber()
    });

    res.status(200).json({
      success: true,
      run: updatedRun,
      summary: {
        totalEmployees: eligibleEmployees.length,
        processedCount: outcomes.filter(o => o.success).length,
        failedCount: outcomes.filter(o => !o.success).length,
        totalGross: totalGross.toNumber(),
        totalDeductions: totalDeductions.toNumber(),
        totalNetPay: totalNet.toNumber(),
        totalEmployerCost: totalEmployer.toNumber()
      },
      results: outcomes
    });
  } catch (error) {
    next(error);
  }
});

// 1.4 Single Run Details with Slips, Transitions, and Notes
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

// 1.5 Detailed Review Table with Department Totals and Adjustments
corporatePayrollRouter.get('/runs/:id/review-table', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        period: true,
        transitions: { orderBy: { timestamp: 'desc' } },
        slips: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
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

    // Group by department
    const departmentSummary: Record<string, {
      name: string;
      employeeCount: number;
      grossPay: Decimal;
      manualAdjustments: Decimal;
      deductionsPay: Decimal;
      tds: Decimal;
      employerCost: Decimal;
      netPay: Decimal;
    }> = {};

    const rows = run.slips.map(slip => {
      const deptName = slip.employee.department?.name || 'Unassigned';
      const snap = (slip.calculationSnapshot as any) || {};
      const adjustments = snap.adjustments || [];

      // Calculate manual adjustments sum
      let manualAdditions = new Decimal(0);
      let manualDeductions = new Decimal(0);

      for (const it of slip.items) {
        if (it.code === 'VARIABLE_PAY' || it.code === 'INCENTIVE' || it.code === 'BONUS' || it.code === 'ARREARS' || it.code === 'ONE_TIME_EARNING') {
          manualAdditions = manualAdditions.plus(new Decimal(it.amount));
        } else if (it.code === 'ONE_TIME_DEDUCTION') {
          manualDeductions = manualDeductions.plus(new Decimal(it.amount));
        }
      }

      const netManualAdjustment = manualAdditions.minus(manualDeductions);

      // Extract TDS
      const tdsItem = slip.items.find(i => i.code === 'TDS');
      const tdsAmount = tdsItem ? new Decimal(tdsItem.amount) : new Decimal(0);

      // Department accumulation
      if (!departmentSummary[deptName]) {
        departmentSummary[deptName] = {
          name: deptName,
          employeeCount: 0,
          grossPay: new Decimal(0),
          manualAdjustments: new Decimal(0),
          deductionsPay: new Decimal(0),
          tds: new Decimal(0),
          employerCost: new Decimal(0),
          netPay: new Decimal(0)
        };
      }

      const d = departmentSummary[deptName];
      d.employeeCount++;
      d.grossPay = d.grossPay.plus(new Decimal(slip.grossPay));
      d.manualAdjustments = d.manualAdjustments.plus(netManualAdjustment);
      d.deductionsPay = d.deductionsPay.plus(new Decimal(slip.deductionsPay));
      d.tds = d.tds.plus(tdsAmount);
      d.employerCost = d.employerCost.plus(new Decimal(slip.employerCost));
      d.netPay = d.netPay.plus(new Decimal(slip.netPay));

      return {
        slipId: slip.id,
        employeeId: slip.employeeId,
        employeeCode: slip.employee.employeeCode,
        employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`,
        department: deptName,
        designation: slip.employee.designation?.name || 'N/A',
        branch: slip.employee.branch?.name || 'N/A',
        workingDays: slip.workingDays,
        payableDays: Number(slip.payableDays),
        lopDays: Number(slip.lopDays),
        unpaidDays: Number(slip.unpaidDays),
        grossPay: Number(slip.grossPay),
        manualAdjustments: Number(netManualAdjustment),
        deductionsPay: Number(slip.deductionsPay),
        tds: Number(tdsAmount),
        employerCost: Number(slip.employerCost),
        netPay: Number(slip.netPay),
        status: run.status,
        adjustmentsList: adjustments,
        tdsDeferral: snap.tdsDeferral || null,
        bankDetails: {
          accountNumber: slip.employee.bankAccountNumber,
          bankName: slip.employee.bankName,
          ifsc: slip.employee.ifscCode
        }
      };
    });

    const departmentTotals = Object.values(departmentSummary).map(d => ({
      name: d.name,
      employeeCount: d.employeeCount,
      grossPay: d.grossPay.toNumber(),
      manualAdjustments: d.manualAdjustments.toNumber(),
      deductionsPay: d.deductionsPay.toNumber(),
      tds: d.tds.toNumber(),
      employerCost: d.employerCost.toNumber(),
      netPay: d.netPay.toNumber()
    }));

    // Available salary components for adjustments dropdown
    const availableComponents = await prisma.salaryComponent.findMany({
      where: { companyId: req.user!.companyId, active: true },
      select: { code: true, name: true, type: true, category: true }
    });

    res.status(200).json({
      run: {
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        period: run.period,
        scope: (run.validationNotes as any)?.scope || { type: 'COMPANY' },
        totalEmployees: run.totalEmployees,
        totalGross: Number(run.totalGross),
        totalDeductions: Number(run.totalDeductions),
        totalNetPay: Number(run.totalNetPay),
        totalEmployerCost: Number(run.totalEmployerCost),
        validatedBy: run.validatedBy,
        validatedAt: run.validatedAt,
        calculatedAt: run.calculatedAt,
        reviewedBy: run.reviewedBy,
        approvedBy: run.approvedBy,
        paidAt: run.paidAt,
        paymentReference: run.paymentReference
      },
      rows,
      departmentTotals,
      availableComponents,
      transitions: run.transitions
    });
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
      branchId: z.string().optional(),
      departmentId: z.string().optional(),
      selectedEmployeeIds: z.array(z.string()).optional(),
      excludedEmployeeIds: z.array(z.string()).optional(),
      exclusionReasons: z.record(z.string()).optional(),
      remarks: z.string().optional()
    });
    const {
      periodId,
      branchId,
      departmentId,
      selectedEmployeeIds,
      excludedEmployeeIds,
      exclusionReasons,
      remarks
    } = schema.parse(req.body);

    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError('Payroll period not found', 404);

    let deptName: string | null = null;
    let deptCode: string = '';
    if (departmentId && departmentId !== 'ALL') {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId: req.user!.companyId }
      });
      if (!dept) throw new AppError('Department not found in your organization', 404);
      deptName = dept.name;
      deptCode = dept.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    }

    let branchName: string | null = null;
    if (branchId && branchId !== 'ALL') {
      const br = await prisma.branch.findFirst({
        where: { id: branchId, companyId: req.user!.companyId }
      });
      if (br) branchName = br.name;
    }

    // Check existing run for the exact same scope
    const allRunsInPeriod = await prisma.corporatePayrollRun.findMany({
      where: { companyId: req.user!.companyId, periodId }
    });

    let existingRun: typeof allRunsInPeriod[0] | null = null;
    for (const r of allRunsInPeriod) {
      const rScope = (r.validationNotes as any)?.scope;
      if (!departmentId && !rScope?.departmentId) {
        existingRun = r;
        break;
      }
      if (departmentId && rScope?.departmentId === departmentId) {
        existingRun = r;
        break;
      }
    }

    if (existingRun && existingRun.status !== 'DRAFT' && existingRun.status !== 'VALIDATED') {
      throw new AppError(`Payroll for ${period.name} is already ${existingRun.status} and locked from re-drafting.`, 400);
    }

    const employeeWhere: any = {
      companyId: req.user!.companyId,
      status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
      dateOfJoining: { lte: period.endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: period.startDate } }
      ]
    };

    if (departmentId && departmentId !== 'ALL') {
      employeeWhere.departmentId = departmentId;
    }
    if (branchId && branchId !== 'ALL') {
      employeeWhere.branchId = branchId;
    }
    if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
      employeeWhere.id = { in: selectedEmployeeIds };
    }
    if (excludedEmployeeIds && excludedEmployeeIds.length > 0) {
      employeeWhere.id = { ...(employeeWhere.id || {}), notIn: excludedEmployeeIds };
    }

    const candidateEmployees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, employeeCode: true, firstName: true, lastName: true }
    });

    if (candidateEmployees.length === 0) {
      throw new AppError('No eligible employees found for the specified payroll criteria.', 400);
    }

    // Verify duplicate run processing: No selected employee may already be in another active/paid run for this period
    const candidateIds = candidateEmployees.map(e => e.id);
    const duplicateSlips = await prisma.corporatePayrollSlip.findMany({
      where: {
        employeeId: { in: candidateIds },
        payrollRunId: existingRun ? { not: existingRun.id } : undefined,
        payrollRun: {
          periodId,
          companyId: req.user!.companyId,
          status: { in: ['VALIDATED', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAYMENT_READY', 'PAID'] }
        }
      },
      include: {
        employee: true,
        payrollRun: true
      }
    });

    if (duplicateSlips.length > 0) {
      const dup = duplicateSlips[0];
      throw new AppError(
        `Employee ${dup.employee.employeeCode} (${dup.employee.firstName} ${dup.employee.lastName}) is already processed in active payroll run ${dup.payrollRun.runNumber} for this period.`,
        400
      );
    }

    const runNumberSuffix = deptCode ? `-${deptCode}` : '';
    const runNumber = `RUN-${period.year}-${String(period.month).padStart(2, '0')}${runNumberSuffix}-${Date.now().toString().slice(-4)}`;

    const run = await prisma.$transaction(async (tx) => {
      if (existingRun && (existingRun.status === 'DRAFT' || existingRun.status === 'VALIDATED')) {
        await tx.corporatePayrollRun.delete({ where: { id: existingRun.id } });
      }

      const eligibleCount = candidateEmployees.length;

      const scope = {
        type: departmentId ? 'DEPARTMENT' : branchId ? 'BRANCH' : (selectedEmployeeIds && selectedEmployeeIds.length > 0) ? 'CUSTOM_GROUP' : 'COMPANY',
        departmentId: departmentId && departmentId !== 'ALL' ? departmentId : null,
        departmentName: deptName,
        branchId: branchId && branchId !== 'ALL' ? branchId : null,
        branchName: branchName,
        selectedEmployeeIds: selectedEmployeeIds || null,
        excludedEmployeeIds: excludedEmployeeIds || [],
        exclusionReasons: exclusionReasons || {}
      };

      const newRun = await tx.corporatePayrollRun.create({
        data: {
          companyId: req.user!.companyId,
          periodId: period.id,
          runNumber,
          status: 'DRAFT',
          totalEmployees: eligibleCount,
          validationNotes: {
            scope,
            eligibleEmployees: eligibleCount
          }
        }
      });

      const scopeDescription = deptName ? `department: ${deptName}` : branchName ? `branch: ${branchName}` : 'company-wide';
      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: newRun.id,
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: remarks || `Initialized payroll batch for ${period.name} (${eligibleCount} eligible employees, ${scopeDescription})`
        }
      });

      return newRun;
    });

    await recordAudit(req, 'INIT_PAYROLL_DRAFT', 'CorporatePayrollRun', run.id, {
      period: period.name,
      department: deptName,
      branch: branchName,
      eligibleCount: candidateEmployees.length
    });
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

    const scope = (run.validationNotes as any)?.scope;
    const employeeWhere: any = {
      companyId: req.user!.companyId,
      status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
      dateOfJoining: { lte: run.period.endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: run.period.startDate } }
      ]
    };

    if (scope?.departmentId) {
      employeeWhere.departmentId = scope.departmentId;
    }
    if (scope?.branchId) {
      employeeWhere.branchId = scope.branchId;
    }
    if (scope?.selectedEmployeeIds && Array.isArray(scope.selectedEmployeeIds) && scope.selectedEmployeeIds.length > 0) {
      employeeWhere.id = { in: scope.selectedEmployeeIds };
    }
    if (scope?.excludedEmployeeIds && Array.isArray(scope.excludedEmployeeIds) && scope.excludedEmployeeIds.length > 0) {
      employeeWhere.id = { ...(employeeWhere.id || {}), notIn: scope.excludedEmployeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
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
      ...((run.validationNotes as any) || {}),
      scope,
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

    const scope = (run.validationNotes as any)?.scope;
    const employeeWhere: any = {
      companyId: req.user!.companyId,
      status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
      salaryStructure: { isNot: null },
      dateOfJoining: { lte: run.period.endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: run.period.startDate } }
      ]
    };

    if (scope?.departmentId) {
      employeeWhere.departmentId = scope.departmentId;
    }
    if (scope?.branchId) {
      employeeWhere.branchId = scope.branchId;
    }
    if (scope?.selectedEmployeeIds && Array.isArray(scope.selectedEmployeeIds) && scope.selectedEmployeeIds.length > 0) {
      employeeWhere.id = { in: scope.selectedEmployeeIds };
    }
    if (scope?.excludedEmployeeIds && Array.isArray(scope.excludedEmployeeIds) && scope.excludedEmployeeIds.length > 0) {
      employeeWhere.id = { ...(employeeWhere.id || {}), notIn: scope.excludedEmployeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
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

      const draftAdjustments = (run.validationNotes as any)?.draftAdjustments || [];
      const adjMap = new Map<string, any>(draftAdjustments.map((a: any) => [a.employeeId, a]));

      for (const emp of employees) {
        const adj = adjMap.get(emp.id);
        const result = await PayrollCalculationEngine.calculateEmployee(
          emp,
          run.period,
          ptSlabs,
          statutoryConfig,
          adj?.leaveLossOfPayDays !== undefined ? Number(adj.leaveLossOfPayDays) : (adj?.lopDays !== undefined ? Number(adj.lopDays) : undefined),
          adj?.arrearsAmount !== undefined ? Number(adj.arrearsAmount) : (adj?.arrears !== undefined ? Number(adj.arrears) : undefined),
          adj?.reimbursementAmount !== undefined ? Number(adj.reimbursementAmount) : undefined,
          adj?.variableAllowance !== undefined ? Number(adj.variableAllowance) : (adj?.variablePay !== undefined ? Number(adj.variablePay) : undefined),
          adj?.manualDeduction !== undefined ? Number(adj.manualDeduction) : undefined,
          adj?.tdsAdjustment !== undefined ? Number(adj.tdsAdjustment) : undefined,
          adj?.otHours !== undefined ? Number(adj.otHours) : undefined
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
          remarks: `Calculated decimal payroll for ${employees.length} employees. Total Net: ₹${totalNet.toFixed(2)}`
        }
      });

      return u;
    });

    await recordAudit(req, 'CALCULATE_PAYROLL', 'CorporatePayrollRun', run.id, {
      employeesCalculated: employees.length,
      netDisbursement: totalNet.toNumber()
    });

    res.status(200).json({
      run: updated,
      summary: {
        totalEmployees: employees.length,
        totalGross: totalGross.toNumber(),
        totalDeductions: totalDeductions.toNumber(),
        totalNetPay: totalNet.toNumber(),
        totalEmployerCost: totalEmployer.toNumber(),
        warnings: calculationWarnings
      }
    });
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

// STAGE 5b: REJECT RUN (Requires Reason, Transitions to VALIDATED with Audit)
corporatePayrollRouter.post('/runs/:id/reject', authenticate, requireRole(['finance_admin', 'company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      reason: z.string().min(5, 'Rejection reason must be at least 5 characters')
    });
    const { reason } = schema.parse(req.body);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status === 'PAID') {
      throw new AppError('Cannot reject a finalized PAID payroll run.', 400);
    }

    const existingNotes = (run.validationNotes as any) || {};
    const rejectionRecord = {
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user!.fullName,
      rejectedById: req.user!.userId,
      rejectedRole: req.user!.roles[0] || 'finance_admin',
      previousStatus: run.status,
      reason
    };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'VALIDATED',
          validationNotes: {
            ...existingNotes,
            rejection: rejectionRecord,
            rejectionHistory: [...(existingNotes.rejectionHistory || []), rejectionRecord]
          }
        }
      });

      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: 'VALIDATED',
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'finance_admin',
          remarks: `Batch rejected by ${req.user!.fullName}: ${reason}`
        }
      });

      return u;
    });

    await recordAudit(req, 'REJECT_PAYROLL_RUN', 'CorporatePayrollRun', run.id, { reason, previousStatus: run.status });
    res.status(200).json({
      success: true,
      run: updated,
      message: `Payroll run rejected and returned to VALIDATED stage. Reason: ${reason}`
    });
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
          const totalDue = new Decimal((loan as any).totalRepayment && Number((loan as any).totalRepayment) > 0 ? (loan as any).totalRepayment : loan.principalAmount);
          const newOutstanding = Decimal.max(0, totalDue.minus(newRecovered));

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

// 4.1 Get Salary Editor Rows with Take-Home Compliance Flag & Complete Candidate Preview
corporatePayrollRouter.get('/runs/:id/editor', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
                designation: { select: { name: true } },
                salaryStructure: {
                  select: {
                    id: true,
                    annualCtc: true,
                    monthlyGross: true,
                    template: { select: { name: true } }
                  }
                }
              }
            },
            items: true
          },
          orderBy: { employee: { employeeCode: 'asc' } }
        }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);

    let rows: any[] = [];

    // Case 1: Run has calculated slips (CALCULATED, REVIEWED, APPROVED, PAYMENT_READY, PAID)
    if (run.slips && run.slips.length > 0) {
      const employeeIds = run.slips.map(s => s.employee.id);
      const [attendances, approvedLeaves] = await Promise.all([
        prisma.dailyAttendance.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: { gte: run.period.startDate, lte: run.period.endDate }
          },
          select: { employeeId: true, status: true, workingHours: true }
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'APPROVED',
            fromDate: { lte: run.period.endDate },
            toDate: { gte: run.period.startDate }
          },
          include: { leavePolicy: true }
        })
      ]);

      const attMap = new Map<string, { presentDays: number }>();
      for (const a of attendances) {
        const cur = attMap.get(a.employeeId) || { presentDays: 0 };
        if (a.status === 'PRESENT') cur.presentDays += 1;
        else if (a.status === 'HALF_DAY') cur.presentDays += 0.5;
        attMap.set(a.employeeId, cur);
      }

      const leaveMap = new Map<string, { paidLeaves: number; unpaidLeaves: number }>();
      for (const l of approvedLeaves) {
        const cur = leaveMap.get(l.employeeId) || { paidLeaves: 0, unpaidLeaves: 0 };
        const days = Number(l.totalDays || 0);
        if (l.leavePolicy?.isPaid) cur.paidLeaves += days;
        else cur.unpaidLeaves += days;
        leaveMap.set(l.employeeId, cur);
      }

      rows = run.slips.map(s => {
        const gross = Number(s.grossPay);
        const deductions = Number(s.deductionsPay);
        const net = Number(s.netPay);
        const isNetLessThan25Percent = gross > 0 && net < (gross * 0.25);

        const itemMap = new Map(s.items.map(i => [i.code, Number(i.amount)]));
        const snap = (s.calculationSnapshot as any) || {};
        const attInfo = attMap.get(s.employee.id) || { presentDays: 0 };
        const leaveInfo = leaveMap.get(s.employee.id) || { paidLeaves: 0, unpaidLeaves: 0 };

        const validationErrors: string[] = [];
        if (!s.employee.salaryStructure) {
          validationErrors.push('Missing active salary structure (CTC not configured)');
        }
        if (isNetLessThan25Percent) {
          validationErrors.push('High deductions: Take-home net pay is less than 25% of gross earnings');
        }

        return {
          id: s.id,
          slipId: s.id,
          employeeId: s.employee.id,
          employeeCode: s.employee.employeeCode,
          staffCode: s.employee.employeeCode,
          hasStructure: true,
          employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
          department: s.employee.department?.name || 'General',
          designation: s.employee.designation?.name || 'Staff',
          status: s.employee.status,
          structureName: s.employee.salaryStructure?.template?.name || (s.employee.salaryStructure ? 'Standard CTC' : 'Missing Structure'),
          monthlyGrossConfigured: s.employee.salaryStructure?.monthlyGross ? Number(s.employee.salaryStructure.monthlyGross) : gross,
          calendarDays: Number(s.workingDays || 30),
          workingDays: Number(s.workingDays || 30),
          totalWorkingDays: Number(s.workingDays || 30),
          payableDays: Number(s.payableDays),
          presentDays: attInfo.presentDays,
          approvedPaidLeaves: leaveInfo.paidLeaves,
          lopDays: Number(s.lopDays),
          otHours: Number(snap.overtimeHours || 0),
          otRate: Number(snap.otRatePerHour || 0),
          basic: itemMap.get('BASIC') || 0,
          hra: itemMap.get('HRA') || 0,
          conveyance: itemMap.get('CONVEYANCE') || 0,
          specialAllowance: itemMap.get('SPECIAL_ALLOWANCE') || 0,
          variableEarnings: Number(s.variableEarnings || itemMap.get('VARIABLE_PAY') || 0),
          variableAllowance: Number(s.variableEarnings || itemMap.get('VARIABLE_PAY') || 0),
          variablePay: Number(s.variableEarnings || itemMap.get('VARIABLE_PAY') || 0),
          arrearsAmount: Number(s.arrearsAmount || itemMap.get('ARREARS') || 0),
          arrears: Number(s.arrearsAmount || itemMap.get('ARREARS') || 0),
          reimbursementAmount: Number(s.reimbursementAmount || itemMap.get('REIMBURSEMENT') || 0),
          manualDeduction: Number(itemMap.get('ONE_TIME_DEDUCTION') || 0),
          epfEmployee: itemMap.get('EPF_EMPLOYEE') || 0,
          esiEmployee: itemMap.get('ESIC_EMPLOYEE') || 0,
          professionalTax: itemMap.get('PROFESSIONAL_TAX') || 0,
          tds: itemMap.get('TDS') || 0,
          tdsAdjustment: itemMap.get('TDS') || 0,
          loanEmi: itemMap.get('LOAN_EMI') || 0,
          grossPay: gross,
          grossSalary: gross,
          deductionsPay: deductions,
          deductions: deductions,
          netPay: net,
          netSalary: net,
          employerCost: Number(s.employerCost),
          isNetLessThan25Percent,
          calculationStatus: run.status,
          validationErrors,
          items: s.items.map(it => ({
            code: it.code,
            name: it.name,
            type: it.type,
            amount: Number(it.amount)
          }))
        };
      });
    } else {
      // Case 2: Run has NO calculated slips yet (Stage 1 DRAFT or Stage 2 VALIDATED)
      const scope = (run.validationNotes as any)?.scope;
      const employeeWhere: any = {
        companyId: req.user!.companyId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
        dateOfJoining: { lte: run.period.endDate },
        OR: [
          { exitDate: null },
          { exitDate: { gte: run.period.startDate } }
        ]
      };

      if (scope?.departmentId && scope.departmentId !== 'ALL') {
        employeeWhere.departmentId = scope.departmentId;
      }
      if (scope?.branchId && scope.branchId !== 'ALL') {
        employeeWhere.branchId = scope.branchId;
      }
      if (scope?.selectedEmployeeIds && Array.isArray(scope.selectedEmployeeIds) && scope.selectedEmployeeIds.length > 0) {
        employeeWhere.id = { in: scope.selectedEmployeeIds };
      }
      if (scope?.excludedEmployeeIds && Array.isArray(scope.excludedEmployeeIds) && scope.excludedEmployeeIds.length > 0) {
        employeeWhere.id = { ...(employeeWhere.id || {}), notIn: scope.excludedEmployeeIds };
      }

      const candidateEmployees = await prisma.employee.findMany({
        where: employeeWhere,
        include: {
          salaryStructure: {
            include: {
              template: { select: { name: true } },
              lines: { include: { component: true } }
            }
          },
          payrollPolicy: true,
          department: { select: { name: true } },
          designation: { select: { name: true } }
        },
        orderBy: { employeeCode: 'asc' }
      });

      const totalDays = Math.round((new Date(run.period.endDate).getTime() - new Date(run.period.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const empIds = candidateEmployees.map(e => e.id);

      const [attendances, approvedLeaves] = await Promise.all([
        prisma.dailyAttendance.findMany({
          where: {
            employeeId: { in: empIds },
            date: { gte: run.period.startDate, lte: run.period.endDate }
          },
          select: { employeeId: true, status: true, workingHours: true, overtimeMinutes: true }
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: empIds },
            status: 'APPROVED',
            fromDate: { lte: run.period.endDate },
            toDate: { gte: run.period.startDate }
          },
          include: { leavePolicy: true }
        })
      ]);

      const attMap = new Map<string, { presentDays: number; overtimeMinutes: number }>();
      for (const a of attendances) {
        const cur = attMap.get(a.employeeId) || { presentDays: 0, overtimeMinutes: 0 };
        if (a.status === 'PRESENT') cur.presentDays += 1;
        else if (a.status === 'HALF_DAY') cur.presentDays += 0.5;
        cur.overtimeMinutes += a.overtimeMinutes || 0;
        attMap.set(a.employeeId, cur);
      }

      const leaveMap = new Map<string, { paidLeaves: number; unpaidLeaves: number }>();
      for (const l of approvedLeaves) {
        const cur = leaveMap.get(l.employeeId) || { paidLeaves: 0, unpaidLeaves: 0 };
        const days = Number(l.totalDays || 0);
        if (l.leavePolicy?.isPaid) cur.paidLeaves += days;
        else cur.unpaidLeaves += days;
        leaveMap.set(l.employeeId, cur);
      }

      const draftAdjustments = (run.validationNotes as any)?.draftAdjustments || [];
      const draftAdjMap = new Map<string, any>(draftAdjustments.map((a: any) => [a.employeeId, a]));

      rows = candidateEmployees.map(emp => {
        const attInfo = attMap.get(emp.id) || { presentDays: 0, overtimeMinutes: 0 };
        const leaveInfo = leaveMap.get(emp.id) || { paidLeaves: 0, unpaidLeaves: 0 };
        const draftAdj = draftAdjMap.get(emp.id);

        let payableDays = totalDays;
        if (emp.dateOfJoining && new Date(emp.dateOfJoining) > new Date(run.period.startDate)) {
          const daysBefore = Math.round((new Date(emp.dateOfJoining).getTime() - new Date(run.period.startDate).getTime()) / (1000 * 60 * 60 * 24));
          payableDays -= daysBefore;
        }
        const lopDays = draftAdj?.leaveLossOfPayDays !== undefined
          ? Number(draftAdj.leaveLossOfPayDays)
          : draftAdj?.lopDays !== undefined
            ? Number(draftAdj.lopDays)
            : leaveInfo.unpaidLeaves;
        payableDays = Math.max(0, payableDays - lopDays);

        const hasStructure = Boolean(emp.salaryStructure && emp.salaryStructure.lines.length > 0);
        const monthlyGross = hasStructure ? Number(emp.salaryStructure?.monthlyGross || 0) : 0;
        const validationErrors: string[] = [];
        if (!hasStructure) {
          validationErrors.push('Missing active salary structure (CTC not configured)');
        }

        const otHours = draftAdj?.otHours !== undefined ? Number(draftAdj.otHours) : Math.round((attInfo.overtimeMinutes / 60) * 10) / 10;
        const arrears = draftAdj?.arrearsAmount !== undefined
          ? Number(draftAdj.arrearsAmount)
          : draftAdj?.arrears !== undefined
            ? Number(draftAdj.arrears)
            : 0;
        const variable = draftAdj?.variableAllowance !== undefined
          ? Number(draftAdj.variableAllowance)
          : draftAdj?.variablePay !== undefined
            ? Number(draftAdj.variablePay)
            : 0;
        const manualDed = draftAdj?.manualDeduction !== undefined ? Number(draftAdj.manualDeduction) : 0;

        return {
          id: `candidate-${emp.id}`,
          slipId: null,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          staffCode: emp.employeeCode,
          hasStructure,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          department: emp.department?.name || 'General',
          designation: emp.designation?.name || 'Staff',
          status: emp.status,
          structureName: emp.salaryStructure?.template?.name || (hasStructure ? 'Standard CTC' : 'Missing Structure'),
          monthlyGrossConfigured: monthlyGross,
          calendarDays: totalDays,
          workingDays: totalDays,
          totalWorkingDays: totalDays,
          payableDays,
          presentDays: attInfo.presentDays,
          approvedPaidLeaves: leaveInfo.paidLeaves,
          lopDays,
          otHours,
          otRate: 0,
          basic: 0,
          hra: 0,
          conveyance: 0,
          specialAllowance: 0,
          variableEarnings: variable,
          variableAllowance: variable,
          variablePay: variable,
          arrearsAmount: arrears,
          arrears,
          reimbursementAmount: 0,
          manualDeduction: manualDed,
          epfEmployee: 0,
          esiEmployee: 0,
          professionalTax: 0,
          tds: 0,
          tdsAdjustment: 0,
          loanEmi: 0,
          grossPay: monthlyGross,
          grossSalary: monthlyGross,
          deductionsPay: manualDed,
          deductions: manualDed,
          netPay: Math.max(0, monthlyGross - manualDed),
          netSalary: Math.max(0, monthlyGross - manualDed),
          employerCost: monthlyGross,
          isNetLessThan25Percent: false,
          calculationStatus: hasStructure ? run.status : 'MISSING_STRUCTURE',
          validationErrors,
          items: []
        };
      });
    }

    res.status(200).json({
      success: true,
      runId: run.id,
      runNumber: run.runNumber,
      status: run.status,
      periodName: run.period.name,
      totalEmployees: rows.length,
      totals: {
        totalGross: Number(run.totalGross),
        totalDeductions: Number(run.totalDeductions),
        totalNetPay: Number(run.totalNetPay),
        totalEmployerCost: Number(run.totalEmployerCost)
      },
      rows,
      employees: rows
    });
  } catch (error) {
    next(error);
  }
});

// 4.2 Update Salary Adjustments (Batch or Single Slip)
corporatePayrollRouter.patch('/runs/:id/adjustments', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        slips: { include: { items: true, employee: true } }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status === 'PAID') {
      throw new AppError('Cannot modify adjustments on a finalized PAID payroll run', 400);
    }
    if (run.status === 'APPROVED') {
      throw new AppError('Cannot modify an APPROVED payroll run without re-draft authorization', 400);
    }

    // Sub-case: Run is in DRAFT or VALIDATED stage (no slips yet)
    if (!run.slips || run.slips.length === 0) {
      if (req.body.adjustments && Array.isArray(req.body.adjustments)) {
        const valNotes = ((run.validationNotes as any) || {});
        valNotes.draftAdjustments = req.body.adjustments;

        await prisma.corporatePayrollRun.update({
          where: { id: run.id },
          data: { validationNotes: valNotes }
        });

        await prisma.corporatePayrollTransition.create({
          data: {
            payrollRunId: run.id,
            fromStatus: run.status,
            toStatus: run.status,
            actorName: req.user!.fullName,
            actorRole: req.user!.roles[0] || 'payroll_admin',
            remarks: `Draft input adjustments recorded for ${req.body.adjustments.length} employees (will be applied in Stage 3 Calculate)`
          }
        });

        res.status(200).json({
          success: true,
          count: req.body.adjustments.length,
          message: 'Draft salary adjustments saved successfully. These will be applied upon Stage 3 Salary Calculation.'
        });
        return;
      }
    }

    // Case A: Batch adjustments array from Monthly Salary Editor
    if (req.body.adjustments && Array.isArray(req.body.adjustments)) {
      await prisma.$transaction(async (tx) => {
        for (const adj of req.body.adjustments) {
          const slip = run.slips.find(s => s.employeeId === adj.employeeId || s.id === adj.employeeId || s.id === adj.slipId);
          if (!slip) continue;

          const arrears = adj.arrearsAmount !== undefined
            ? new Decimal(adj.arrearsAmount)
            : adj.arrears !== undefined
              ? new Decimal(adj.arrears)
              : new Decimal(slip.arrearsAmount);

          const variable = (adj.variableAllowance !== undefined || adj.variablePay !== undefined || adj.otHours !== undefined)
            ? new Decimal(adj.variableAllowance !== undefined ? adj.variableAllowance : (adj.variablePay !== undefined ? adj.variablePay : 0)).plus(new Decimal(adj.otHours || 0).times(adj.otRatePerHour || 0))
            : new Decimal(slip.variableEarnings);

          // Variable Item
          if (variable.greaterThan(0)) {
            const existingVarItem = slip.items.find(i => i.code === 'VARIABLE_PAY' || i.code === 'INCENTIVE' || i.code === 'BONUS');
            if (existingVarItem) {
              await tx.corporatePayrollItem.update({ where: { id: existingVarItem.id }, data: { amount: variable } });
            } else {
              await tx.corporatePayrollItem.create({
                data: { payrollSlipId: slip.id, code: 'VARIABLE_PAY', name: 'Incentive / Bonus', type: 'EARNING', amount: variable }
              });
            }
          }

          // Arrears Item
          if (arrears.greaterThan(0)) {
            const existingArrears = slip.items.find(i => i.code === 'ARREARS');
            if (existingArrears) {
              await tx.corporatePayrollItem.update({ where: { id: existingArrears.id }, data: { amount: arrears } });
            } else {
              await tx.corporatePayrollItem.create({
                data: { payrollSlipId: slip.id, code: 'ARREARS', name: 'Salary Arrears', type: 'EARNING', amount: arrears }
              });
            }
          }

          // Manual Deduction Item
          if (adj.manualDeduction !== undefined && Number(adj.manualDeduction) > 0) {
            const dedVal = new Decimal(adj.manualDeduction);
            const existingDed = slip.items.find(i => i.code === 'ONE_TIME_DEDUCTION');
            if (existingDed) {
              await tx.corporatePayrollItem.update({ where: { id: existingDed.id }, data: { amount: dedVal } });
            } else {
              await tx.corporatePayrollItem.create({
                data: { payrollSlipId: slip.id, code: 'ONE_TIME_DEDUCTION', name: 'One-Time Deduction', type: 'DEDUCTION', amount: dedVal }
              });
            }
          }

          // Update LOP days if passed
          const nextLopDays = adj.leaveLossOfPayDays !== undefined
            ? new Decimal(adj.leaveLossOfPayDays)
            : adj.lopDays !== undefined
              ? new Decimal(adj.lopDays)
              : slip.lopDays;
          const nextPayableDays = Decimal.max(0, new Decimal(slip.workingDays || 30).minus(nextLopDays));

          // Re-sum items
          const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
          let newGross = new Decimal(0);
          let newDeductions = new Decimal(0);
          for (const it of allItems) {
            if (it.type === 'EARNING') newGross = newGross.plus(new Decimal(it.amount));
            if (it.type === 'DEDUCTION') newDeductions = newDeductions.plus(new Decimal(it.amount));
          }
          const newNet = Decimal.max(0, newGross.minus(newDeductions).plus(slip.reimbursementAmount));

          // Append to adjustments list in snapshot for auditability
          const snap = (slip.calculationSnapshot as any) || {};
          const adjustmentsList = snap.adjustments || [];
          adjustmentsList.push({
            timestamp: new Date().toISOString(),
            actorName: req.user!.fullName,
            actorRole: req.user!.roles[0] || 'payroll_admin',
            reason: adj.reason || 'Batch salary editor adjustment',
            changes: {
              arrears: { before: Number(slip.arrearsAmount), after: arrears.toNumber() },
              variableEarnings: { before: Number(slip.variableEarnings), after: variable.toNumber() },
              lopDays: { before: Number(slip.lopDays), after: nextLopDays.toNumber() },
              grossPay: { before: Number(slip.grossPay), after: newGross.toNumber() },
              netPay: { before: Number(slip.netPay), after: newNet.toNumber() }
            }
          });
          snap.adjustments = adjustmentsList;

          await tx.corporatePayrollSlip.update({
            where: { id: slip.id },
            data: {
              lopDays: nextLopDays,
              payableDays: nextPayableDays,
              arrearsAmount: arrears,
              variableEarnings: variable,
              grossPay: newGross,
              deductionsPay: newDeductions,
              netPay: newNet,
              calculationSnapshot: snap
            }
          });
        }

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
          data: { totalGross: runGross, totalDeductions: runDeductions, totalNetPay: runNet }
        });

        await tx.corporatePayrollTransition.create({
          data: {
            payrollRunId: run.id,
            fromStatus: run.status,
            toStatus: run.status,
            actorName: req.user!.fullName,
            actorRole: req.user!.roles[0] || 'payroll_admin',
            remarks: `Batch salary editor adjustments updated for ${req.body.adjustments.length} employees`
          }
        });
      });

      res.status(200).json({ success: true, message: 'Batch salary adjustments persisted successfully' });
      return;
    }

    // Case B: Single Slip adjustment
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

    const slip = run.slips.find(s => s.id === parsed.slipId);
    if (!slip) throw new AppError('Payroll slip not found in this run', 404);

    const updatedSlip = await prisma.$transaction(async (tx) => {
      let arrears = parsed.arrearsAmount !== undefined ? new Decimal(parsed.arrearsAmount) : new Decimal(slip.arrearsAmount);
      let reimbursement = parsed.reimbursementAmount !== undefined ? new Decimal(parsed.reimbursementAmount) : new Decimal(slip.reimbursementAmount);
      let variable = parsed.variableEarnings !== undefined ? new Decimal(parsed.variableEarnings) : new Decimal(slip.variableEarnings);
      let lopDays = parsed.lopDaysOverride !== undefined ? new Decimal(parsed.lopDaysOverride) : new Decimal(slip.lopDays);

      if (parsed.variableEarnings !== undefined) {
        const existingVarItem = slip.items.find(i => i.code === 'VARIABLE_PAY' || i.code === 'INCENTIVE' || i.code === 'BONUS');
        if (existingVarItem) {
          await tx.corporatePayrollItem.update({ where: { id: existingVarItem.id }, data: { amount: variable } });
        } else if (variable.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: { payrollSlipId: slip.id, code: 'VARIABLE_PAY', name: 'Incentive / Variable Bonus', type: 'EARNING', amount: variable }
          });
        }
      }

      if (parsed.arrearsAmount !== undefined) {
        const existingArrears = slip.items.find(i => i.code === 'ARREARS');
        if (existingArrears) {
          await tx.corporatePayrollItem.update({ where: { id: existingArrears.id }, data: { amount: arrears } });
        } else if (arrears.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: { payrollSlipId: slip.id, code: 'ARREARS', name: 'Salary Arrears', type: 'EARNING', amount: arrears }
          });
        }
      }

      if (parsed.tdsOverride !== undefined) {
        const tdsVal = new Decimal(parsed.tdsOverride);
        const existingTds = slip.items.find(i => i.code === 'TDS');
        if (existingTds) {
          await tx.corporatePayrollItem.update({ where: { id: existingTds.id }, data: { amount: tdsVal } });
        } else if (tdsVal.greaterThan(0)) {
          await tx.corporatePayrollItem.create({
            data: { payrollSlipId: slip.id, code: 'TDS', name: 'Income Tax (TDS)', type: 'DEDUCTION', amount: tdsVal }
          });
        }
      }

      // Re-sum items
      const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
      let newGross = new Decimal(0);
      let newDeductions = new Decimal(0);

      for (const it of allItems) {
        if (it.type === 'EARNING') newGross = newGross.plus(new Decimal(it.amount));
        if (it.type === 'DEDUCTION') newDeductions = newDeductions.plus(new Decimal(it.amount));
      }

      const newNet = Decimal.max(0, newGross.minus(newDeductions).plus(reimbursement));

      // Append to adjustments list in snapshot
      const snap = (slip.calculationSnapshot as any) || {};
      const adjustmentsList = snap.adjustments || [];
      adjustmentsList.push({
        timestamp: new Date().toISOString(),
        actorName: req.user!.fullName,
        actorRole: req.user!.roles[0] || 'payroll_admin',
        reason: parsed.reason || 'Manual single-slip adjustment',
        changes: {
          arrears: { before: Number(slip.arrearsAmount), after: arrears.toNumber() },
          variableEarnings: { before: Number(slip.variableEarnings), after: variable.toNumber() },
          lopDays: { before: Number(slip.lopDays), after: lopDays.toNumber() },
          grossPay: { before: Number(slip.grossPay), after: newGross.toNumber() },
          netPay: { before: Number(slip.netPay), after: newNet.toNumber() }
        }
      });
      snap.adjustments = adjustmentsList;

      const updated = await tx.corporatePayrollSlip.update({
        where: { id: slip.id },
        data: {
          arrearsAmount: arrears,
          reimbursementAmount: reimbursement,
          variableEarnings: variable,
          lopDays,
          grossPay: newGross,
          deductionsPay: newDeductions,
          netPay: newNet,
          calculationSnapshot: snap
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
        data: { totalGross: runGross, totalDeductions: runDeductions, totalNetPay: runNet }
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

// 4.3 Add Granular Manual Salary Adjustment & Attendance Correction
corporatePayrollRouter.post('/runs/:id/adjustments', authenticate, requireRole(['company_admin', 'payroll_admin', 'payroll_processor']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const schema = z.object({
      slipId: z.string().min(1),
      componentCode: z.string().min(1),
      componentName: z.string().optional(),
      type: z.enum(['EARNING', 'DEDUCTION']),
      amount: z.number().min(0),
      reason: z.string().min(3, 'A clear reason for the manual adjustment is required'),
      supportingDocumentUrl: z.string().optional(),
      lopDaysOverride: z.number().min(0).optional(),
      isTdsDeferral: z.boolean().optional(),
      recoveryPeriod: z.string().optional()
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
    if (run.status === 'APPROVED') {
      throw new AppError('Cannot modify an APPROVED payroll run without returning it for recalculation.', 400);
    }

    const slip = run.slips[0];
    if (!slip) throw new AppError('Payroll slip not found in this run', 404);

    // If TDS adjustment / deferral safeguard
    if (parsed.componentCode === 'TDS') {
      if (!parsed.reason || parsed.reason.trim().length < 5) {
        throw new AppError('TDS adjustment requires a valid justification compliant with Income Tax rules.', 400);
      }
      if (parsed.isTdsDeferral && !parsed.recoveryPeriod) {
        throw new AppError('TDS deferral requires selecting the target recovery period (e.g. Next Month).', 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const snap = (slip.calculationSnapshot as any) || {};
      const adjustmentsList = snap.adjustments || [];

      let newGross = new Decimal(slip.grossPay);
      let newDeductions = new Decimal(slip.deductionsPay);
      const adjAmount = new Decimal(parsed.amount);

      // Handle LOP / Attendance correction if specified
      let revisedPayableDays = slip.payableDays;
      let revisedLopDays = slip.lopDays;
      let attendanceChanged = false;

      if (parsed.lopDaysOverride !== undefined && parsed.lopDaysOverride !== null) {
        attendanceChanged = true;
        const newLop = new Decimal(parsed.lopDaysOverride);
        const calendarDays = new Decimal(slip.workingDays);
        revisedLopDays = newLop;
        revisedPayableDays = Decimal.max(0, calendarDays.minus(newLop));

        // Recalculate attendance proration on attendance-dependent items
        const prorationRatio = revisedPayableDays.dividedBy(calendarDays);
        for (const item of slip.items) {
          if (item.type === 'EARNING' && item.code !== 'VARIABLE_PAY' && item.code !== 'ARREARS' && item.code !== 'ONE_TIME_EARNING') {
            const origItem = snap.items?.find((i: any) => i.code === item.code);
            const baseMonthly = origItem ? new Decimal(origItem.configuredMonthly) : new Decimal(item.amount);
            const newAmount = baseMonthly.times(prorationRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            await tx.corporatePayrollItem.update({
              where: { id: item.id },
              data: { amount: newAmount }
            });
          }
        }
      }

      // Handle salary component item update or create
      const existingItem = slip.items.find(i => i.code === parsed.componentCode);
      const originalItemAmount = existingItem ? Number(existingItem.amount) : 0;

      if (existingItem) {
        await tx.corporatePayrollItem.update({
          where: { id: existingItem.id },
          data: {
            amount: adjAmount,
            name: parsed.componentName || existingItem.name
          }
        });
      } else {
        await tx.corporatePayrollItem.create({
          data: {
            payrollSlipId: slip.id,
            code: parsed.componentCode,
            name: parsed.componentName || parsed.componentCode,
            type: parsed.type,
            amount: adjAmount
          }
        });
      }

      // Re-sum items
      const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
      newGross = new Decimal(0);
      newDeductions = new Decimal(0);

      for (const it of allItems) {
        if (it.type === 'EARNING') {
          newGross = newGross.plus(new Decimal(it.amount));
        } else if (it.type === 'DEDUCTION') {
          newDeductions = newDeductions.plus(new Decimal(it.amount));
        }
      }

      const newNet = Decimal.max(0, newGross.minus(newDeductions).plus(slip.reimbursementAmount));

      // Append adjustment record to calculationSnapshot
      const adjustmentRecord = {
        id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        componentCode: parsed.componentCode,
        componentName: parsed.componentName || parsed.componentCode,
        type: parsed.type,
        originalAmount: originalItemAmount,
        adjustmentAmount: parsed.amount,
        revisedAmount: parsed.amount,
        reason: parsed.reason,
        supportingDocumentUrl: parsed.supportingDocumentUrl || null,
        isTdsDeferral: Boolean(parsed.isTdsDeferral),
        recoveryPeriod: parsed.recoveryPeriod || null,
        attendanceCorrected: attendanceChanged,
        previousPayableDays: attendanceChanged ? Number(slip.payableDays) : undefined,
        revisedPayableDays: attendanceChanged ? Number(revisedPayableDays) : undefined,
        createdBy: req.user!.fullName,
        createdAt: new Date().toISOString(),
        approvalStatus: 'APPROVED',
        approvedBy: req.user!.fullName,
        approvedAt: new Date().toISOString()
      };

      adjustmentsList.push(adjustmentRecord);

      // Update slip
      const updatedSlip = await tx.corporatePayrollSlip.update({
        where: { id: slip.id },
        data: {
          payableDays: revisedPayableDays,
          lopDays: revisedLopDays,
          grossPay: newGross,
          deductionsPay: newDeductions,
          netPay: newNet,
          calculationSnapshot: {
            ...snap,
            adjustments: adjustmentsList,
            ...(parsed.isTdsDeferral ? { tdsDeferral: { amount: parsed.amount, recoveryPeriod: parsed.recoveryPeriod, reason: parsed.reason } } : {})
          }
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

      // Record transition audit
      await tx.corporatePayrollTransition.create({
        data: {
          payrollRunId: run.id,
          fromStatus: run.status,
          toStatus: run.status,
          actorName: req.user!.fullName,
          actorRole: req.user!.roles[0] || 'payroll_admin',
          remarks: `Manual Adjustment for ${slip.employee.employeeCode}: ${parsed.componentCode} ₹${parsed.amount} (${parsed.reason})`
        }
      });

      return updatedSlip;
    });

    await recordAudit(req, 'MANUAL_SALARY_ADJUSTMENT', 'CorporatePayrollSlip', slip.id, {
      component: parsed.componentCode,
      amount: parsed.amount,
      reason: parsed.reason
    });

    res.status(200).json({ slip: updated, message: 'Manual adjustment recorded and recalculated successfully' });
  } catch (error) {
    next(error);
  }
});

// 4.4 Authorized TDS Deferral & Recovery
corporatePayrollRouter.post('/runs/:id/tds-deferral', authenticate, requireRole(['company_admin', 'payroll_admin', 'finance_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const runId = String(req.params.id);
    const schema = z.object({
      slipId: z.string().min(1),
      deferralAmount: z.number().positive('Deferral amount must be greater than zero'),
      reason: z.string().min(5, 'A formal tax justification is required for TDS deferral'),
      recoveryPeriod: z.string().min(3, 'Recovery period must be specified (e.g. November 2026)')
    });
    const parsed = schema.parse(req.body);

    const run = await prisma.corporatePayrollRun.findFirst({
      where: { id: runId, companyId: req.user!.companyId },
      include: {
        slips: { where: { id: parsed.slipId }, include: { items: true, employee: true } }
      }
    });

    if (!run) throw new AppError('Payroll run not found', 404);
    if (run.status === 'PAID') throw new AppError('Cannot modify finalized PAID payroll run', 400);
    if (run.status === 'APPROVED') throw new AppError('Cannot defer tax on an APPROVED payroll run without re-draft authorization', 400);

    const slip = run.slips[0];
    if (!slip) throw new AppError('Payroll slip not found in this run', 404);

    const tdsItem = slip.items.find(i => i.code === 'TDS');
    const currentTds = tdsItem ? new Decimal(tdsItem.amount) : new Decimal(0);

    if (new Decimal(parsed.deferralAmount).greaterThan(currentTds)) {
      throw new AppError(`Cannot defer ₹${parsed.deferralAmount}. Current calculated TDS is only ₹${currentTds.toFixed(2)}.`, 400);
    }

    const revisedTds = currentTds.minus(parsed.deferralAmount);

    const updated = await prisma.$transaction(async (tx) => {
      // Update TDS item
      if (tdsItem) {
        await tx.corporatePayrollItem.update({
          where: { id: tdsItem.id },
          data: { amount: revisedTds }
        });
      }

      // Re-sum items
      const allItems = await tx.corporatePayrollItem.findMany({ where: { payrollSlipId: slip.id } });
      let newDeductions = new Decimal(0);
      let newGross = new Decimal(0);

      for (const it of allItems) {
        if (it.type === 'DEDUCTION') newDeductions = newDeductions.plus(new Decimal(it.amount));
        if (it.type === 'EARNING') newGross = newGross.plus(new Decimal(it.amount));
      }

      const newNet = Decimal.max(0, newGross.minus(newDeductions).plus(slip.reimbursementAmount));
      const snap = (slip.calculationSnapshot as any) || {};

      const deferralRecord = {
        employeeId: slip.employeeId,
        employeeCode: slip.employee.employeeCode,
        deferralAmount: parsed.deferralAmount,
        originalTds: currentTds.toNumber(),
        revisedTds: revisedTds.toNumber(),
        reason: parsed.reason,
        recoveryPeriod: parsed.recoveryPeriod,
        approvedBy: req.user!.fullName,
        timestamp: new Date().toISOString()
      };

      const existingVariance = (run.varianceNotes as any) || {};
      const currentDeferrals = existingVariance.tdsDeferrals || [];
      currentDeferrals.push(deferralRecord);

      await tx.corporatePayrollRun.update({
        where: { id: run.id },
        data: {
          varianceNotes: {
            ...existingVariance,
            tdsDeferrals: currentDeferrals
          }
        }
      });

      const updatedSlip = await tx.corporatePayrollSlip.update({
        where: { id: slip.id },
        data: {
          deductionsPay: newDeductions,
          netPay: newNet,
          calculationSnapshot: {
            ...snap,
            tdsDeferral: deferralRecord
          }
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
          remarks: `Authorized TDS deferral of ₹${parsed.deferralAmount} for ${slip.employee.employeeCode} to ${parsed.recoveryPeriod} (${parsed.reason})`
        }
      });

      return updatedSlip;
    });

    res.status(200).json({ slip: updated, message: `TDS deferral of ₹${parsed.deferralAmount} recorded for recovery in ${parsed.recoveryPeriod}.` });
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



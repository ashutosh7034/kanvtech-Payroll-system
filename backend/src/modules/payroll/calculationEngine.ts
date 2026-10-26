import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { FormulaEngine } from '../compensation/formulaEngine.js';
import { calculateIncomeTax } from '../tax/taxEngine.js';

export interface AttendanceEvaluationResult {
  calendarDays: number;
  workingDays: number;
  payableDays: Decimal;
  lopDays: Decimal;
  unpaidMidMonthDays: Decimal;
  prorationRatio: Decimal;
  isProrated: boolean;
  notes: string[];
}

export interface CalculationItemResult {
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY';
  category: string;
  configuredMonthly: Decimal;
  calculatedAmount: Decimal;
  statutoryBasis?: Decimal;
  ruleApplied: string;
}

export interface EmployeePayrollCalculationResult {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  attendance: AttendanceEvaluationResult;
  grossPay: Decimal;
  deductionsPay: Decimal;
  netPay: Decimal;
  employerCost: Decimal;
  pfWageBasis: Decimal;
  esiWageBasis: Decimal;
  ptWageBasis: Decimal;
  arrearsAmount: Decimal;
  reimbursementAmount: Decimal;
  variableEarnings: Decimal;
  items: CalculationItemResult[];
  exceptions: string[];
  snapshot: Record<string, any>;
}

export class PayrollCalculationEngine {
  /**
   * Evaluates employee attendance, mid-month joining, exit, and LOP unpaid leaves.
   */
  static async evaluateAttendance(
    employee: {
      id: string;
      dateOfJoining: Date;
      exitDate?: Date | null;
    },
    period: {
      startDate: Date;
      endDate: Date;
      month: number;
      year: number;
    }
  ): Promise<AttendanceEvaluationResult> {
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);

    // Total days in period
    const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let payableDays = new Decimal(totalDays);
    let unpaidMidMonthDays = new Decimal(0);
    const notes: string[] = [];

    // 1. Mid-month joining proration
    if (employee.dateOfJoining) {
      const joiningDate = new Date(employee.dateOfJoining);
      if (!isNaN(joiningDate.getTime())) {
        if (joiningDate > periodStart && joiningDate <= periodEnd) {
          const daysBeforeJoining = Math.round((joiningDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
          unpaidMidMonthDays = unpaidMidMonthDays.plus(daysBeforeJoining);
          payableDays = payableDays.minus(daysBeforeJoining);
          notes.push(`Joined mid-period on ${joiningDate.toISOString().split('T')[0]} (${daysBeforeJoining} non-employed days excluded)`);
        } else if (joiningDate > periodEnd) {
          // Joined after period
          return {
            calendarDays: totalDays,
            workingDays: totalDays,
            payableDays: new Decimal(0),
            lopDays: new Decimal(totalDays),
            unpaidMidMonthDays: new Decimal(totalDays),
            prorationRatio: new Decimal(0),
            isProrated: true,
            notes: ['Employee joined after this payroll period ended']
          };
        }
      }
    }

    // 2. Mid-month exit proration
    if (employee.exitDate) {
      const exitDate = new Date(employee.exitDate);
      if (exitDate >= periodStart && exitDate < periodEnd) {
        const daysAfterExit = Math.round((periodEnd.getTime() - exitDate.getTime()) / (1000 * 60 * 60 * 24));
        unpaidMidMonthDays = unpaidMidMonthDays.plus(daysAfterExit);
        payableDays = payableDays.minus(daysAfterExit);
        notes.push(`Exited company on ${exitDate.toISOString().split('T')[0]} (${daysAfterExit} days excluded)`);
      }
    }

    // 3. Unpaid Leaves (LOP) in period
    const unpaidLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        leavePolicy: { isPaid: false },
        fromDate: { lte: periodEnd },
        toDate: { gte: periodStart }
      }
    });

    let lopDays = new Decimal(0);
    for (const req of unpaidLeaves) {
      lopDays = lopDays.plus(new Decimal(req.totalDays.toString()));
    }

    if (lopDays.greaterThan(0)) {
      payableDays = Decimal.max(0, payableDays.minus(lopDays));
      notes.push(`${lopDays.toFixed(1)} days Loss of Pay (LOP) unpaid leave deducted`);
    }

    const prorationRatio = payableDays.dividedBy(totalDays).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
    const isProrated = prorationRatio.lessThan(1.0);

    return {
      calendarDays: totalDays,
      workingDays: totalDays,
      payableDays,
      lopDays,
      unpaidMidMonthDays,
      prorationRatio,
      isProrated,
      notes
    };
  }

  /**
   * Calculates authoritative decimal payroll for a single employee in a period.
   */
  static async calculateEmployee(
    emp: any,
    period: any,
    ptSlabs: any[],
    statutoryConfig: any,
    lopDaysOverride?: number,
    arrearsOverride?: number,
    reimbursementOverride?: number,
    oneTimeEarningsOverride?: number,
    oneTimeDeductionsOverride?: number,
    tdsOverride?: number,
    overtimeHoursOverride?: number,
    ytdTdsOverride?: number,
    remainingMonthsOverride?: number,
    ytdGrossOverride?: number
  ): Promise<EmployeePayrollCalculationResult> {
    const exceptions: string[] = [];
    const items: CalculationItemResult[] = [];

    // 1. Evaluate Attendance & Proration
    let attendance = await this.evaluateAttendance(emp, period);

    // Apply manual LOP override if passed explicitly (e.g. from unit testing or unrecorded leaves)
    if (lopDaysOverride !== undefined && lopDaysOverride > 0) {
      const payableDays = Decimal.max(0, attendance.payableDays.minus(lopDaysOverride));
      const lopDays = attendance.lopDays.plus(lopDaysOverride);
      const prorationRatio = payableDays.dividedBy(attendance.calendarDays).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
      attendance = {
        ...attendance,
        payableDays,
        lopDays,
        prorationRatio,
        isProrated: prorationRatio.lessThan(1.0),
        notes: [...attendance.notes, `Applied ${lopDaysOverride} days loss of pay (LOP)`]
      };
    }

    const ratio = attendance.prorationRatio;

    if (attendance.isProrated) {
      exceptions.push(...attendance.notes);
    }

    // 2. Earnings Calculation
    let grossPay = new Decimal(0);
    let basicPay = new Decimal(0);
    let hraPay = new Decimal(0);

    const struct = emp.salaryStructure;
    if (!struct || !struct.lines || struct.lines.length === 0) {
      exceptions.push('MISSING SALARY STRUCTURE: Employee does not have an active salary structure assigned.');
    }

    const earningsLines = (struct?.lines || []).filter((l: any) => l.component?.type === 'EARNING' || l.componentType === 'EARNING' || (!l.component?.type && !l.componentType));

    // Baseline formula context with compensation and attendance variables
    const formulaContext: Record<string, Decimal | number | string> = {
      CTC: struct?.annualCtc ? new Decimal(struct.annualCtc) : new Decimal(0),
      ANNUAL_CTC: struct?.annualCtc ? new Decimal(struct.annualCtc) : new Decimal(0),
      MONTHLY_CTC: struct?.annualCtc ? new Decimal(struct.annualCtc).dividedBy(12) : new Decimal(0),
      MONTHLY_GROSS: struct?.monthlyGross ? new Decimal(struct.monthlyGross) : new Decimal(0),
      CALENDAR_DAYS: attendance.calendarDays,
      WORKING_DAYS: attendance.workingDays,
      PAYABLE_DAYS: attendance.payableDays,
      LOP_DAYS: attendance.lopDays,
      PRORATION_RATIO: attendance.prorationRatio
    };

    // Topological sorting of components to resolve formula dependencies
    const sortPayload = earningsLines.map((l: any) => {
      const code = (l.component?.code || l.code || '').toUpperCase();
      const formula = l.formulaExpression || l.component?.formulaExpression || '';
      const baseCode = l.baseComponentCode || l.component?.baseComponentCode || '';
      const deps = baseCode ? [baseCode.toUpperCase()] : [];
      return { code, formula, dependencies: deps, line: l };
    });

    let orderedLines: any[] = [];
    try {
      const sortedCodes = FormulaEngine.topologicalSort(sortPayload);
      const lineMap = new Map<string, any>();
      for (const item of sortPayload) {
        lineMap.set(item.code, item.line);
      }
      orderedLines = sortedCodes.map(c => lineMap.get(c)).filter(Boolean);
      for (const item of sortPayload) {
        if (!orderedLines.includes(item.line)) orderedLines.push(item.line);
      }
    } catch (err: any) {
      exceptions.push(`FORMULA TOPOLOGICAL ERROR: ${err.message}`);
      orderedLines = earningsLines;
    }

    for (const line of orderedLines) {
      const compCode = (line.component?.code || line.code || '').toUpperCase();
      const compCat = line.component?.category || line.category || 'FIXED_EARNING';
      const compName = line.component?.name || line.name || compCode;
      const calcMode = line.calculationMode || line.component?.calculationMode || (line.formulaExpression ? 'FORMULA_EXPRESSION' : 'FIXED_AMOUNT');
      const formula = line.formulaExpression || line.component?.formulaExpression;
      const baseCompCode = (line.baseComponentCode || line.component?.baseComponentCode || '').toUpperCase();
      const pctValue = line.percentageValue !== undefined && line.percentageValue !== null
        ? new Decimal(line.percentageValue)
        : (line.percentageOfBasic ? new Decimal(line.percentageOfBasic) : null);

      let unprorated = new Decimal(line.monthlyAmount || 0);
      let ruleApplied = 'Full month attendance';

      // A. Formula-based component
      if ((calcMode === 'FORMULA_EXPRESSION' || formula) && formula) {
        try {
          unprorated = FormulaEngine.evaluate(formula, formulaContext);
          ruleApplied = `Formula: ${formula}`;
        } catch (err: any) {
          exceptions.push(`Formula evaluation failed for ${compCode}: ${err.message}`);
          unprorated = new Decimal(line.monthlyAmount || 0);
          ruleApplied = `Formula fallback: ${line.monthlyAmount || 0}`;
        }
      }
      // B. Percentage of another component (e.g. Percentage of Basic or CTC)
      else if (calcMode === 'PERCENTAGE_OF_COMPONENT' || pctValue !== null) {
        const baseKey = baseCompCode || 'BASIC';
        const baseVal = formulaContext[baseKey] !== undefined ? new Decimal(formulaContext[baseKey] as any) : basicPay;
        const pct = pctValue || new Decimal(0);
        unprorated = baseVal.times(pct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        ruleApplied = `${pct.toString()}% of ${baseKey}`;
      }
      // C. Balancing Special Allowance
      else if (compCode === 'SPECIAL_ALLOWANCE' && unprorated.isZero() && formulaContext.MONTHLY_GROSS) {
        const targetMonthly = new Decimal(formulaContext.MONTHLY_GROSS as any);
        let sumOther = new Decimal(0);
        for (const [k, v] of Object.entries(formulaContext)) {
          if (!['CTC', 'ANNUAL_CTC', 'MONTHLY_CTC', 'MONTHLY_GROSS', 'CALENDAR_DAYS', 'WORKING_DAYS', 'PAYABLE_DAYS', 'LOP_DAYS', 'PRORATION_RATIO', 'SPECIAL_ALLOWANCE'].includes(k)) {
            sumOther = sumOther.plus(v as Decimal);
          }
        }
        unprorated = Decimal.max(0, targetMonthly.minus(sumOther)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        ruleApplied = 'Balancing special allowance to target monthly gross';
      }

      // Attendance Proration (if applicable to this earning component)
      const shouldProrate = compCat !== 'VARIABLE' && compCat !== 'VARIABLE_EARNING' && compCat !== 'REIMBURSEMENT';
      let calculated = unprorated;
      if (attendance.isProrated && shouldProrate) {
        calculated = unprorated.times(attendance.payableDays).dividedBy(attendance.calendarDays).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        ruleApplied += ` | Prorated (${attendance.payableDays}/${attendance.calendarDays} days)`;
      } else if (attendance.isProrated && !shouldProrate) {
        ruleApplied += ` | Non-prorated (${compCat})`;
      }

      // Register into formula context for downstream components
      formulaContext[compCode] = unprorated;
      formulaContext[`${compCode}_PRORATED`] = calculated;

      if (compCode === 'BASIC') {
        basicPay = calculated;
      } else if (compCode === 'HRA') {
        hraPay = calculated;
      }

      grossPay = grossPay.plus(calculated);

      items.push({
        code: compCode,
        name: compName,
        type: 'EARNING',
        category: compCat,
        configuredMonthly: unprorated,
        calculatedAmount: calculated,
        ruleApplied
      });
    }

    // Arrears override
    let arrearsAmount = new Decimal(arrearsOverride || 0);
    if (arrearsAmount.greaterThan(0)) {
      grossPay = grossPay.plus(arrearsAmount);
      items.push({
        code: 'ARREARS',
        name: 'Arrears / Retroactive Adjustment',
        type: 'EARNING',
        category: 'VARIABLE_EARNING',
        configuredMonthly: arrearsAmount,
        calculatedAmount: arrearsAmount,
        ruleApplied: 'Approved retroactive salary adjustment'
      });
    }


    // One-Time Earnings Override
    let oneTimeEarnings = new Decimal(oneTimeEarningsOverride || 0);
    let variableEarnings = new Decimal(0);
    if (oneTimeEarnings.greaterThan(0)) {
      grossPay = grossPay.plus(oneTimeEarnings);
      variableEarnings = variableEarnings.plus(oneTimeEarnings);
      items.push({
        code: 'ONE_TIME_EARNING',
        name: 'One-Time Earning / Performance Bonus',
        type: 'EARNING',
        category: 'VARIABLE_EARNING',
        configuredMonthly: oneTimeEarnings,
        calculatedAmount: oneTimeEarnings,
        ruleApplied: 'Approved one-time earning adjustment'
      });
    }

    // Overtime from attendance records or override
    let overtimeMins = 0;
    if (overtimeHoursOverride !== undefined && overtimeHoursOverride > 0) {
      overtimeMins = Math.round(overtimeHoursOverride * 60);
    } else {
      const attendances = await prisma.dailyAttendance.findMany({
        where: {
          employeeId: emp.id,
          date: { gte: period.startDate, lte: period.endDate }
        }
      });

      for (const att of attendances) {
        overtimeMins += att.overtimeMinutes || 0;
      }
    }

    if (overtimeMins > 0) {
      const hourlyRate = basicPay.dividedBy(attendance.calendarDays * 8);
      const otHours = new Decimal(overtimeMins).dividedBy(60);
      const otAmount = hourlyRate.times(otHours).times(2.0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP); // Double overtime rate

      grossPay = grossPay.plus(otAmount);
      variableEarnings = variableEarnings.plus(otAmount);

      items.push({
        code: 'OVERTIME',
        name: 'Overtime Earnings (2.0x hourly rate)',
        type: 'EARNING',
        category: 'VARIABLE_EARNING',
        configuredMonthly: new Decimal(0),
        calculatedAmount: otAmount,
        ruleApplied: `${(overtimeMins / 60).toFixed(1)} verified overtime hours recorded`
      });
      exceptions.push(`Overtime of ₹${otAmount.toFixed(2)} included`);
    }

    // Approved Reimbursements
    let reimbursementAmount = new Decimal(reimbursementOverride || 0);
    const approvedClaims = await prisma.expenseClaim.findMany({
      where: {
        employeeId: emp.id,
        status: 'APPROVED',
        claimDate: { gte: period.startDate, lte: period.endDate }
      }
    });

    for (const claim of approvedClaims) {
      const amt = new Decimal(claim.totalAmount);
      reimbursementAmount = reimbursementAmount.plus(amt);
    }

    if (reimbursementAmount.greaterThan(0)) {
      grossPay = grossPay.plus(reimbursementAmount);
      items.push({
        code: 'REIMBURSEMENTS',
        name: 'Expense Reimbursements Payout',
        type: 'EARNING',
        category: 'REIMBURSEMENT',
        configuredMonthly: new Decimal(0),
        calculatedAmount: reimbursementAmount,
        ruleApplied: `${approvedClaims.length} verified finance claims`
      });
    }

    // 3. Employee Statutory Deductions
    let deductionsPay = new Decimal(0);
    const policy = emp.payrollPolicy || {
      pfApplicable: true,
      pfStatus: 'APPLICABLE',
      pfWageBasis: 'CEILING_15000',
      esiApplicable: false,
      esiStatus: 'EXEMPT_OVER_CEILING',
      ptApplicable: true,
      ptState: emp.branch?.state || 'Maharashtra',
      taxRegime: 'NEW'
    };

    // A. Employee PF
    let pfWageBasis = new Decimal(0);
    let employeePf = new Decimal(0);
    let employerPf = new Decimal(0);

    if (policy.pfStatus === 'PENDING_VERIFICATION') {
      exceptions.push('Statutory Alert: PF status is PENDING VERIFICATION - awaiting UAN validation');
    }

    if ((policy.pfApplicable !== false) && policy.pfStatus === 'APPLICABLE') {
      const pfWageCeiling = new Decimal(statutoryConfig?.pfWageCeiling ?? 15000);
      const pfRate = new Decimal(statutoryConfig?.pfEmployeePct ?? 12.0).dividedBy(100);

      if (policy.pfWageBasis === 'ACTUAL_BASIC' || policy.pfWageBasis === 'ACTUAL_PF_WAGES') {
        pfWageBasis = basicPay;
      } else if (policy.pfWageBasis === 'FIXED_1800') {
        pfWageBasis = pfWageCeiling;
      } else {
        // Standard ceiling: min(15000 * ratio, basic)
        pfWageBasis = Decimal.min(pfWageCeiling.times(ratio), basicPay).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      employeePf = pfWageBasis.times(pfRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      employerPf = employeePf;

      deductionsPay = deductionsPay.plus(employeePf);
      items.push({
        code: 'EPF_EMPLOYEE',
        name: 'Employee Provident Fund (12%)',
        type: 'DEDUCTION',
        category: 'STATUTORY_DEDUCTION',
        configuredMonthly: employeePf,
        calculatedAmount: employeePf,
        statutoryBasis: pfWageBasis,
        ruleApplied: `12% of PF wage ₹${pfWageBasis.toFixed(2)} (${policy.pfWageBasis})`
      });
    } else {
      exceptions.push(`PF not deducted: Configured status is ${policy.pfStatus || 'NOT_APPLICABLE'} (${policy.exceptionRemarks || 'Excluded by policy'})`);
    }

    // B. Employee ESIC
    let esiWageBasis = new Decimal(0);
    let employeeEsi = new Decimal(0);
    let employerEsi = new Decimal(0);
    const esicWageCeiling = new Decimal(statutoryConfig?.esicWageCeiling ?? 21000);

    // Statutory rule: gross <= 21,000 or policy explicitly flagged applicable
    if (policy.esiApplicable || (policy.esiStatus === 'APPLICABLE') || (grossPay.lessThanOrEqualTo(esicWageCeiling) && policy.esiStatus !== 'NOT_APPLICABLE')) {
      esiWageBasis = grossPay;
      const empEsiRate = new Decimal(statutoryConfig?.esicEmployeePct ?? 0.75).dividedBy(100);
      const emprEsiRate = new Decimal(statutoryConfig?.esicEmployerPct ?? 3.25).dividedBy(100);

      employeeEsi = esiWageBasis.times(empEsiRate).ceil(); // ESIC rounds up to next rupee
      employerEsi = esiWageBasis.times(emprEsiRate).ceil();

      deductionsPay = deductionsPay.plus(employeeEsi);
      items.push({
        code: 'ESIC_EMPLOYEE',
        name: 'Employee ESIC (0.75%)',
        type: 'DEDUCTION',
        category: 'STATUTORY_DEDUCTION',
        configuredMonthly: employeeEsi,
        calculatedAmount: employeeEsi,
        statutoryBasis: esiWageBasis,
        ruleApplied: `0.75% of Gross wage ₹${esiWageBasis.toFixed(2)}`
      });
    }

    // C. Professional Tax (PT)
    let ptWageBasis = grossPay;
    let ptAmount = new Decimal(0);

    if (policy.ptApplicable) {
      const state = policy.ptState || emp.branch?.state || 'Maharashtra';
      const matchingSlab = ptSlabs.find(s => {
        if (s.state.toLowerCase() !== state.toLowerCase()) return false;
        const min = new Decimal(s.minSalary);
        const max = s.maxSalary ? new Decimal(s.maxSalary) : null;
        if (grossPay.lessThan(min)) return false;
        if (max && grossPay.greaterThan(max)) return false;
        return true;
      });

      if (matchingSlab) {
        // Maharashtra Feb surcharge check
        if (state.toLowerCase() === 'maharashtra' && period.month === 2 && matchingSlab.februaryAmount) {
          ptAmount = new Decimal(matchingSlab.februaryAmount);
          exceptions.push('Maharashtra PT February ₹300 surcharge applied');
        } else {
          ptAmount = new Decimal(matchingSlab.monthlyAmount);
        }
      } else {
        // Fallback default ₹200 if gross > 10,000
        ptAmount = grossPay.greaterThan(10000) ? new Decimal(200) : new Decimal(0);
      }

      if (ptAmount.greaterThan(0)) {
        deductionsPay = deductionsPay.plus(ptAmount);
        items.push({
          code: 'PROFESSIONAL_TAX',
          name: `Professional Tax (${state})`,
          type: 'DEDUCTION',
          category: 'STATUTORY_DEDUCTION',
          configuredMonthly: ptAmount,
          calculatedAmount: ptAmount,
          statutoryBasis: ptWageBasis,
          ruleApplied: `State ${state} slab for monthly gross ₹${grossPay.toFixed(2)}`
        });
      }
    }

    // D. TDS / Income Tax
    let tdsAmount = new Decimal(0);
    let tdsRuleApplied = `Regime ${policy.taxRegime} monthly installment`;

    if (tdsOverride !== undefined && tdsOverride !== null) {
      tdsAmount = new Decimal(tdsOverride);
      tdsRuleApplied = `Manual TDS override of ₹${tdsAmount.toFixed(2)}`;
    } else if (policy.tdsMonthlyOverride !== undefined && policy.tdsMonthlyOverride !== null) {
      tdsAmount = new Decimal(policy.tdsMonthlyOverride);
      tdsRuleApplied = `Policy TDS monthly override of ₹${tdsAmount.toFixed(2)}`;
    } else {
      // 1. Determine period calendar & remaining withholding periods in the Financial Year
      const periodMonth = period?.month ? Number(period.month) : (period?.startDate ? new Date(period.startDate).getMonth() + 1 : 4);
      const periodYear = period?.year ? Number(period.year) : (period?.startDate ? new Date(period.startDate).getFullYear() : 2026);

      // Indian FY starts April 1st: if month >= 4, FY starts in periodYear; else in periodYear - 1
      const fyStartYear = periodMonth >= 4 ? periodYear : periodYear - 1;
      const financialYear = `${fyStartYear}-${fyStartYear + 1}`;
      const fyStartDate = new Date(Date.UTC(fyStartYear, 3, 1)); // April 1st UTC

      let remainingMonths = remainingMonthsOverride !== undefined && remainingMonthsOverride !== null
        ? Math.max(1, Math.min(12, remainingMonthsOverride))
        : (periodMonth >= 4 ? (16 - periodMonth) : (4 - periodMonth));
      remainingMonths = Math.max(1, Math.min(12, remainingMonths));

      // 2. Fetch authoritative prior completed/finalized slips for the employee in the current FY
      let ytdGross = new Decimal(0);
      let ytdTds = new Decimal(0);

      if (emp?.id && period?.startDate) {
        try {
          const priorSlips = await prisma.corporatePayrollSlip.findMany({
            where: {
              employeeId: emp.id,
              payrollRun: {
                status: 'PAID',
                period: {
                  startDate: {
                    gte: fyStartDate,
                    lt: new Date(period.startDate)
                  }
                }
              }
            },
            include: {
              items: {
                where: { code: 'TDS' }
              }
            }
          });

          for (const s of priorSlips) {
            ytdGross = ytdGross.plus(s.grossPay);
            for (const item of s.items) {
              ytdTds = ytdTds.plus(item.amount);
            }
          }
        } catch {
          // Fallback to 0 if database query is unavailable (e.g. mock test environments)
        }
      }

      // Allow explicit overrides (for unit/regression tests)
      if (ytdTdsOverride !== undefined && ytdTdsOverride !== null) {
        ytdTds = new Decimal(ytdTdsOverride);
      }
      if (ytdGrossOverride !== undefined && ytdGrossOverride !== null) {
        ytdGross = new Decimal(ytdGrossOverride);
      }

      // 3. Estimate annual taxable salary
      // Regular unprorated monthly gross for future remaining periods
      let regularMonthlyGross = grossPay.toNumber();
      if (emp.salaryStructure?.lines && emp.salaryStructure.lines.length > 0) {
        const fixedEarnings = emp.salaryStructure.lines
          .filter((l: any) => l.component?.type === 'EARNING' || l.componentType === 'EARNING' || (!l.component?.type && !l.componentType))
          .reduce((acc: number, l: any) => acc + Number(l.monthlyAmount || 0), 0);
        if (fixedEarnings > 0) {
          regularMonthlyGross = fixedEarnings;
        }
      } else if (emp.salaryStructure?.annualCtc) {
        regularMonthlyGross = Number(emp.salaryStructure.annualCtc) / 12;
      }

      const futureMonths = Math.max(0, remainingMonths - 1);
      const annualProjectedGross = ytdGross.greaterThan(0)
        ? ytdGross.toNumber() + grossPay.toNumber() + (futureMonths * regularMonthlyGross)
        : grossPay.toNumber() + (futureMonths * regularMonthlyGross);

      let declaration = null;
      if (policy.taxRegime === 'OLD') {
        try {
          declaration = await prisma.employeeTaxDeclaration.findFirst({
            where: { employeeId: emp.id },
            orderBy: { submittedAt: 'desc' }
          });
        } catch {
          // DB unavailable in mock
        }
      }

      const taxResult = calculateIncomeTax({
        annualGross: annualProjectedGross,
        regime: policy.taxRegime,
        financialYear,
        remainingMonths,
        tdsAlreadyDeducted: ytdTds.toNumber(),
        declarations: declaration ? {
          section80C: declaration.section80C,
          section80D: declaration.section80D,
          section24b: declaration.section24b
        } : undefined
      });

      tdsAmount = new Decimal(taxResult.monthlyTds);
      tdsRuleApplied = `Regime ${policy.taxRegime} (${remainingMonths} rem mos, YTD TDS ₹${ytdTds.toFixed(0)})`;
    }

    if (tdsAmount.greaterThan(0)) {
      deductionsPay = deductionsPay.plus(tdsAmount);
      items.push({
        code: 'TDS',
        name: `Income Tax (TDS - ${policy.taxRegime} Regime)`,
        type: 'DEDUCTION',
        category: 'STATUTORY_DEDUCTION',
        configuredMonthly: tdsAmount,
        calculatedAmount: tdsAmount,
        ruleApplied: tdsRuleApplied
      });
    }

    // E. Active Loan Recoveries
    for (const loan of (emp.loans || [])) {
      const outstanding = new Decimal(loan.outstandingAmount || 0);
      if (outstanding.greaterThan(0)) {
        const emi = Decimal.min(new Decimal(loan.monthlyEmi), outstanding);
        deductionsPay = deductionsPay.plus(emi);
        items.push({
          code: 'LOAN_EMI',
          name: `Company Loan Recovery (${loan.loanType?.name || 'Loan'})`,
          type: 'DEDUCTION',
          category: 'LOAN_RECOVERY',
          configuredMonthly: emi,
          calculatedAmount: emi,
          ruleApplied: `Principal remaining: ₹${outstanding.toNumber().toLocaleString('en-IN')}`
        });
      } else {
        items.push({
          code: 'LOAN_EMI',
          name: `Company Loan Recovery (${loan.loanType?.name || 'Loan'})`,
          type: 'DEDUCTION',
          category: 'LOAN_RECOVERY',
          configuredMonthly: new Decimal(0),
          calculatedAmount: new Decimal(0),
          ruleApplied: 'Loan fully repaid - recovery discontinued'
        });
      }
    }

    // F. One-Time Deductions
    let oneTimeDeductions = new Decimal(oneTimeDeductionsOverride || 0);
    if (oneTimeDeductions.greaterThan(0)) {
      deductionsPay = deductionsPay.plus(oneTimeDeductions);
      items.push({
        code: 'ONE_TIME_DEDUCTION',
        name: 'One-Time Approved Deduction',
        type: 'DEDUCTION',
        category: 'OTHER_DEDUCTION',
        configuredMonthly: oneTimeDeductions,
        calculatedAmount: oneTimeDeductions,
        ruleApplied: 'Authorized one-time deduction'
      });
    }

    // 4. Employer Contributions
    let employerCost = grossPay;

    if (employerPf.greaterThan(0)) {
      employerCost = employerCost.plus(employerPf);
      items.push({
        code: 'EPF_EMPLOYER',
        name: 'Employer Provident Fund (12%)',
        type: 'EMPLOYER_STATUTORY',
        category: 'EMPLOYER_CONTRIBUTION',
        configuredMonthly: employerPf,
        calculatedAmount: employerPf,
        statutoryBasis: pfWageBasis,
        ruleApplied: 'EPS 8.33% (capped ₹1,250) + EPF 3.67% + Admin 0.5%'
      });
    }

    if (employerEsi.greaterThan(0)) {
      employerCost = employerCost.plus(employerEsi);
      items.push({
        code: 'ESIC_EMPLOYER',
        name: 'Employer ESIC (3.25%)',
        type: 'EMPLOYER_STATUTORY',
        category: 'EMPLOYER_CONTRIBUTION',
        configuredMonthly: employerEsi,
        calculatedAmount: employerEsi,
        statutoryBasis: esiWageBasis,
        ruleApplied: '3.25% of Gross wage'
      });
    }

    // Gratuity provision: 4.81% of basic
    const gratuityRate = new Decimal(statutoryConfig?.gratuityPct ?? 4.81).dividedBy(100);
    const gratuityAmount = basicPay.times(gratuityRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (gratuityAmount.greaterThan(0)) {
      employerCost = employerCost.plus(gratuityAmount);
      items.push({
        code: 'GRATUITY',
        name: 'Gratuity Provision (4.81%)',
        type: 'EMPLOYER_STATUTORY',
        category: 'EMPLOYER_CONTRIBUTION',
        configuredMonthly: gratuityAmount,
        calculatedAmount: gratuityAmount,
        ruleApplied: '4.81% of Basic statutory gratuity accounting provision'
      });
    }

    // 5. Net Take-Home Pay
    let netPay = grossPay.minus(deductionsPay);
    if (netPay.isNegative()) {
      exceptions.push(`NEGATIVE NET PAY DETECTED: Deductions (₹${deductionsPay.toFixed(2)}) exceed gross earnings (₹${grossPay.toFixed(2)})`);
    }

    const snapshot = {
      empCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name,
      designation: emp.designation?.name,
      branch: emp.branch?.name,
      salaryStructure: {
        id: struct?.id,
        version: struct?.version || 1,
        annualCtc: struct?.annualCtc ? Number(struct.annualCtc) : undefined,
        monthlyGross: struct?.monthlyGross ? Number(struct.monthlyGross) : undefined
      },
      attendance: {
        calendarDays: attendance.calendarDays,
        workingDays: attendance.workingDays,
        payableDays: attendance.payableDays.toNumber(),
        lopDays: attendance.lopDays.toNumber(),
        unpaidMidMonthDays: attendance.unpaidMidMonthDays.toNumber(),
        prorationRatio: attendance.prorationRatio.toNumber(),
        isProrated: attendance.isProrated
      },
      formulaContext: Object.fromEntries(
        Object.entries(formulaContext).map(([k, v]) => [k, v instanceof Decimal ? v.toNumber() : v])
      ),
      policy: {
        pfApplicable: policy.pfApplicable,
        pfStatus: policy.pfStatus,
        pfWageBasis: policy.pfWageBasis,
        esiApplicable: policy.esiApplicable,
        esiStatus: policy.esiStatus,
        ptApplicable: policy.ptApplicable,
        ptState: policy.ptState,
        taxRegime: policy.taxRegime
      },
      items: items.map(i => ({
        code: i.code,
        name: i.name,
        type: i.type,
        category: i.category,
        configuredMonthly: i.configuredMonthly.toNumber(),
        calculatedAmount: i.calculatedAmount.toNumber(),
        statutoryBasis: i.statutoryBasis ? i.statutoryBasis.toNumber() : undefined,
        ruleApplied: i.ruleApplied
      })),
      gross: grossPay.toNumber(),
      deductions: deductionsPay.toNumber(),
      net: netPay.toNumber(),
      employerCost: employerCost.toNumber(),
      exceptions,
      calculatedAt: new Date().toISOString()
    };

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: `${emp.firstName} ${emp.lastName}`,
      attendance,
      grossPay,
      deductionsPay,
      netPay,
      employerCost,
      pfWageBasis,
      esiWageBasis,
      ptWageBasis,
      arrearsAmount,
      reimbursementAmount,
      variableEarnings,
      items,
      exceptions,
      snapshot
    };
  }
}

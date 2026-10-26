import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { FormulaEngine } from './formulaEngine.js';

export const compensationRouter = Router();

// ==========================================
// 1. SALARY COMPONENT MASTER
// ==========================================

// 1.1 List Salary Components (with filters)
compensationRouter.get('/components', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, type, search, active } = req.query;
    const where: any = { companyId: req.user!.companyId };

    if (category) where.category = String(category);
    if (type) where.type = type as any;
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { code: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const components = await prisma.salaryComponent.findMany({
      where,
      orderBy: { displayOrder: 'asc' }
    });
    res.status(200).json({ components });
  } catch (error) {
    next(error);
  }
});

// 1.2 Validate Formula Expression & Detect Cycle & Simulate
compensationRouter.post('/components/validate-formula', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().optional().default('PREVIEW_COMP'),
      formula: z.string().optional(),
      expression: z.string().optional(),
      context: z.record(z.number()).optional()
    });
    const parsed = schema.parse(req.body);
    const code = parsed.code || 'PREVIEW_COMP';
    const formula = parsed.formula || parsed.expression;
    if (!formula || !formula.trim()) {
      res.status(400).json({
        valid: false,
        error: 'Formula expression is required',
        variables: [],
        missingVariables: [],
        dependencyOrder: [],
        steps: []
      });
      return;
    }

    const variables = FormulaEngine.extractVariables(formula);

    // Fetch other components in the company to check for circular dependency
    const allComponents = await prisma.salaryComponent.findMany({
      where: { companyId: req.user!.companyId, active: true },
      select: { code: true, formulaExpression: true }
    });

    const graph = allComponents
      .filter(c => c.code !== code.toUpperCase())
      .map(c => ({ code: c.code, formula: c.formulaExpression || undefined }));

    graph.push({ code: code.toUpperCase(), formula });

    const cycle = FormulaEngine.detectCycle(graph);
    if (cycle) {
      res.status(400).json({
        valid: false,
        error: `Circular dependency detected: ${cycle.join(' ➔ ')}`,
        cycle,
        variables,
        referencedVariables: variables,
        missingVariables: [],
        dependencyOrder: [],
        steps: []
      });
      return;
    }

    // Check for missing variables
    const systemVariables = new Set(['CTC', 'BASIC', 'GROSS', 'NET', 'PRESENT_DAYS', 'WORKING_DAYS', 'LOP_DAYS']);
    const existingCodes = new Set(allComponents.map(c => c.code.toUpperCase()));
    const customContextKeys = new Set(Object.keys(parsed.context || {}).map(k => k.toUpperCase()));

    const missingVariables = variables.filter(
      v => !systemVariables.has(v) && !existingCodes.has(v) && !customContextKeys.has(v)
    );

    // Deterministic dependency order
    let dependencyOrder: string[] = [];
    try {
      dependencyOrder = FormulaEngine.topologicalSort(graph);
    } catch {
      dependencyOrder = variables;
    }

    // Test evaluation with context (merge default mock values with user-provided context)
    const testContext: Record<string, number> = {
      CTC: 100000,
      BASIC: 40000,
      GROSS: 80000,
      NET: 70000,
      PRESENT_DAYS: 30,
      WORKING_DAYS: 30,
      LOP_DAYS: 0,
      ...(parsed.context || {})
    };

    for (const v of variables) {
      if (testContext[v] === undefined) testContext[v] = 1000;
    }

    const testResult = FormulaEngine.evaluate(formula, testContext);

    const steps = variables.map(v => ({
      variable: v,
      value: testContext[v] ?? 0
    }));

    const roundedVal = testResult.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const formattedVal = testResult.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();

    res.status(200).json({
      valid: true,
      variables,
      referencedVariables: variables,
      missingVariables,
      dependencyOrder,
      steps,
      sampleResult: roundedVal,
      formattedResult: formattedVal,
      result: roundedVal
    });
  } catch (error: any) {
    res.status(400).json({
      valid: false,
      error: error.message || 'Invalid formula expression',
      variables: [],
      referencedVariables: [],
      missingVariables: [],
      dependencyOrder: [],
      steps: []
    });
  }
});

// 1.25 Available Formula Component References
compensationRouter.get('/components/available-references', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const components = await prisma.salaryComponent.findMany({
      where: { companyId: req.user!.companyId, active: true },
      select: { code: true, name: true, type: true, category: true, calculationMode: true },
      orderBy: { displayOrder: 'asc' }
    });

    const systemVariables = [
      { code: 'CTC', name: 'Annual / Monthly CTC Basis', type: 'SYSTEM' },
      { code: 'BASIC', name: 'Base Basic Salary', type: 'SYSTEM' },
      { code: 'GROSS', name: 'Monthly Gross Pay', type: 'SYSTEM' },
      { code: 'PRESENT_DAYS', name: 'Employee Present Working Days', type: 'SYSTEM' },
      { code: 'WORKING_DAYS', name: 'Calendar Month Working Days', type: 'SYSTEM' },
      { code: 'LOP_DAYS', name: 'Loss of Pay Unpaid Days', type: 'SYSTEM' }
    ];

    const mappedComps = components.map(c => ({
      code: c.code,
      name: c.name,
      type: c.type,
      calculationMode: c.calculationMode
    }));

    res.status(200).json({
      systemVariables,
      components: mappedComps,
      companyComponents: mappedComps
    });
  } catch (error) {
    next(error);
  }
});

// 1.3 Create Salary Component
compensationRouter.post('/components', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1).toUpperCase(),
      name: z.string().min(1),
      type: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER_STATUTORY']),
      category: z.string().default('FIXED_EARNING'),
      calculationMode: z.enum(['FIXED_AMOUNT', 'PERCENTAGE_OF_COMPONENT', 'FORMULA_EXPRESSION']).default('FIXED_AMOUNT'),
      formulaExpression: z.string().optional().nullable(),
      baseComponentCode: z.string().optional().nullable(),
      percentageValue: z.number().optional().nullable(),
      fixedAmount: z.number().optional().nullable(),
      minLimit: z.number().optional().nullable(),
      maxLimit: z.number().optional().nullable(),
      roundPolicy: z.enum(['ROUND_HALF_UP', 'ROUND_UP', 'ROUND_DOWN', 'NONE']).default('ROUND_HALF_UP'),
      isTaxable: z.boolean().default(true),
      isPfGross: z.boolean().default(false),
      isEsicGross: z.boolean().default(false),
      isPtGross: z.boolean().default(false),
      affectsGross: z.boolean().default(true),
      affectsNet: z.boolean().default(true),
      affectsCtc: z.boolean().default(true),
      payslipVisibility: z.boolean().default(true),
      displayOrder: z.number().default(0)
    });
    const data = schema.parse(req.body);

    const existing = await prisma.salaryComponent.findUnique({
      where: { companyId_code: { companyId: req.user!.companyId, code: data.code } }
    });
    if (existing) {
      throw new AppError(`Salary component with code ${data.code} already exists`, 400);
    }

    if (data.calculationMode === 'FORMULA_EXPRESSION' && data.formulaExpression) {
      // Validate formula syntax and check circularity
      const allComponents = await prisma.salaryComponent.findMany({
        where: { companyId: req.user!.companyId, active: true },
        select: { code: true, formulaExpression: true }
      });
      const graph = allComponents.map(c => ({ code: c.code, formula: c.formulaExpression || undefined }));
      graph.push({ code: data.code, formula: data.formulaExpression });
      const cycle = FormulaEngine.detectCycle(graph);
      if (cycle) {
        throw new AppError(`Circular component dependency detected: ${cycle.join(' ➔ ')}`, 400);
      }
    }

    const component = await prisma.salaryComponent.create({
      data: {
        companyId: req.user!.companyId,
        code: data.code,
        name: data.name,
        type: data.type,
        category: data.category,
        calculationMode: data.calculationMode,
        formulaExpression: data.formulaExpression,
        baseComponentCode: data.baseComponentCode,
        percentageValue: data.percentageValue !== undefined && data.percentageValue !== null ? new Decimal(data.percentageValue) : null,
        fixedAmount: data.fixedAmount !== undefined && data.fixedAmount !== null ? new Decimal(data.fixedAmount) : null,
        minLimit: data.minLimit !== undefined && data.minLimit !== null ? new Decimal(data.minLimit) : null,
        maxLimit: data.maxLimit !== undefined && data.maxLimit !== null ? new Decimal(data.maxLimit) : null,
        roundPolicy: data.roundPolicy,
        isTaxable: data.isTaxable,
        isPfGross: data.isPfGross,
        isEsicGross: data.isEsicGross,
        isPtGross: data.isPtGross,
        affectsGross: data.affectsGross,
        affectsNet: data.affectsNet,
        affectsCtc: data.affectsCtc,
        payslipVisibility: data.payslipVisibility,
        displayOrder: data.displayOrder
      }
    });

    await recordAudit(req, 'CREATE_SALARY_COMPONENT', 'SalaryComponent', component.id, data);
    res.status(201).json({ component });
  } catch (error) {
    next(error);
  }
});

// 1.4 Update Salary Component
compensationRouter.put('/components/:id', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.salaryComponent.findFirst({
      where: { id: String(id), companyId: req.user!.companyId }
    });
    if (!existing) throw new AppError('Salary component not found', 404);

    const schema = z.object({
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      calculationMode: z.enum(['FIXED_AMOUNT', 'PERCENTAGE_OF_COMPONENT', 'FORMULA_EXPRESSION']).optional(),
      formulaExpression: z.string().optional().nullable(),
      baseComponentCode: z.string().optional().nullable(),
      percentageValue: z.number().optional().nullable(),
      fixedAmount: z.number().optional().nullable(),
      minLimit: z.number().optional().nullable(),
      maxLimit: z.number().optional().nullable(),
      roundPolicy: z.enum(['ROUND_HALF_UP', 'ROUND_UP', 'ROUND_DOWN', 'NONE']).optional(),
      isTaxable: z.boolean().optional(),
      isPfGross: z.boolean().optional(),
      isEsicGross: z.boolean().optional(),
      isPtGross: z.boolean().optional(),
      affectsGross: z.boolean().optional(),
      affectsNet: z.boolean().optional(),
      affectsCtc: z.boolean().optional(),
      payslipVisibility: z.boolean().optional(),
      active: z.boolean().optional(),
      displayOrder: z.number().optional()
    });
    const data = schema.parse(req.body);

    if (data.formulaExpression && data.calculationMode === 'FORMULA_EXPRESSION') {
      const allComponents = await prisma.salaryComponent.findMany({
        where: { companyId: req.user!.companyId, active: true, id: { not: existing.id } },
        select: { code: true, formulaExpression: true }
      });
      const graph = allComponents.map(c => ({ code: c.code, formula: c.formulaExpression || undefined }));
      graph.push({ code: existing.code, formula: data.formulaExpression });
      const cycle = FormulaEngine.detectCycle(graph);
      if (cycle) {
        throw new AppError(`Circular component dependency detected: ${cycle.join(' ➔ ')}`, 400);
      }
    }

    const updated = await prisma.salaryComponent.update({
      where: { id: existing.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.calculationMode ? { calculationMode: data.calculationMode } : {}),
        ...(data.formulaExpression !== undefined ? { formulaExpression: data.formulaExpression } : {}),
        ...(data.baseComponentCode !== undefined ? { baseComponentCode: data.baseComponentCode } : {}),
        ...(data.percentageValue !== undefined ? { percentageValue: data.percentageValue !== null ? new Decimal(data.percentageValue) : null } : {}),
        ...(data.fixedAmount !== undefined ? { fixedAmount: data.fixedAmount !== null ? new Decimal(data.fixedAmount) : null } : {}),
        ...(data.minLimit !== undefined ? { minLimit: data.minLimit !== null ? new Decimal(data.minLimit) : null } : {}),
        ...(data.maxLimit !== undefined ? { maxLimit: data.maxLimit !== null ? new Decimal(data.maxLimit) : null } : {}),
        ...(data.roundPolicy ? { roundPolicy: data.roundPolicy } : {}),
        ...(data.isTaxable !== undefined ? { isTaxable: data.isTaxable } : {}),
        ...(data.isPfGross !== undefined ? { isPfGross: data.isPfGross } : {}),
        ...(data.isEsicGross !== undefined ? { isEsicGross: data.isEsicGross } : {}),
        ...(data.isPtGross !== undefined ? { isPtGross: data.isPtGross } : {}),
        ...(data.affectsGross !== undefined ? { affectsGross: data.affectsGross } : {}),
        ...(data.affectsNet !== undefined ? { affectsNet: data.affectsNet } : {}),
        ...(data.affectsCtc !== undefined ? { affectsCtc: data.affectsCtc } : {}),
        ...(data.payslipVisibility !== undefined ? { payslipVisibility: data.payslipVisibility } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {})
      }
    });

    await recordAudit(req, 'UPDATE_SALARY_COMPONENT', 'SalaryComponent', updated.id, data);
    res.status(200).json({ component: updated });
  } catch (error) {
    next(error);
  }
});

// 1.5 Deactivate/Toggle Component (PATCH & DELETE)
compensationRouter.patch('/components/:id/toggle', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.salaryComponent.findFirst({
      where: { id: String(id), companyId: req.user!.companyId }
    });
    if (!existing) throw new AppError('Salary component not found', 404);

    const updated = await prisma.salaryComponent.update({
      where: { id: existing.id },
      data: { active: !existing.active }
    });

    await recordAudit(req, 'TOGGLE_SALARY_COMPONENT', 'SalaryComponent', updated.id, { active: updated.active });
    res.status(200).json({ component: updated, message: `Component ${updated.code} is now ${updated.active ? 'active' : 'deactivated'}` });
  } catch (error) {
    next(error);
  }
});

compensationRouter.delete('/components/:id', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.salaryComponent.findFirst({
      where: { id: String(id), companyId: req.user!.companyId }
    });
    if (!existing) throw new AppError('Salary component not found', 404);

    const updated = await prisma.salaryComponent.update({
      where: { id: existing.id },
      data: { active: !existing.active }
    });

    await recordAudit(req, 'TOGGLE_SALARY_COMPONENT', 'SalaryComponent', updated.id, { active: updated.active });
    res.status(200).json({ component: updated, message: `Component ${updated.code} is now ${updated.active ? 'active' : 'deactivated'}` });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. SALARY STRUCTURE BUILDER & TEMPLATES
// ==========================================

// 2.1 List All Salary Structure Templates
compensationRouter.get('/structures', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const structures = await prisma.salaryTemplate.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        lines: {
          include: { component: true },
          orderBy: { displayOrder: 'asc' }
        },
        _count: { select: { structures: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ structures });
  } catch (error) {
    next(error);
  }
});

// 2.2 Get Single Structure Details
compensationRouter.get('/structures/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const structure = await prisma.salaryTemplate.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        lines: {
          include: { component: true },
          orderBy: { displayOrder: 'asc' }
        },
        structures: {
          include: {
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true } }
          }
        }
      }
    });
    if (!structure) throw new AppError('Salary structure template not found', 404);
    res.status(200).json({ structure });
  } catch (error) {
    next(error);
  }
});

// 2.3 Create Salary Structure Template
compensationRouter.post('/structures', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1).toUpperCase(),
      name: z.string().min(1),
      description: z.string().optional(),
      isDefault: z.boolean().default(false),
      lines: z.array(z.object({
        componentId: z.string().optional(),
        componentCode: z.string().optional(),
        calculationMode: z.string().default('FIXED_AMOUNT'),
        percentageValue: z.number().optional().nullable(),
        baseComponentCode: z.string().optional().nullable(),
        fixedAmount: z.number().optional().nullable(),
        formulaExpression: z.string().optional().nullable(),
        displayOrder: z.number().default(0)
      })).min(1)
    });
    const { code, name, description, isDefault, lines } = schema.parse(req.body);

    const structure = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.salaryTemplate.updateMany({
          where: { companyId: req.user!.companyId },
          data: { isDefault: false }
        });
      }

      const created = await tx.salaryTemplate.create({
        data: {
          companyId: req.user!.companyId,
          code,
          name,
          description,
          isDefault,
          version: 1
        }
      });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let targetComponentId = line.componentId;
        if (!targetComponentId && line.componentCode) {
          const comp = await tx.salaryComponent.findFirst({
            where: { companyId: req.user!.companyId, code: line.componentCode }
          });
          if (comp) targetComponentId = comp.id;
        }

        if (targetComponentId) {
          await tx.salaryTemplateLine.create({
            data: {
              templateId: created.id,
              componentId: targetComponentId,
              calculationMode: (line.calculationMode === 'PERCENTAGE_OF_BASE'
                ? 'PERCENTAGE_OF_COMPONENT'
                : (['FIXED_AMOUNT', 'PERCENTAGE_OF_COMPONENT', 'FORMULA_EXPRESSION'].includes(line.calculationMode)
                    ? line.calculationMode
                    : 'FIXED_AMOUNT')) as any,
              percentageValue: line.percentageValue !== undefined && line.percentageValue !== null ? new Decimal(line.percentageValue) : null,
              baseComponentCode: line.baseComponentCode,
              fixedAmount: line.fixedAmount !== undefined && line.fixedAmount !== null ? new Decimal(line.fixedAmount) : null,
              formulaExpression: line.formulaExpression,
              displayOrder: line.displayOrder || (i + 1)
            }
          });
        }
      }

      return created;
    });

    await recordAudit(req, 'CREATE_SALARY_STRUCTURE', 'SalaryTemplate', structure.id, { code, name });
    res.status(201).json({ structure });
  } catch (error) {
    next(error);
  }
});

// 2.4 Clone Salary Structure Template (Versioned Revision)
compensationRouter.post('/structures/:id/clone', authenticate, requireRole(['company_admin', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const original = await prisma.salaryTemplate.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: { lines: true }
    });
    if (!original) throw new AppError('Salary structure template not found', 404);

    const newCode = req.body?.newCode || `${original.code || 'STRUCT'}-V${original.version + 1}`;
    const newName = req.body?.newName || `${original.name} (Rev ${original.version + 1})`;

    const cloned = await prisma.$transaction(async (tx) => {
      const created = await tx.salaryTemplate.create({
        data: {
          companyId: req.user!.companyId,
          code: newCode,
          name: newName,
          description: req.body?.description || `Cloned revision of ${original.name}`,
          version: original.version + 1,
          isDefault: false
        }
      });

      for (const line of original.lines) {
        await tx.salaryTemplateLine.create({
          data: {
            templateId: created.id,
            componentId: line.componentId,
            calculationMode: line.calculationMode,
            percentageValue: line.percentageValue,
            baseComponentCode: line.baseComponentCode,
            fixedAmount: line.fixedAmount,
            formulaExpression: line.formulaExpression,
            displayOrder: line.displayOrder
          }
        });
      }

      return created;
    });

    await recordAudit(req, 'CLONE_SALARY_STRUCTURE', 'SalaryTemplate', cloned.id, { originalId: original.id, newCode });
    res.status(201).json({ structure: cloned, cloned });
  } catch (error) {
    next(error);
  }
});

// 2.5 Dynamic Salary Calculation & Breakdown Preview
export function calculateSalaryBreakdown(
  annualCtcNumber: number,
  components: Array<{
    id: string;
    code: string;
    name: string;
    type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY';
    category?: string;
    calculationMode: string;
    percentageValue?: Decimal | number | null;
    baseComponentCode?: string | null;
    fixedAmount?: Decimal | number | null;
    formulaExpression?: string | null;
    displayOrder?: number;
  }>
) {
  const annualCtc = new Decimal(annualCtcNumber);
  const monthlyCtc = annualCtc.dividedBy(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const context: Record<string, Decimal> = {
    CTC: annualCtc,
    ANNUAL_CTC: annualCtc,
    MONTHLY_CTC: monthlyCtc
  };

  const calculatedLines: Array<{
    componentId: string;
    code: string;
    name: string;
    type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY';
    category: string;
    monthly: Decimal;
    annual: Decimal;
    notes: string;
  }> = [];

  // Sort components by displayOrder
  const sorted = [...components].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  // Pass 1: Primary Fixed Earnings & Percentage Bases (e.g. Basic, HRA, Fixed Allowances)
  let totalEarningsMonthly = new Decimal(0);
  let totalDeductionsMonthly = new Decimal(0);
  let totalEmployerCostMonthly = new Decimal(0);

  // Separate balancing components (e.g. Special Allowance) for Pass 2
  const balancingComponents = [];

  for (const comp of sorted) {
    if (comp.code === 'SPECIAL_ALLOWANCE' && !comp.fixedAmount && !comp.formulaExpression && !comp.percentageValue) {
      balancingComponents.push(comp);
      continue;
    }

    let monthly = new Decimal(0);
    let note = '';

    if (comp.calculationMode === 'PERCENTAGE_OF_COMPONENT') {
      const pct = new Decimal(comp.percentageValue ?? 0).dividedBy(100);
      const baseCode = (comp.baseComponentCode || 'CTC').toUpperCase();
      const baseVal = (baseCode === 'CTC' || baseCode === 'MONTHLY_CTC') ? monthlyCtc : (context[baseCode] || monthlyCtc);

      monthly = baseVal.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      note = `${comp.percentageValue}% of ${baseCode}`;
    } else if (comp.calculationMode === 'FORMULA_EXPRESSION' && comp.formulaExpression) {
      monthly = FormulaEngine.evaluate(comp.formulaExpression, context).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      note = `Formula: ${comp.formulaExpression}`;
    } else if (comp.fixedAmount) {
      monthly = new Decimal(comp.fixedAmount);
      note = 'Fixed configured amount';
    } else {
      // Default statutory or standard formula handling
      if (comp.code === 'EPF_EMPLOYEE' || comp.code === 'EPF_EMPLOYER') {
        const basic = context['BASIC'] || monthlyCtc.times(0.40);
        monthly = Decimal.min(1800, basic.times(0.12)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        note = '12% of Basic (capped at ₹1,800 statutory limit)';
      } else if (comp.code === 'PROFESSIONAL_TAX') {
        monthly = new Decimal(200);
        note = 'State PT standard slab';
      } else if (comp.code === 'GRATUITY') {
        const basic = context['BASIC'] || monthlyCtc.times(0.40);
        monthly = basic.times(0.0481).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        note = '4.81% of Basic statutory gratuity provision';
      } else if (comp.code === 'TDS') {
        monthly = new Decimal(0);
        note = 'Estimated TDS deduction';
      }
    }

    context[comp.code] = monthly;

    if (comp.type === 'EARNING') {
      totalEarningsMonthly = totalEarningsMonthly.plus(monthly);
    } else if (comp.type === 'DEDUCTION') {
      totalDeductionsMonthly = totalDeductionsMonthly.plus(monthly);
    } else if (comp.type === 'EMPLOYER_STATUTORY') {
      totalEmployerCostMonthly = totalEmployerCostMonthly.plus(monthly);
    }

    calculatedLines.push({
      componentId: comp.id,
      code: comp.code,
      name: comp.name,
      type: comp.type,
      category: comp.category || (comp.type === 'EARNING' ? 'FIXED_EARNING' : comp.type === 'DEDUCTION' ? 'STATUTORY_DEDUCTION' : 'EMPLOYER_CONTRIBUTION'),
      monthly,
      annual: monthly.times(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      notes: note
    });
  }

  // Pass 2: Balancing components (Special Allowance to reconcile Monthly Gross + Employer Cost = Monthly CTC)
  for (const comp of balancingComponents) {
    // Required Gross = Monthly CTC - Employer Cost
    const targetGross = Decimal.max(0, monthlyCtc.minus(totalEmployerCostMonthly));
    const specialAllowance = Decimal.max(0, targetGross.minus(totalEarningsMonthly)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    context[comp.code] = specialAllowance;
    totalEarningsMonthly = totalEarningsMonthly.plus(specialAllowance);

    calculatedLines.push({
      componentId: comp.id,
      code: comp.code,
      name: comp.name,
      type: comp.type,
      category: 'FIXED_EARNING',
      monthly: specialAllowance,
      annual: specialAllowance.times(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      notes: 'Balancing allowance reconciling Monthly Gross + Employer Contributions = CTC'
    });
  }

  context['GROSS'] = totalEarningsMonthly;
  const netTakeHome = totalEarningsMonthly.minus(totalDeductionsMonthly);
  const totalCostToCompanyMonthly = totalEarningsMonthly.plus(totalEmployerCostMonthly);

  return {
    annualCtc: annualCtc.toNumber(),
    monthlyCtc: monthlyCtc.toNumber(),
    monthlyGross: totalEarningsMonthly.toNumber(),
    annualGross: totalEarningsMonthly.times(12).toNumber(),
    totalDeductionsMonthly: totalDeductionsMonthly.toNumber(),
    annualDeductions: totalDeductionsMonthly.times(12).toNumber(),
    netTakeHomeMonthly: netTakeHome.toNumber(),
    annualTakeHome: netTakeHome.times(12).toNumber(),
    totalEmployerCostMonthly: totalEmployerCostMonthly.toNumber(),
    annualEmployerCost: totalEmployerCostMonthly.times(12).toNumber(),
    totalCostToCompanyReconciled: totalCostToCompanyMonthly.times(12).toNumber(),
    lines: calculatedLines.map(l => ({
      ...l,
      monthly: l.monthly.toNumber(),
      annual: l.annual.toNumber()
    })),
    items: calculatedLines.map(l => ({
      ...l,
      monthly: l.monthly.toNumber(),
      annual: l.annual.toNumber()
    }))
  };
}

// 2.6 Dynamic Salary Preview Endpoint
compensationRouter.post('/structures/preview', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      annualCtc: z.number().min(60000),
      templateId: z.string().optional(),
      customLines: z.array(z.object({
        componentId: z.string(),
        code: z.string(),
        name: z.string(),
        type: z.enum(['EARNING', 'DEDUCTION', 'EMPLOYER_STATUTORY']),
        category: z.string().optional(),
        calculationMode: z.string(),
        percentageValue: z.number().optional().nullable(),
        baseComponentCode: z.string().optional().nullable(),
        fixedAmount: z.number().optional().nullable(),
        formulaExpression: z.string().optional().nullable(),
        displayOrder: z.number().optional()
      })).optional()
    });
    const { annualCtc, templateId, customLines } = schema.parse(req.body);

    let componentsToEvaluate: any[] = [];

    if (customLines && customLines.length > 0) {
      componentsToEvaluate = customLines;
    } else if (templateId) {
      const template = await prisma.salaryTemplate.findFirst({
        where: { id: templateId, companyId: req.user!.companyId },
        include: { lines: { include: { component: true }, orderBy: { displayOrder: 'asc' } } }
      });
      if (!template) throw new AppError('Template not found', 404);

      componentsToEvaluate = template.lines.map(l => ({
        id: l.component.id,
        code: l.component.code,
        name: l.component.name,
        type: l.component.type,
        category: l.component.category,
        calculationMode: l.calculationMode,
        percentageValue: l.percentageValue ? l.percentageValue.toNumber() : undefined,
        baseComponentCode: l.baseComponentCode,
        fixedAmount: l.fixedAmount ? l.fixedAmount.toNumber() : undefined,
        formulaExpression: l.formulaExpression,
        displayOrder: l.displayOrder
      }));
    } else {
      const allCompanyComponents = await prisma.salaryComponent.findMany({
        where: { companyId: req.user!.companyId, active: true },
        orderBy: { displayOrder: 'asc' }
      });
      componentsToEvaluate = allCompanyComponents.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        category: c.category,
        calculationMode: c.calculationMode,
        percentageValue: c.percentageValue ? c.percentageValue.toNumber() : undefined,
        baseComponentCode: c.baseComponentCode,
        fixedAmount: c.fixedAmount ? c.fixedAmount.toNumber() : undefined,
        formulaExpression: c.formulaExpression,
        displayOrder: c.displayOrder
      }));
    }

    // Ensure unique component code evaluation per structure
    const seenComponentCodes = new Set<string>();
    const uniqueComponentsToEvaluate = componentsToEvaluate.filter(c => {
      if (seenComponentCodes.has(c.code)) return false;
      seenComponentCodes.add(c.code);
      return true;
    });

    const breakdown = calculateSalaryBreakdown(annualCtc, uniqueComponentsToEvaluate);
    res.status(200).json({ breakdown, preview: breakdown });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. EMPLOYEE CTC ASSIGNMENT & REVISIONS
// ==========================================

// 3.1 Assign or Revise Employee Salary Structure (with Effective Dating & Audit History)
compensationRouter.post('/assign', authenticate, requireRole(['company_admin', 'payroll_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      templateId: z.string().optional(),
      annualCtc: z.number().min(60000),
      effectiveFrom: z.string().refine(val => val.trim().length > 0 && !isNaN(Date.parse(val)), { message: 'Valid effectiveFrom date is required' }),
      revisionReason: z.string().optional(),
      customLines: z.array(z.object({
        componentId: z.string(),
        monthlyAmount: z.number(),
        annualAmount: z.number().optional()
      })).optional()
    });
    const { employeeId, templateId, annualCtc, effectiveFrom, revisionReason, customLines } = schema.parse(req.body);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: req.user!.companyId },
      include: { branch: true, salaryStructure: { include: { lines: true } } }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    // Fetch components
    let componentsToEvaluate: any[] = [];
    if (templateId) {
      const t = await prisma.salaryTemplate.findFirst({
        where: { id: templateId, companyId: req.user!.companyId },
        include: { lines: { include: { component: true } } }
      });
      if (t) {
        componentsToEvaluate = t.lines.map(l => ({
          id: l.component.id,
          code: l.component.code,
          name: l.component.name,
          type: l.component.type,
          category: l.component.category,
          calculationMode: l.calculationMode,
          percentageValue: l.percentageValue ? l.percentageValue.toNumber() : undefined,
          baseComponentCode: l.baseComponentCode,
          fixedAmount: l.fixedAmount ? l.fixedAmount.toNumber() : undefined,
          formulaExpression: l.formulaExpression,
          displayOrder: l.displayOrder
        }));
      }
    }

    if (componentsToEvaluate.length === 0) {
      const allComps = await prisma.salaryComponent.findMany({
        where: { companyId: req.user!.companyId, active: true },
        orderBy: { displayOrder: 'asc' }
      });
      componentsToEvaluate = allComps.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        category: c.category,
        calculationMode: c.calculationMode,
        percentageValue: c.percentageValue ? c.percentageValue.toNumber() : undefined,
        baseComponentCode: c.baseComponentCode,
        fixedAmount: c.fixedAmount ? c.fixedAmount.toNumber() : undefined,
        formulaExpression: c.formulaExpression,
        displayOrder: c.displayOrder
      }));
    }

    const calculated = calculateSalaryBreakdown(annualCtc, componentsToEvaluate);

    const structure = await prisma.$transaction(async (tx) => {
      // 1. Snapshot previous structure into EmployeeSalaryRevision if existed
      if (employee.salaryStructure) {
        await tx.employeeSalaryRevision.create({
          data: {
            employeeId: employee.id,
            annualCtc: employee.salaryStructure.annualCtc,
            monthlyGross: employee.salaryStructure.monthlyGross,
            effectiveFrom: employee.salaryStructure.effectiveFrom,
            effectiveTo: new Date(effectiveFrom),
            revisionReason: revisionReason || 'Superseded by salary revision',
            approvedBy: req.user!.fullName,
            snapshot: {
              previousStructureId: employee.salaryStructure.id,
              lines: employee.salaryStructure.lines.map(l => ({
                componentId: l.componentId,
                monthlyAmount: Number(l.monthlyAmount),
                annualAmount: Number(l.annualAmount)
              }))
            }
          }
        });

        // Delete previous lines
        await tx.employeeSalaryLine.deleteMany({
          where: { structureId: employee.salaryStructure.id }
        });

        // Update active structure record
        const updated = await tx.employeeSalaryStructure.update({
          where: { id: employee.salaryStructure.id },
          data: {
            templateId: templateId || null,
            annualCtc: new Decimal(annualCtc),
            monthlyGross: new Decimal(calculated.monthlyGross),
            effectiveFrom: new Date(effectiveFrom),
            version: (employee.salaryStructure.version || 1) + 1,
            revisionReason,
            active: true
          }
        });

        // Create new lines
        for (const line of calculated.lines) {
          await tx.employeeSalaryLine.create({
            data: {
              structureId: updated.id,
              componentId: line.componentId,
              monthlyAmount: new Decimal(line.monthly),
              annualAmount: new Decimal(line.annual)
            }
          });
        }

        return updated;
      } else {
        // Create initial salary structure
        const created = await tx.employeeSalaryStructure.create({
          data: {
            employeeId: employee.id,
            templateId: templateId || null,
            annualCtc: new Decimal(annualCtc),
            monthlyGross: new Decimal(calculated.monthlyGross),
            effectiveFrom: new Date(effectiveFrom),
            version: 1,
            revisionReason,
            active: true
          }
        });

        for (const line of calculated.lines) {
          await tx.employeeSalaryLine.create({
            data: {
              structureId: created.id,
              componentId: line.componentId,
              monthlyAmount: new Decimal(line.monthly),
              annualAmount: new Decimal(line.annual)
            }
          });
        }

        return created;
      }
    });

    // Record employment timeline event
    await prisma.employmentTimeline.create({
      data: {
        employeeId: employee.id,
        eventType: 'SALARY_REVISION',
        title: `Compensation Revision: ₹${(annualCtc / 100000).toFixed(2)} LPA`,
        description: `Effective ${effectiveFrom}. Monthly Gross ₹${calculated.monthlyGross.toLocaleString('en-IN')}, Net Take-Home ₹${calculated.netTakeHomeMonthly.toLocaleString('en-IN')}`,
        effectiveDate: new Date(effectiveFrom),
        recordedBy: req.user!.fullName
      }
    });

    await recordAudit(req, 'ASSIGN_SALARY_STRUCTURE', 'EmployeeSalaryStructure', structure.id, {
      employeeCode: employee.employeeCode,
      annualCtc,
      monthlyGross: calculated.monthlyGross
    });

    res.status(201).json({
      message: 'Salary structure assigned successfully',
      structure,
      revision: structure,
      breakdown: calculated
    });
  } catch (error) {
    next(error);
  }
});

// 3.2 Get Employee's Complete Compensation History
compensationRouter.get('/employee/:employeeId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const employee = await prisma.employee.findFirst({
      where: { id: String(employeeId), companyId: req.user!.companyId },
      include: {
        salaryStructure: {
          include: {
            template: true,
            lines: {
              include: { component: true },
              orderBy: { component: { displayOrder: 'asc' } }
            }
          }
        },
        salaryRevisions: {
          orderBy: { effectiveFrom: 'desc' }
        },
        payrollPolicy: true
      }
    });

    if (!employee) throw new AppError('Employee not found', 404);

    res.status(200).json({
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        workEmail: employee.workEmail
      },
      currentStructure: employee.salaryStructure,
      revisions: employee.salaryRevisions,
      payrollPolicy: employee.payrollPolicy
    });
  } catch (error) {
    next(error);
  }
});

// 3.3 Financial Impact Comparison (Old Structure vs New Structure)
compensationRouter.post('/compare', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1),
      newAnnualCtc: z.number().min(60000),
      newTemplateId: z.string().optional()
    });
    const { employeeId, newAnnualCtc, newTemplateId } = schema.parse(req.body);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: req.user!.companyId },
      include: {
        salaryStructure: {
          include: { lines: { include: { component: true } } }
        }
      }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const currentCtc = employee.salaryStructure ? Number(employee.salaryStructure.annualCtc) : 0;
    const currentGross = employee.salaryStructure ? Number(employee.salaryStructure.monthlyGross) : 0;

    // Calculate new
    const comps = await prisma.salaryComponent.findMany({
      where: { companyId: req.user!.companyId, active: true },
      orderBy: { displayOrder: 'asc' }
    });
    const componentsToEvaluate = comps.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      category: c.category,
      calculationMode: c.calculationMode,
      percentageValue: c.percentageValue ? c.percentageValue.toNumber() : undefined,
      baseComponentCode: c.baseComponentCode,
      fixedAmount: c.fixedAmount ? c.fixedAmount.toNumber() : undefined,
      formulaExpression: c.formulaExpression,
      displayOrder: c.displayOrder
    }));

    const newBreakdown = calculateSalaryBreakdown(newAnnualCtc, componentsToEvaluate);

    const annualCtcDelta = newAnnualCtc - currentCtc;
    const annualCtcPctChange = currentCtc > 0 ? ((annualCtcDelta / currentCtc) * 100).toFixed(2) : '100.00';
    const monthlyGrossDelta = newBreakdown.monthlyGross - currentGross;

    res.status(200).json({
      comparison: {
        current: {
          annualCtc: currentCtc,
          monthlyGross: currentGross
        },
        proposed: {
          annualCtc: newAnnualCtc,
          monthlyGross: newBreakdown.monthlyGross,
          monthlyNet: newBreakdown.netTakeHomeMonthly,
          monthlyEmployerCost: newBreakdown.totalEmployerCostMonthly
        },
        delta: {
          annualCtcDelta,
          annualCtcPctChange: `${annualCtcPctChange}%`,
          monthlyGrossDelta
        },
        newBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
});

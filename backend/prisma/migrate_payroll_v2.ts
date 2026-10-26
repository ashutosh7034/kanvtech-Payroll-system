import { PrismaClient, ComponentType, CalculationMode, PaymentMethod } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Running Payroll Engine V2 schema migration and policy sync...');
  const companies = await prisma.company.findMany();

  for (const company of companies) {
    console.log(`Processing company ${company.name} (${company.code})...`);

    // 1. Update/Add Salary Components
    const componentsConfig = [
      { code: 'BASIC', name: 'Basic Salary', type: ComponentType.EARNING, category: 'FIXED_EARNING', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'CTC', percentageValue: 40.0, isTaxable: true, isPfGross: true, isEsicGross: true, isPtGross: true, displayOrder: 1 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: ComponentType.EARNING, category: 'FIXED_EARNING', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'BASIC', percentageValue: 50.0, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 2 },
      { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', type: ComponentType.EARNING, category: 'FIXED_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 3 },
      { code: 'CONVEYANCE', name: 'Conveyance Allowance', type: ComponentType.EARNING, category: 'FIXED_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, fixedAmount: 5000, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 4 },
      { code: 'MEDICAL', name: 'Medical Allowance', type: ComponentType.EARNING, category: 'FIXED_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, fixedAmount: 5000, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 5 },
      { code: 'VARIABLE_PAY', name: 'Performance Bonus', type: ComponentType.EARNING, category: 'VARIABLE_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 6 },
      { code: 'OVERTIME', name: 'Overtime Allowance', type: ComponentType.EARNING, category: 'VARIABLE_EARNING', calculationMode: CalculationMode.PER_HOUR_RATE, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 7 },
      { code: 'COMMISSION', name: 'Sales Commission', type: ComponentType.EARNING, category: 'VARIABLE_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 8 },
      { code: 'ARREARS', name: 'Salary Arrears', type: ComponentType.EARNING, category: 'VARIABLE_EARNING', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: true, isPfGross: true, isEsicGross: true, isPtGross: true, displayOrder: 9 },
      { code: 'EPF_EMPLOYEE', name: 'Employee Provident Fund (12%)', type: ComponentType.DEDUCTION, category: 'STATUTORY_DEDUCTION', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'BASIC', percentageValue: 12.0, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 10 },
      { code: 'ESIC_EMPLOYEE', name: 'Employee ESIC (0.75%)', type: ComponentType.DEDUCTION, category: 'STATUTORY_DEDUCTION', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'GROSS', percentageValue: 0.75, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 11 },
      { code: 'PROFESSIONAL_TAX', name: 'Professional Tax', type: ComponentType.DEDUCTION, category: 'STATUTORY_DEDUCTION', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 12 },
      { code: 'TDS', name: 'Income Tax (TDS)', type: ComponentType.DEDUCTION, category: 'STATUTORY_DEDUCTION', calculationMode: CalculationMode.FIXED_AMOUNT, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 13 },
      { code: 'EPF_EMPLOYER', name: 'Employer PF Contribution (12%)', type: ComponentType.EMPLOYER_STATUTORY, category: 'EMPLOYER_CONTRIBUTION', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'BASIC', percentageValue: 12.0, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 20 },
      { code: 'ESIC_EMPLOYER', name: 'Employer ESIC (3.25%)', type: ComponentType.EMPLOYER_STATUTORY, category: 'EMPLOYER_CONTRIBUTION', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'GROSS', percentageValue: 3.25, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 21 },
      { code: 'GRATUITY', name: 'Gratuity Provision (4.81%)', type: ComponentType.EMPLOYER_STATUTORY, category: 'EMPLOYER_CONTRIBUTION', calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, baseComponentCode: 'BASIC', percentageValue: 4.81, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 22 }
    ];

    for (const comp of componentsConfig) {
      await prisma.salaryComponent.upsert({
        where: { companyId_code: { companyId: company.id, code: comp.code } },
        update: {
          category: comp.category,
          calculationMode: comp.calculationMode,
          baseComponentCode: comp.baseComponentCode,
          percentageValue: comp.percentageValue ? new Decimal(comp.percentageValue) : null,
          fixedAmount: comp.fixedAmount ? new Decimal(comp.fixedAmount) : null,
          displayOrder: comp.displayOrder,
          isTaxable: comp.isTaxable,
          isPfGross: comp.isPfGross,
          isEsicGross: comp.isEsicGross,
          isPtGross: comp.isPtGross
        },
        create: {
          companyId: company.id,
          code: comp.code,
          name: comp.name,
          type: comp.type,
          category: comp.category,
          calculationMode: comp.calculationMode,
          baseComponentCode: comp.baseComponentCode,
          percentageValue: comp.percentageValue ? new Decimal(comp.percentageValue) : null,
          fixedAmount: comp.fixedAmount ? new Decimal(comp.fixedAmount) : null,
          displayOrder: comp.displayOrder,
          isTaxable: comp.isTaxable,
          isPfGross: comp.isPfGross,
          isEsicGross: comp.isEsicGross,
          isPtGross: comp.isPtGross
        }
      });
    }

    // 2. Ensure Sample Salary Templates
    const comps = await prisma.salaryComponent.findMany({ where: { companyId: company.id } });
    const compMap = new Map(comps.map(c => [c.code, c.id]));

    let stdTemplate = await prisma.salaryTemplate.findFirst({
      where: { companyId: company.id, code: 'TECH-STD-L2' }
    });

    if (!stdTemplate) {
      stdTemplate = await prisma.salaryTemplate.create({
        data: {
          companyId: company.id,
          code: 'TECH-STD-L2',
          name: 'Engineering Professional Standard Band',
          description: 'Standard salary structure for Tech Center software engineers with PF and statutory allowances',
          version: 1,
          isDefault: true,
          lines: {
            create: [
              { componentId: compMap.get('BASIC')!, calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, percentageValue: new Decimal(40.0), displayOrder: 1 },
              { componentId: compMap.get('HRA')!, calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, percentageValue: new Decimal(50.0), baseComponentCode: 'BASIC', displayOrder: 2 },
              { componentId: compMap.get('CONVEYANCE')!, calculationMode: CalculationMode.FIXED_AMOUNT, fixedAmount: new Decimal(5000), displayOrder: 3 },
              { componentId: compMap.get('MEDICAL')!, calculationMode: CalculationMode.FIXED_AMOUNT, fixedAmount: new Decimal(5000), displayOrder: 4 },
              { componentId: compMap.get('SPECIAL_ALLOWANCE')!, calculationMode: CalculationMode.FIXED_AMOUNT, displayOrder: 5 },
              { componentId: compMap.get('EPF_EMPLOYEE')!, calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, percentageValue: new Decimal(12.0), baseComponentCode: 'BASIC', displayOrder: 10 },
              { componentId: compMap.get('PROFESSIONAL_TAX')!, calculationMode: CalculationMode.FIXED_AMOUNT, displayOrder: 11 },
              { componentId: compMap.get('TDS')!, calculationMode: CalculationMode.FIXED_AMOUNT, displayOrder: 12 },
              { componentId: compMap.get('EPF_EMPLOYER')!, calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, percentageValue: new Decimal(12.0), baseComponentCode: 'BASIC', displayOrder: 20 },
              { componentId: compMap.get('GRATUITY')!, calculationMode: CalculationMode.PERCENTAGE_OF_COMPONENT, percentageValue: new Decimal(4.81), baseComponentCode: 'BASIC', displayOrder: 21 }
            ]
          }
        }
      });
    }

    // 3. Ensure Employee Payroll Policies for all Employees
    const employees = await prisma.employee.findMany({
      where: { companyId: company.id },
      include: { branch: true, payrollPolicy: true, salaryStructure: true }
    });

    for (const emp of employees) {
      if (!emp.payrollPolicy) {
        const ptState = emp.branch?.state || 'Maharashtra';
        const isAnanya = emp.employeeCode === 'APEX-1002';

        await prisma.employeePayrollPolicy.create({
          data: {
            employeeId: emp.id,
            pfApplicable: true,
            pfStatus: 'APPLICABLE',
            pfWageBasis: isAnanya ? 'ACTUAL_BASIC' : 'CEILING_15000',
            pfNumber: emp.pfNumber,
            uanNumber: emp.uanNumber,
            esiApplicable: false,
            esiStatus: 'EXEMPT_OVER_CEILING',
            ptApplicable: true,
            ptState,
            taxRegime: isAnanya ? 'OLD' : 'NEW',
            paymentMode: PaymentMethod.NEFT,
            payrollFrequency: 'MONTHLY',
            effectiveFrom: emp.dateOfJoining || new Date('2024-04-01')
          }
        });
        console.log(`Created EmployeePayrollPolicy for ${emp.employeeCode} (${emp.firstName} ${emp.lastName})`);
      }
    }
  }

  console.log('✅ Payroll Engine V2 migration completed successfully.');
}

migrate()
  .catch((e) => {
    console.error('❌ Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

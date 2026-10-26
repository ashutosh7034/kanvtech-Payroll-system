const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Legitimate Salary Structure Templates ---');
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Company not found');

  const comps = await prisma.salaryComponent.findMany({ where: { companyId: company.id } });
  const compMap = new Map(comps.map(c => [c.code, c.id]));

  // Template 1: Engineering Executive CTC Structure
  const tmpl1 = await prisma.salaryTemplate.upsert({
    where: { companyId_code: { companyId: company.id, code: 'EXEC-TECH-01' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'EXEC-TECH-01',
      name: 'Engineering Executive CTC Package',
      description: 'Standard technical lead & engineering band compensation with 40% Basic, 20% HRA, Special Allowance & PF',
      isDefault: true,
      version: 1
    }
  });

  // Lines for Template 1
  const lines1 = [
    { code: 'BASIC', mode: 'PERCENTAGE_OF_COMPONENT', pct: 40, base: 'CTC', order: 1 },
    { code: 'HRA', mode: 'PERCENTAGE_OF_COMPONENT', pct: 50, base: 'BASIC', order: 2 },
    { code: 'CONVEYANCE', mode: 'FIXED_AMOUNT', fixed: 5000, order: 3 },
    { code: 'MEDICAL', mode: 'FIXED_AMOUNT', fixed: 6000, order: 4 },
    { code: 'SPECIAL_ALLOWANCE', mode: 'FORMULA_EXPRESSION', formula: 'GROSS - (BASIC + HRA + CONVEYANCE + MEDICAL)', order: 5 },
    { code: 'EPF_EMPLOYEE', mode: 'PERCENTAGE_OF_COMPONENT', pct: 12, base: 'BASIC', order: 6 },
    { code: 'PROFESSIONAL_TAX', mode: 'FIXED_AMOUNT', fixed: 200, order: 7 },
    { code: 'EPF_EMPLOYER', mode: 'PERCENTAGE_OF_COMPONENT', pct: 12, base: 'BASIC', order: 8 },
    { code: 'GRATUITY', mode: 'PERCENTAGE_OF_COMPONENT', pct: 4.81, base: 'BASIC', order: 9 }
  ];

  for (const l of lines1) {
    const compId = compMap.get(l.code);
    if (compId) {
      const existing = await prisma.salaryTemplateLine.findFirst({
        where: { templateId: tmpl1.id, componentId: compId }
      });
      if (!existing) {
        await prisma.salaryTemplateLine.create({
          data: {
            templateId: tmpl1.id,
            componentId: compId,
            calculationMode: l.mode,
            percentageValue: l.pct || null,
            baseComponentCode: l.base || null,
            fixedAmount: l.fixed || null,
            formulaExpression: l.formula || null,
            displayOrder: l.order
          }
        });
      }
    }
  }

  // Template 2: Corporate Professional Standard CTC
  const tmpl2 = await prisma.salaryTemplate.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CORP-STANDARD' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'CORP-STANDARD',
      name: 'Corporate Professional Standard CTC',
      description: 'Standard band compensation package for Product, Design, Operations, and HR professionals',
      isDefault: false,
      version: 1
    }
  });

  const lines2 = [
    { code: 'BASIC', mode: 'PERCENTAGE_OF_COMPONENT', pct: 50, base: 'CTC', order: 1 },
    { code: 'HRA', mode: 'PERCENTAGE_OF_COMPONENT', pct: 40, base: 'BASIC', order: 2 },
    { code: 'CONVEYANCE', mode: 'FIXED_AMOUNT', fixed: 3000, order: 3 },
    { code: 'SPECIAL_ALLOWANCE', mode: 'FORMULA_EXPRESSION', formula: 'GROSS - (BASIC + HRA + CONVEYANCE)', order: 4 },
    { code: 'EPF_EMPLOYEE', mode: 'PERCENTAGE_OF_COMPONENT', pct: 12, base: 'BASIC', order: 5 },
    { code: 'PROFESSIONAL_TAX', mode: 'FIXED_AMOUNT', fixed: 200, order: 6 },
    { code: 'EPF_EMPLOYER', mode: 'PERCENTAGE_OF_COMPONENT', pct: 12, base: 'BASIC', order: 7 }
  ];

  for (const l of lines2) {
    const compId = compMap.get(l.code);
    if (compId) {
      const existing = await prisma.salaryTemplateLine.findFirst({
        where: { templateId: tmpl2.id, componentId: compId }
      });
      if (!existing) {
        await prisma.salaryTemplateLine.create({
          data: {
            templateId: tmpl2.id,
            componentId: compId,
            calculationMode: l.mode,
            percentageValue: l.pct || null,
            baseComponentCode: l.base || null,
            fixedAmount: l.fixed || null,
            formulaExpression: l.formula || null,
            displayOrder: l.order
          }
        });
      }
    }
  }

  console.log('✓ Successfully seeded 2 standard corporate templates with line items');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

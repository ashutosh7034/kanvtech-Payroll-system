const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public' }
  }
});

async function main() {
  const users = await prisma.user.count();
  const emps = await prisma.employee.count();
  const periods = await prisma.payrollPeriod.findMany();
  const components = await prisma.salaryComponent.count();
  const templates = await prisma.salaryTemplate.count();
  const runs = await prisma.corporatePayrollRun.count();

  console.log({
    users,
    emps,
    periods: periods.map(p => `${p.name} (${p.month}/${p.year})`),
    components,
    templates,
    runs
  });
}

main().finally(() => prisma.$disconnect());

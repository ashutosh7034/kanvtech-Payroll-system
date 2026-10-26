const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Demo Prerequisites ===');
  const company = await prisma.company.findFirst();
  const branches = await prisma.branch.findMany({ select: { id: true, code: true, name: true } });
  const departments = await prisma.department.findMany({ select: { id: true, code: true, name: true } });
  const designations = await prisma.designation.findMany({ select: { id: true, code: true, name: true } });
  const employees = await prisma.employee.findMany();
  const payrollRuns = await prisma.corporatePayrollRun.findMany();
  const periods = await prisma.payrollPeriod.findMany();

  console.log('Company:', company ? company.name : 'None');
  console.log('Branches:', branches);
  console.log('Departments:', departments);
  console.log('Designations:', designations);
  console.log('Employees:', employees.length);
  console.log('Payroll Runs:', payrollRuns.length);
  console.log('Payroll Periods:', periods.length);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

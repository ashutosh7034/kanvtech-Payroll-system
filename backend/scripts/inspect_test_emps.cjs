const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public' }
  }
});

async function main() {
  const emps = await prisma.employee.findMany();
  console.log('Employees in test db:', emps.map(e => `${e.employeeCode}: ${e.firstName} ${e.lastName}`));
}

main().finally(() => prisma.$disconnect());

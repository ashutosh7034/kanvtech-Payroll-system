const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emps = await prisma.employee.findMany({
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total employees in payroll_management: ${emps.length}`);
  emps.forEach((e, idx) => {
    console.log(`${idx + 1}. [${e.employeeCode}] ${e.firstName} ${e.lastName} | Status: ${e.status} | Created: ${e.createdAt.toISOString()}`);
  });
}

main().finally(() => prisma.$disconnect());

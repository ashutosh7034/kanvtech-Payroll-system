const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public' }
  }
});

async function main() {
  const employeeCount = await prisma.employee.count();
  const runCount = await prisma.corporatePayrollRun.count();
  const slipCount = await prisma.corporatePayrollSlip.count();
  const finalizedRuns = await prisma.corporatePayrollRun.findMany({
    where: { status: 'PAID' },
    select: {
      id: true,
      runNumber: true,
      status: true,
      totalGross: true,
      totalNetPay: true,
      totalEmployees: true
    }
  });

  const totals = finalizedRuns.reduce((acc, r) => ({
    gross: acc.gross + Number(r.totalGross),
    net: acc.net + Number(r.totalNetPay)
  }), { gross: 0, net: 0 });

  console.log(JSON.stringify({
    database: 'payroll_management',
    employeeCount,
    runCount,
    slipCount,
    finalizedRunsCount: finalizedRuns.length,
    finalizedFinancialTotals: totals
  }, null, 2));
}

main().finally(() => prisma.$disconnect());

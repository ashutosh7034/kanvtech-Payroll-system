const { PrismaClient } = require('@prisma/client');

async function inspect(name, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const empCount = await p.employee.count();
    const candidateCount = await p.candidate.count();
    const companyCount = await p.company.count();
    const runCount = await p.corporatePayrollRun.count();
    const slipCount = await p.corporatePayrollSlip.count();
    const finalizedRuns = await p.corporatePayrollRun.findMany({
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

    const employeesByStatus = await p.employee.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    console.log(JSON.stringify({
      database: name,
      employees: empCount,
      employeesByStatus,
      candidates: candidateCount,
      companies: companyCount,
      runs: runCount,
      slips: slipCount,
      finalizedRunsCount: finalizedRuns.length,
      finalizedRuns,
      finalizedFinancialTotals: totals
    }, null, 2));
  } catch (err) {
    console.error('Error on ' + name + ':', err.message);
  } finally {
    await p.$disconnect();
  }
}

async function run() {
  await inspect('payroll_management (prod)', 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public');
  await inspect('payroll_management_test (test)', 'postgresql://postgres:root@localhost:5432/payroll_management_test?schema=public');
}
run();

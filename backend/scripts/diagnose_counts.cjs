const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true, companyId: true, createdAt: true },
    orderBy: { employeeCode: 'asc' }
  });
  console.log('=== EMPLOYEES IN DATABASE ===');
  console.log('Total employees in DB:', employees.length);
  const byStatus = {};
  employees.forEach(e => { byStatus[e.status] = (byStatus[e.status] || 0) + 1; });
  console.log('Employees by status:', byStatus);

  const runs = await prisma.corporatePayrollRun.findMany({
    include: {
      period: true,
      slips: {
        select: {
          id: true,
          employeeId: true,
          employee: { select: { employeeCode: true, status: true, firstName: true, lastName: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\n=== CORPORATE PAYROLL RUNS ===');
  console.log('Total runs:', runs.length);
  runs.forEach(r => {
    console.log(`Run ${r.runNumber} [${r.status}] | Period: ${r.period.name} | Slips: ${r.slips.length} | totalEmployees field: ${r.totalEmployees} | Created: ${r.createdAt.toISOString()}`);
  });

  if (runs.length > 0) {
    const latestPaid = runs.find(r => r.status === 'PAID');
    if (latestPaid) {
      console.log(`\n=== SLIPS IN LATEST PAID RUN (${latestPaid.runNumber}) ===`);
      console.log('Slips count:', latestPaid.slips.length);
      const codes = latestPaid.slips.map(s => s.employee.employeeCode);
      console.log('Codes:', codes.join(', '));

      // Compare with all employees
      const allCodes = employees.map(e => e.employeeCode);
      const notInRun = employees.filter(e => !codes.includes(e.employeeCode));
      console.log('\nEmployees in DB NOT in latest paid run:', notInRun.map(e => `${e.employeeCode} (${e.status})`));
    }
  }

  // Count seeded vs test created
  const poojas = await prisma.employee.findMany({
    where: { firstName: 'Pooja', lastName: 'Kamat' },
    select: { id: true, employeeCode: true, createdAt: true, status: true }
  });
  console.log('\n=== POOJA KAMAT TEST-CREATED EMPLOYEES ===');
  console.log(`Total Pooja Kamat records: ${poojas.length}`);
  poojas.forEach(p => console.log(`${p.employeeCode} | Created: ${p.createdAt.toISOString()} | Status: ${p.status}`));

  const seeded = employees.filter(e => !(e.firstName === 'Pooja' && e.lastName === 'Kamat' && e.employeeCode.startsWith('APEX-') && e.employeeCode.length > 8));
  console.log(`\nBase / Seeded employee count (excluding dynamic test creations): ${employees.length - (poojas.length - 1)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('=== DATABASE RECONCILIATION & AUDIT INSPECTION ===');
  
  // 1. Employee records
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      status: true,
      dateOfJoining: true,
      salaryStructure: { select: { id: true, annualCtc: true, monthlyGross: true, active: true } },
      payrollPolicy: { select: { id: true, pfApplicable: true, esiApplicable: true, taxRegime: true } }
    },
    orderBy: { employeeCode: 'asc' }
  });
  console.log(`\n1. EMPLOYEES: Total = ${employees.length}`);
  const codeMap = new Map();
  const dupCodes = [];
  employees.forEach(e => {
    if (codeMap.has(e.employeeCode)) dupCodes.push(e.employeeCode);
    codeMap.set(e.employeeCode, (codeMap.get(e.employeeCode) || 0) + 1);
  });
  console.log(`Duplicate Employee Codes: ${dupCodes.length > 0 ? dupCodes.join(', ') : 'NONE (All unique)'}`);

  // Check for duplicate names
  const nameMap = new Map();
  employees.forEach(e => {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    nameMap.set(fullName, (nameMap.get(fullName) || 0) + 1);
  });
  const duplicateNames = Array.from(nameMap.entries()).filter(([k, v]) => v > 1);
  console.log(`Duplicate Full Names: ${duplicateNames.length > 0 ? JSON.stringify(duplicateNames) : 'NONE (All unique)'}`);
  if (duplicateNames.length > 0) {
    const dups = employees.filter(e => `${e.firstName} ${e.lastName}`.trim() === 'Pooja Kamat');
    console.log('Details of Pooja Kamat employees:');
    dups.forEach(d => console.log(`  Code: ${d.employeeCode} | Email: ${d.workEmail} | Status: ${d.status} | DOJ: ${d.dateOfJoining?.toISOString()?.split('T')[0]} | CTC: ${d.salaryStructure?.annualCtc}`));
  }

  // 2. Corporate Payroll Runs
  const runs = await prisma.corporatePayrollRun.findMany({
    include: {
      period: true,
      slips: {
        select: {
          id: true,
          employeeId: true,
          grossPay: true,
          deductionsPay: true,
          netPay: true,
          employerCost: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\n2. CORPORATE PAYROLL RUNS: Total = ${runs.length}`);
  for (const r of runs) {
    console.log(`- Run ${r.runNumber} | Period: ${r.period?.name} | Status: ${r.status} | Total Employees: ${r.totalEmployees} | Slips: ${r.slips.length}`);
    console.log(`  Reported Gross: ${r.totalGross} | Deductions: ${r.totalDeductions} | Net: ${r.totalNetPay} | Employer: ${r.totalEmployerCost}`);
    
    // Slips aggregation verification
    let sumGross = 0, sumDeductions = 0, sumNet = 0, sumEmployer = 0;
    let zeroGrossSlips = 0, zeroNetSlips = 0;
    const slipEmpIds = new Set();
    const dupSlipEmployees = [];

    for (const s of r.slips) {
      if (slipEmpIds.has(s.employeeId)) dupSlipEmployees.push(s.employeeId);
      slipEmpIds.add(s.employeeId);

      const g = Number(s.grossPay);
      const d = Number(s.deductionsPay);
      const n = Number(s.netPay);
      const e = Number(s.employerCost);

      if (g === 0) zeroGrossSlips++;
      if (n === 0) zeroNetSlips++;

      sumGross += g;
      sumDeductions += d;
      sumNet += n;
      sumEmployer += e;
    }

    console.log(`  Aggregated Slips: Gross = ${sumGross.toFixed(2)} | Deductions = ${sumDeductions.toFixed(2)} | Net = ${sumNet.toFixed(2)} | Employer = ${sumEmployer.toFixed(2)}`);
    console.log(`  Zero Gross Slips: ${zeroGrossSlips} | Zero Net Slips: ${zeroNetSlips}`);
    console.log(`  Duplicate Employee Slips in batch: ${dupSlipEmployees.length > 0 ? dupSlipEmployees.join(', ') : 'NONE'}`);
    
    const diffNet = Math.abs(Number(r.totalNetPay) - sumNet);
    console.log(`  Batch vs Slip Sum Discrepancy (Net Pay): ${diffNet < 0.01 ? 'MATCHES EXACTLY (0.00)' : `MISMATCH: ${diffNet}`}`);
  }

  // 3. Loans & Repayments
  const loans = await prisma.employeeLoan.findMany({
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      loanType: true,
      repayments: true
    }
  });
  console.log(`\n3. EMPLOYEE LOANS: Total = ${loans.length}`);
  for (const l of loans) {
    const totalRepayments = l.repayments.reduce((acc, r) => acc + Number(r.amountPaid), 0);
    console.log(`- Loan ID: ${l.id} | Employee: ${l.employee?.employeeCode} (${l.employee?.firstName} ${l.employee?.lastName})`);
    console.log(`  Type: ${l.loanType?.name} | Principal: ${l.principalAmount} | Monthly EMI: ${l.monthlyEmi}`);
    console.log(`  Recovered: ${l.recoveredAmount} | Outstanding: ${l.outstandingAmount} | Status: ${l.status}`);
    console.log(`  Repayment Records Count: ${l.repayments.length} | Repayments Sum: ${totalRepayments.toFixed(2)}`);
    const balanceReconciliation = Number(l.principalAmount) - (Number(l.recoveredAmount) + Number(l.outstandingAmount));
    console.log(`  Principal Reconciliation Diff: ${Math.abs(balanceReconciliation) < 0.01 ? '0.00 (EXACT)' : balanceReconciliation}`);
  }

  // 4. Custom Field Definitions & Values
  const customDefs = await prisma.customFieldDefinition.findMany();
  const customVals = await prisma.employeeCustomFieldValue.findMany();
  console.log(`\n4. CUSTOM FIELDS: Definitions = ${customDefs.length} | Saved Values = ${customVals.length}`);
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

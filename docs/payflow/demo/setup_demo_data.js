const path = require('path');
require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../../../backend/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('--- Setting up Clean Controlled Demo Data ---');
  
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Company not found');

  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const bHq = branches.find(b => b.code.includes('MUM')) || branches[0];
  const bBlr = branches.find(b => b.code.includes('BLR')) || branches[1] || branches[0];

  const depts = await prisma.department.findMany({ where: { companyId: company.id } });
  const dEng = depts.find(d => d.code === 'ENG') || depts[0];
  const dPrd = depts.find(d => d.code === 'PRD') || depts[1] || depts[0];
  const dHr = depts.find(d => d.code === 'HR') || depts[2] || depts[0];

  const desigs = await prisma.designation.findMany({ where: { companyId: company.id } });
  const desVp = desigs.find(d => d.code === 'VPE') || desigs[0];
  const desLead = desigs.find(d => d.code === 'LPD') || desigs[1] || desigs[0];
  const desSse = desigs.find(d => d.code === 'SSE') || desigs[2] || desigs[0];

  // 1. Create 3 Controlled Synthetic Test Employees
  const empRohit = await prisma.employee.upsert({
    where: { employeeCode: 'PF-1001' },
    update: {},
    create: {
      companyId: company.id,
      branchId: bHq.id,
      departmentId: dEng.id,
      designationId: desVp.id,
      employeeCode: 'PF-1001',
      firstName: 'Rohit',
      lastName: 'Sharma',
      workEmail: 'rohit.sharma@payflow.internal',
      gender: 'MALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'HYBRID',
      dateOfJoining: new Date('2022-01-15')
    }
  });

  const empAnanya = await prisma.employee.upsert({
    where: { employeeCode: 'PF-1002' },
    update: {},
    create: {
      companyId: company.id,
      branchId: bHq.id,
      departmentId: dPrd.id,
      designationId: desLead.id,
      managerId: empRohit.id,
      employeeCode: 'PF-1002',
      firstName: 'Ananya',
      lastName: 'Verma',
      workEmail: 'ananya.verma@payflow.internal',
      gender: 'FEMALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'HYBRID',
      dateOfJoining: new Date('2022-06-01')
    }
  });

  const empRahul = await prisma.employee.upsert({
    where: { employeeCode: 'PF-1003' },
    update: {},
    create: {
      companyId: company.id,
      branchId: bBlr.id,
      departmentId: dEng.id,
      designationId: desSse.id,
      managerId: empRohit.id,
      employeeCode: 'PF-1003',
      firstName: 'Rahul',
      lastName: 'Mehta',
      workEmail: 'rahul.mehta@payflow.internal',
      gender: 'MALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'HYBRID',
      dateOfJoining: new Date('2023-03-15')
    }
  });

  console.log('✓ Created 3 Synthetic Employees: Rohit Sharma, Ananya Verma, Rahul Mehta');

  // Link users to employees
  await prisma.user.updateMany({ where: { username: 'rohit.sharma' }, data: { employeeId: empRohit.id } });
  await prisma.user.updateMany({ where: { username: 'ananya.verma' }, data: { employeeId: empAnanya.id } });
  await prisma.user.updateMany({ where: { username: 'rahul.mehta' }, data: { employeeId: empRahul.id } });
  console.log('✓ Linked employee records to test accounts');

  // 2. Setup Statutory Policy for Rahul Mehta
  await prisma.employeePayrollPolicy.upsert({
    where: { employeeId: empRahul.id },
    update: {},
    create: {
      employeeId: empRahul.id,
      pfStatus: 'MANDATORY',
      pfWageBasis: 'ACTUAL_BASIC',
      ptState: 'Karnataka',
      taxRegime: 'NEW'
    }
  });

  // 3. Assign Standard CTC Structure to Rahul Mehta (₹15,00,000 LPA)
  const components = await prisma.salaryComponent.findMany({ where: { companyId: company.id } });
  const basicComp = components.find(c => c.code === 'BASIC');
  const hraComp = components.find(c => c.code === 'HRA');
  const convComp = components.find(c => c.code === 'CONVEYANCE');
  const medComp = components.find(c => c.code === 'MEDICAL');
  const specComp = components.find(c => c.code === 'SPECIAL_ALLOWANCE');
  const pfComp = components.find(c => c.code === 'EPF_EMPLOYEE');
  const ptComp = components.find(c => c.code === 'PROFESSIONAL_TAX');
  const pfEmprComp = components.find(c => c.code === 'EPF_EMPLOYER');
  const gratComp = components.find(c => c.code === 'GRATUITY');

  const struct = await prisma.employeeSalaryStructure.upsert({
    where: { employeeId: empRahul.id },
    update: {
      annualCtc: 1500000,
      monthlyGross: 112532.5,
      effectiveFrom: new Date('2026-04-01'),
      revisionReason: 'Annual Appraisal'
    },
    create: {
      employeeId: empRahul.id,
      annualCtc: 1500000,
      monthlyGross: 112532.5,
      effectiveFrom: new Date('2026-04-01'),
      revisionReason: 'Annual Appraisal'
    }
  });

  await prisma.employeeSalaryLine.deleteMany({ where: { structureId: struct.id } });
  await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId: empRahul.id } });

  // Revision & lines
  await prisma.employeeSalaryRevision.create({
    data: {
      employeeId: empRahul.id,
      annualCtc: 1500000,
      monthlyGross: 112532.5,
      effectiveFrom: new Date('2026-04-01'),
      revisionReason: 'Annual Performance Appraisal',
      snapshot: { annualCtc: 1500000, monthlyGross: 112532.5 }
    }
  });

  await prisma.employeeSalaryLine.createMany({
    data: [
      { structureId: struct.id, componentId: basicComp.id, monthlyAmount: 50000, annualAmount: 600000 },
      { structureId: struct.id, componentId: hraComp.id, monthlyAmount: 25000, annualAmount: 300000 },
      { structureId: struct.id, componentId: convComp.id, monthlyAmount: 5000, annualAmount: 60000 },
      { structureId: struct.id, componentId: medComp.id, monthlyAmount: 6000, annualAmount: 72000 },
      { structureId: struct.id, componentId: specComp.id, monthlyAmount: 26532.5, annualAmount: 318390 },
      { structureId: struct.id, componentId: pfComp.id, monthlyAmount: 6000, annualAmount: 72000 },
      { structureId: struct.id, componentId: ptComp.id, monthlyAmount: 200, annualAmount: 2400 },
      { structureId: struct.id, componentId: pfEmprComp.id, monthlyAmount: 6000, annualAmount: 72000 },
      { structureId: struct.id, componentId: gratComp.id, monthlyAmount: 2405, annualAmount: 28860 }
    ]
  });
  console.log('✓ Assigned ₹15,00,000 LPA CTC structure to Rahul Mehta');

  // 4. Create an Isolated Payroll Period and Draft Run for October 2026
  let period = await prisma.payrollPeriod.findFirst({
    where: { companyId: company.id, month: 10, year: 2026 }
  });
  if (!period) {
    period = await prisma.payrollPeriod.create({
      data: {
        companyId: company.id,
        periodNumber: 10,
        name: 'October 2026 Regular Cycle',
        month: 10,
        year: 2026,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        cutoffDate: new Date('2026-10-25')
      }
    });
  }

  const existingRun = await prisma.corporatePayrollRun.findFirst({ where: { runNumber: 'PR-2026-10-001' } });
  if (existingRun) {
    await prisma.corporatePayrollItem.deleteMany({ where: { payrollSlip: { payrollRunId: existingRun.id } } });
    await prisma.corporatePayrollSlip.deleteMany({ where: { payrollRunId: existingRun.id } });
    await prisma.corporatePayrollRun.delete({ where: { id: existingRun.id } });
  }

  // Create Draft Run
  const run = await prisma.corporatePayrollRun.create({
    data: {
      companyId: company.id,
      periodId: period.id,
      runNumber: 'PR-2026-10-001',
      status: 'CALCULATED',
      totalEmployees: 1,
      totalGross: 112532.5,
      totalDeductions: 6200,
      totalNetPay: 106332.5,
      totalEmployerCost: 8405
    }
  });

  const slip = await prisma.corporatePayrollSlip.create({
    data: {
      payrollRunId: run.id,
      employeeId: empRahul.id,
      workingDays: 31,
      payableDays: 31,
      lopDays: 0,
      unpaidDays: 0,
      grossPay: 112532.5,
      deductionsPay: 6200,
      netPay: 106332.5,
      employerCost: 8405,
      calculationSnapshot: {
        annualCtc: 1500000,
        monthlyGross: 112532.5,
        netPay: 106332.5
      }
    }
  });

  await prisma.corporatePayrollItem.createMany({
    data: [
      { payrollSlipId: slip.id, code: 'BASIC', name: 'Basic Salary', type: 'EARNING', amount: 50000 },
      { payrollSlipId: slip.id, code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', amount: 25000 },
      { payrollSlipId: slip.id, code: 'CONVEYANCE', name: 'Conveyance Allowance', type: 'EARNING', amount: 5000 },
      { payrollSlipId: slip.id, code: 'MEDICAL', name: 'Medical Allowance', type: 'EARNING', amount: 6000 },
      { payrollSlipId: slip.id, code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', type: 'EARNING', amount: 26532.5 },
      { payrollSlipId: slip.id, code: 'EPF_EMPLOYEE', name: 'Employee PF (12%)', type: 'DEDUCTION', amount: 6000 },
      { payrollSlipId: slip.id, code: 'PROFESSIONAL_TAX', name: 'Professional Tax', type: 'DEDUCTION', amount: 200 }
    ]
  });
  console.log('✓ Created Isolated October 2026 Payroll Run & Calculated Slip');

  // 5. Test Punches & Leave Request
  await prisma.attendancePunch.create({
    data: {
      employeeId: empRahul.id,
      punchTime: new Date('2026-10-21T09:02:15Z'),
      punchType: 'CHECK_IN',
      source: 'WEB'
    }
  });

  const leavePol = await prisma.leavePolicy.findFirst({ where: { companyId: company.id } });
  if (leavePol) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: empRahul.id,
        leavePolicyId: leavePol.id,
        fromDate: new Date('2026-10-28'),
        toDate: new Date('2026-10-29'),
        totalDays: 2,
        reason: 'Personal family engagement',
        status: 'APPROVED'
      }
    });
  }
  console.log('✓ Added safe demo attendance punch and leave request');

  console.log('--- Setup Complete! Application is primed for genuine video demo ---');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

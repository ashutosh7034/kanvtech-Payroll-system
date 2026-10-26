const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:root@localhost:5432/payroll_management?schema=public' }
  }
});

async function main() {
  console.log('=== CANDIDATE TEST RECORDS IN PRODUCTION DATABASE (PAYROLL_MANAGEMENT) ===\n');

  // Seeded / legitimate employees:
  // Legitimate base employees were seeded or created during master setup:
  // APEX-1001, APEX-1002, APEX-1003, and APEX-0442 (the legitimate Pooja Kamat seeded on 2026-10-14 09:30:30Z)
  // All other 'Pooja Kamat' records with dynamically generated codes like APEX-xxxx created after 2026-10-14 11:00Z
  // And 'Devang Joshi' (AUD-3206) created during audit D testing.

  const allEmployees = await prisma.employee.findMany({
    include: {
      payrollSlips: true,
      loans: true,
      leaveBalances: true,
      leaveRequests: true,
      dailyAttendance: true,
      punches: true,
      salaryStructure: true,
      payrollPolicy: true,
      timeline: true,
      customFieldValues: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const candidateTestRecords = allEmployees.filter(e => {
    // Audit script creation
    if (e.employeeCode.startsWith('AUD-')) return true;
    // Dynamic Pooja Kamat test onboarding records (corporate.test.ts creates Pooja Kamat with APEX-${last 4 digits of timestamp})
    if (e.firstName === 'Pooja' && e.lastName === 'Kamat' && e.employeeCode !== 'APEX-0442') return true;
    return false;
  });

  console.log(`Identified ${candidateTestRecords.length} Candidate Test Records:`);
  candidateTestRecords.forEach((c, idx) => {
    console.log(`\n[${idx + 1}] ID: ${c.id}`);
    console.log(`    Code: ${c.employeeCode} | Name: ${c.firstName} ${c.lastName}`);
    console.log(`    Email: ${c.workEmail}`);
    console.log(`    Created: ${c.createdAt.toISOString()} | Status: ${c.status}`);
    console.log(`    Associated Records:`);
    console.log(`      - Payroll Slips: ${c.payrollSlips.length}`);
    console.log(`      - Loans: ${c.loans.length}`);
    console.log(`      - Leave Balances: ${c.leaveBalances.length}`);
    console.log(`      - Leave Requests: ${c.leaveRequests.length}`);
    console.log(`      - Daily Attendance: ${c.dailyAttendance.length}`);
    console.log(`      - Attendance Punches: ${c.punches.length}`);
    console.log(`      - Salary Structure: ${c.salaryStructure ? 'Yes' : 'None'}`);
    console.log(`      - Payroll Policy: ${c.payrollPolicy ? 'Yes' : 'None'}`);
    console.log(`      - Timeline Events: ${c.timeline.length}`);
  });

  console.log('\n--- Remediation SQL Generation ---');
  console.log('-- Safe, reviewed remediation procedure (to be executed ONLY after manual administrative sign-off):');
  console.log('BEGIN TRANSACTION;');
  candidateTestRecords.forEach(c => {
    console.log(`-- Candidate: ${c.employeeCode} (${c.firstName} ${c.lastName}, ID: ${c.id})`);
    console.log(`DELETE FROM "CorporatePayrollItem" WHERE "payrollSlipId" IN (SELECT "id" FROM "CorporatePayrollSlip" WHERE "employeeId" = '${c.id}');`);
    console.log(`DELETE FROM "CorporatePayrollSlip" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "PayslipDispatchRecord" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "LoanRepayment" WHERE "loanId" IN (SELECT "id" FROM "EmployeeLoan" WHERE "employeeId" = '${c.id}');`);
    console.log(`DELETE FROM "EmployeeLoan" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "LeaveRequest" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmployeeLeaveBalance" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "AttendancePunch" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "DailyAttendance" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmployeeSalaryLine" WHERE "structureId" IN (SELECT "id" FROM "EmployeeSalaryStructure" WHERE "employeeId" = '${c.id}');`);
    console.log(`DELETE FROM "EmployeeSalaryRevision" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmployeeSalaryStructure" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmployeePayrollPolicy" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmploymentTimeline" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "EmployeeCustomFieldValue" WHERE "employeeId" = '${c.id}';`);
    console.log(`DELETE FROM "Employee" WHERE "id" = '${c.id}';`);
  });
  console.log('COMMIT;');
}

main().finally(() => prisma.$disconnect());

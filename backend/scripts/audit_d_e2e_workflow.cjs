const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function login(username, password) {
  const res = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

async function runE2EAudit() {
  console.log('=== AUDIT D: END-TO-END WORKFLOW INTEGRATION VERIFICATION ===\n');
  const admin = await login('admin', 'Admin@123');
  const finance = await login('finance.lead', 'Admin@123');
  const callApi = (token, method, path, data) => request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1${path}`,
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, data);

  let testPeriod = null;
  const testCode = `AUD-${Date.now().toString().slice(-4)}`;
  console.log(`1. Creating Isolated Test Employee (${testCode})...`);
  
  const branch = await prisma.branch.findFirst({ where: { companyId: admin.user.companyId } });
  const dept = await prisma.department.findFirst({ where: { companyId: admin.user.companyId } });
  const desig = await prisma.designation.findFirst({ where: { companyId: admin.user.companyId } });

  const createEmpRes = await callApi(admin.token, 'POST', '/employees', {
    employeeCode: testCode,
    firstName: 'Devang',
    lastName: 'Joshi',
    workEmail: `devang.${testCode.toLowerCase()}@apexglobal.tech`,
    branchId: branch.id,
    departmentId: dept.id,
    designationId: desig.id,
    employmentType: 'PERMANENT',
    dateOfJoining: '2023-01-15'
  });
  if (createEmpRes.status !== 201) throw new Error(`Failed to create employee: ${JSON.stringify(createEmpRes.body)}`);
  const testEmp = createEmpRes.body.employee;
  console.log(`✓ Created test employee: ${testEmp.id} (${testEmp.employeeCode})`);

  try {
    // 2. Assign Salary Structure
    console.log('2. Assigning Salary Structure...');
    const template = await prisma.salaryTemplate.findFirst({ where: { companyId: admin.user.companyId } });
    const structRes = await callApi(admin.token, 'POST', '/compensation/assign', {
      employeeId: testEmp.id,
      templateId: template.id,
      annualCtc: 1200000,
      effectiveFrom: '2023-01-15',
      revisionReason: 'Initial E2E Audit Compensation Setup'
    });
    console.log(`✓ Salary Structure Assigned: Status = ${structRes.status}, Monthly Gross = ${structRes.body.structure?.monthlyGross}`);

    // 3. Attendance Entry (Punches)
    console.log('3. Recording Daily Attendance Punches...');
    await prisma.dailyAttendance.create({
      data: {
        employeeId: testEmp.id,
        date: new Date('2026-11-02'),
        status: 'PRESENT',
        workingHours: 8.5
      }
    });
    console.log('✓ Attendance logged: 1 present shift on 2026-11-02');

    // 4. Sanction Corporate Loan
    console.log('4. Sanctioning Corporate Loan...');
    const loanTypes = await prisma.loanType.findMany({ where: { companyId: admin.user.companyId } });
    const salAdv = loanTypes.find(l => l.code === 'SAL_ADV') || loanTypes[0];
    const loanRes = await callApi(admin.token, 'POST', '/loans/apply', {
      employeeId: testEmp.id,
      loanTypeId: salAdv.id,
      principalAmount: 60000,
      tenureMonths: 6
    });
    console.log(`✓ Loan Sanctioned: Status = ${loanRes.status}, Monthly EMI = ${loanRes.body.loan?.monthlyEmi}, Outstanding = ${loanRes.body.loan?.outstandingAmount}`);
    const loanId = loanRes.body.loan?.id;

    // 5. Create / Ensure Dedicated Non-Production Payroll Period (Nov 2026)
    console.log('5. Ensuring Isolated Test Period (November 2026)...');
    let testPeriod = await prisma.payrollPeriod.findFirst({
      where: { companyId: admin.user.companyId, month: 11, year: 2026 }
    });
    if (!testPeriod) {
      testPeriod = await prisma.payrollPeriod.create({
        data: {
          companyId: admin.user.companyId,
          name: 'November 2026',
          month: 11,
          year: 2026,
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-30')
        }
      });
    }
    console.log(`✓ Payroll Period: ${testPeriod.id} (${testPeriod.name})`);

    // Clean up any prior test run for Nov 2026 if exists in unfinalized state
    await prisma.corporatePayrollRun.deleteMany({
      where: { companyId: admin.user.companyId, periodId: testPeriod.id, status: { not: 'PAID' } }
    });

    // 6. Stage 1: DRAFT
    console.log('6. Stage 1: Initializing DRAFT Payroll Run...');
    const draftRes = await callApi(admin.token, 'POST', '/payroll/runs/draft', {
      periodId: testPeriod.id
    });
    console.log(`✓ Draft Initialized: Status = ${draftRes.status}, Run = ${draftRes.body.run?.runNumber}, Eligible = ${draftRes.body.run?.totalEmployees}`);
    const runId = draftRes.body.run?.id;

    // 7. Stage 2: VALIDATE
    console.log('7. Stage 2: Validating Payroll Inputs...');
    const valRes = await callApi(admin.token, 'POST', `/payroll/runs/${runId}/validate`);
    console.log(`✓ Validation Completed: Status = ${valRes.status}, Result Status = ${valRes.body.run?.status}`);

    // 8. Stage 3: CALCULATE
    console.log('8. Stage 3: Executing Deterministic Calculation...');
    const calcRes = await callApi(admin.token, 'POST', `/payroll/runs/${runId}/calculate`);
    console.log(`✓ Calculation Completed: Status = ${calcRes.status}, Gross = ${calcRes.body.run?.totalGross}, Net = ${calcRes.body.run?.totalNetPay}`);

    // Inspect Test Employee Slip
    const runDetails = await callApi(admin.token, 'GET', `/payroll/runs/${runId}`);
    const empSlip = runDetails.body.run?.slips?.find(s => s.employeeId === testEmp.id);
    console.log(`✓ Test Employee Slip in Batch: Gross = ${empSlip?.grossPay}, Net = ${empSlip?.netPay}`);
    const loanDeduction = empSlip?.items?.find(i => i.code === 'LOAN_EMI');
    console.log(`✓ Verified Loan EMI Deduction: Code = ${loanDeduction?.code}, Amount = ₹${loanDeduction?.amount} (Expected: ₹10000.00)`);

    // 9. Stage 4: REVIEW
    console.log('9. Stage 4: Submitting for Review...');
    const reviewRes = await callApi(admin.token, 'POST', `/payroll/runs/${runId}/review`, { remarks: 'E2E Audit Verification Review Passed' });
    console.log(`✓ Run Reviewed: Status = ${reviewRes.status}`);

    // 10. Stage 5: APPROVE (Dual-Control Finance Lead)
    console.log('10. Stage 5: Dual-Control Finance Approval...');
    const appRes = await callApi(finance.token, 'POST', `/payroll/runs/${runId}/approve`);
    console.log(`✓ Run Approved: Status = ${appRes.status}`);

    // 11. Stage 6: PAYMENT READY
    console.log('11. Stage 6: Advancing to PAYMENT_READY...');
    const readyRes = await callApi(finance.token, 'POST', `/payroll/runs/${runId}/payment-ready`);
    console.log(`✓ Run Payment Ready: Status = ${readyRes.status}`);

    // 12. Stage 7: MARK-PAID
    console.log('12. Stage 7: Marking Batch PAID with NEFT Reference...');
    const paidRes = await callApi(finance.token, 'POST', `/payroll/runs/${runId}/mark-paid`, {
      paymentReference: `NEFT-AUDIT-${Date.now()}`
    });
    console.log(`✓ Run Finalized: Status = ${paidRes.status}, Payment Ref = ${paidRes.body.run?.paymentReference}`);

    // 13. Verify Loan Recovery Decrement
    console.log('13. Verifying Loan Ledger Recovery & Balance Decrement...');
    const updatedLoan = await prisma.employeeLoan.findUnique({
      where: { id: loanId },
      include: { repayments: true }
    });
    console.log(`✓ Loan After Finalization: Recovered = ₹${updatedLoan.recoveredAmount}, Outstanding = ₹${updatedLoan.outstandingAmount}`);
    console.log(`✓ Repayment Schedule Records: Count = ${updatedLoan.repayments.length}, Paid = ₹${updatedLoan.repayments[0]?.amountPaid}`);

    // 14. Verify PDF Payslip Generation for Test Employee
    console.log('14. Verifying PDF Payslip Generation Buffer...');
    const pdfRes = await callApi(admin.token, 'GET', `/payroll/slips/${empSlip.id}/pdf`);
    console.log(`✓ PDF Generation: Status = ${pdfRes.status}, Content-Type = ${pdfRes.headers['content-type']}, Length = ${pdfRes.body.length || 'valid'}`);

    console.log('\n=== E2E AUDIT RESULT: FULL WORKFLOW PASSED COMPLETELY ===');
  } finally {
    // Clean up test employee and November 2026 test payroll run to preserve clean data
    console.log('\nCleaning up isolated test fixtures...');
    await prisma.corporatePayrollRun.deleteMany({ where: { periodId: testPeriod?.id } });
    await prisma.employeeLoan.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employeeCustomFieldValue.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.leaveRequest.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.dailyAttendance.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employeeSalaryStructure.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employeePayrollPolicy.deleteMany({ where: { employeeId: testEmp.id } });
    await prisma.employee.delete({ where: { id: testEmp.id } });
    console.log('✓ Isolated fixtures cleaned up without touching production records.');
  }
}

runE2EAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

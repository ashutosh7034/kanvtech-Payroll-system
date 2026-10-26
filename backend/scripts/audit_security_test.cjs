const http = require('http');

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
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

async function runSecurityAudit() {
  console.log('=== AUDIT E: SECURITY & ROLE-BASED ACCESS CONTROL VERIFICATION ===\n');

  // Authenticate personas
  console.log('1. Authenticating test personas...');
  const admin = await login('admin', 'Admin@123');
  const payroll = await login('payroll.officer', 'Admin@123');
  const finance = await login('finance.lead', 'Admin@123');
  const employee = await login('rahul.mehta', 'Admin@123');
  console.log('✓ Admin authenticated:', admin.user.fullName, admin.user.roles);
  console.log('✓ Payroll Officer authenticated:', payroll.user.fullName, payroll.user.roles);
  console.log('✓ Finance Lead authenticated:', finance.user.fullName, finance.user.roles);
  console.log('✓ Employee authenticated:', employee.user.fullName, employee.user.roles);

  const results = [];

  // Helper for authenticated requests
  const callApi = (token, method, path, data) => request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1${path}`,
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, data);

  // Test 1: Employee attempts to create/modify salary component
  console.log('\n2. Testing Unauthorized Salary Component Creation...');
  const res1 = await callApi(employee.token, 'POST', '/compensation/components', {
    code: 'HACKED_ALLOW',
    name: 'Unauthorized Allowance',
    category: 'FIXED_EARNING',
    type: 'EARNING'
  });
  console.log(`- Employee POST /compensation/components: Status = ${res1.status} (Expected: 403)`);
  results.push({
    test: 'Employee cannot create salary components',
    status: res1.status === 403 ? 'PASS' : 'FAIL',
    code: res1.status,
    response: res1.body?.message || res1.body
  });

  // Test 2: Employee attempts to create/modify salary structure
  console.log('\n3. Testing Unauthorized Salary Structure Assignment...');
  const res2 = await callApi(employee.token, 'POST', '/compensation/structures', {
    templateId: 'dummy-id',
    employeeId: employee.user.employeeId,
    annualCtc: 9999999
  });
  console.log(`- Employee POST /compensation/structures: Status = ${res2.status} (Expected: 403)`);
  results.push({
    test: 'Employee cannot create salary structures',
    status: res2.status === 403 ? 'PASS' : 'FAIL',
    code: res2.status,
    response: res2.body?.message || res2.body
  });

  // Test 3: Employee attempts to initiate payroll run
  console.log('\n4. Testing Unauthorized Payroll Batch Initialization...');
  const res3 = await callApi(employee.token, 'POST', '/payroll/runs/draft', {
    periodId: 'some-period'
  });
  console.log(`- Employee POST /payroll/runs/draft: Status = ${res3.status} (Expected: 403)`);
  results.push({
    test: 'Employee cannot initiate payroll runs',
    status: res3.status === 403 ? 'PASS' : 'FAIL',
    code: res3.status,
    response: res3.body?.message || res3.body
  });

  // Test 4: Payroll Officer attempts to finalize/mark-paid payroll without finance role
  console.log('\n5. Testing Separation of Duties (Payroll Officer cannot finalize/mark-paid)...');
  const res4 = await callApi(payroll.token, 'POST', '/payroll/runs/dummy-id/mark-paid', {
    paymentReference: 'FAKE-UTR-999'
  });
  console.log(`- Payroll Officer POST /payroll/runs/:id/mark-paid: Status = ${res4.status} (Expected: 403)`);
  results.push({
    test: 'Payroll processor cannot execute mark-paid disbursement',
    status: res4.status === 403 ? 'PASS' : 'FAIL',
    code: res4.status,
    response: res4.body?.message || res4.body
  });

  // Test 5: Employee attempts to access another employee's payslip
  console.log('\n6. Testing Payslip Confidentiality Boundary...');
  const adminRunsRes = await callApi(admin.token, 'GET', '/payroll/runs');
  const paidRun = adminRunsRes.body.runs?.find(r => r.status === 'PAID') || adminRunsRes.body.runs?.[0];
  let targetSlipId = '';
  if (paidRun) {
    const runDetails = await callApi(admin.token, 'GET', `/payroll/runs/${paidRun.id}`);
    const otherSlip = runDetails.body.run?.slips?.find(s => s.employeeId !== employee.user.employeeId);
    if (otherSlip) targetSlipId = otherSlip.id;
  }

  if (targetSlipId) {
    const res5 = await callApi(employee.token, 'GET', `/payroll/runs/${paidRun.id}/slips/${targetSlipId}`);
    console.log(`- Employee GET /payroll/runs/:runId/slips/:slipId: Status = ${res5.status} (Expected: 403)`);
    results.push({
      test: 'Employee cannot access another employee payslip',
      status: res5.status === 403 ? 'PASS' : 'FAIL',
      code: res5.status,
      response: res5.body?.message || res5.body
    });

    const res5Pdf = await callApi(employee.token, 'GET', `/payroll/slips/${targetSlipId}/pdf`);
    console.log(`- Employee GET /payroll/slips/${targetSlipId}/pdf: Status = ${res5Pdf.status} (Expected: 403)`);
    results.push({
      test: 'Employee cannot download another employee payslip PDF',
      status: res5Pdf.status === 403 ? 'PASS' : 'FAIL',
      code: res5Pdf.status,
      response: res5Pdf.body?.message || res5Pdf.body
    });
  }

  // Test 6: Employee attempts to view confidential employee profile
  console.log('\n7. Testing Confidential Employee Profile Access Boundary...');
  const empsRes = await callApi(admin.token, 'GET', '/employees');
  const otherEmp = empsRes.body.employees?.find(e => e.id !== employee.user.employeeId);
  const otherEmpId = otherEmp?.id || 'APEX-1001';
  const res6 = await callApi(employee.token, 'GET', `/employees/${otherEmpId}`);
  console.log(`- Employee GET /employees/:id: Status = ${res6.status} (Expected: 403)`);
  results.push({
    test: 'Employee cannot view confidential employee profile',
    status: res6.status === 403 ? 'PASS' : 'FAIL',
    code: res6.status,
    response: res6.body?.message || res6.body
  });

  // Test 7: Employee attempts to sanction loan
  console.log('\n8. Testing Unauthorized Loan Sanction...');
  const loanTypesRes = await callApi(admin.token, 'GET', '/loans/types');
  const loanTypeId = loanTypesRes.body.types?.[0]?.id || 'dummy-uuid';
  const res7 = await callApi(employee.token, 'POST', '/loans/apply', {
    employeeId: employee.user.employeeId,
    loanTypeId,
    principalAmount: 50000,
    tenureMonths: 12
  });
  console.log(`- Employee POST /loans/apply: Status = ${res7.status} (Expected: 403)`);
  results.push({
    test: 'Employee cannot self-sanction loans',
    status: res7.status === 403 ? 'PASS' : 'FAIL',
    code: res7.status,
    response: res7.body?.message || res7.body
  });

  // Test 8: Manager attempts to approve their own leave request
  console.log('\n9. Testing Segregation of Duties (Manager cannot approve own leave request)...');
  const manager = await login('rohit.sharma', 'Admin@123');
  // Manager applies for leave
  const leavePolicies = await callApi(manager.token, 'GET', '/leave/policies');
  const pol = leavePolicies.body.policies?.[0];
  let selfApproveStatus = 'N/A';
  if (pol) {
    const leaveApp = await callApi(manager.token, 'POST', '/leave/apply', {
      leavePolicyId: pol.id,
      fromDate: '2026-11-01',
      toDate: '2026-11-02',
      totalDays: 2,
      reason: 'Audit self-approval test'
    });
    if (leaveApp.body?.leaveRequest?.id) {
      const selfApprove = await callApi(manager.token, 'POST', `/leave/applications/${leaveApp.body.leaveRequest.id}/action`, {
        status: 'APPROVED'
      });
      selfApproveStatus = selfApprove.status;
      console.log(`- Manager POST /leave/applications/:id/action on own leave: Status = ${selfApprove.status} (Expected: 403)`);
      results.push({
        test: 'Manager cannot self-approve their own leave request',
        status: selfApprove.status === 403 ? 'PASS' : 'FAIL',
        code: selfApprove.status,
        response: selfApprove.body?.message || selfApprove.body
      });
    }
  }

  console.log('\n=== SECURITY AUDIT SUMMARY TABLE ===');
  console.table(results);
}

runSecurityAudit().catch(console.error);

const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- Testing Parity Features: One-Click Email Payslips & ESS Loans ---');

  // 1. Login as Admin
  const adminLogin = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'Admin@123' });

  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin login successful');

  // 2. Login as Employee
  const empLogin = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'rahul.mehta', password: 'Admin@123' });

  if (empLogin.status !== 200) {
    throw new Error(`Employee login failed: ${JSON.stringify(empLogin.data)}`);
  }
  const empToken = empLogin.data.token;
  console.log('✓ Employee (rahul.mehta) login successful');

  // 3. Test One-Click Payslip Email Dispatch (VID-32)
  // Fetch existing runs
  const runsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/payroll/runs',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('runsRes status:', runsRes.status, 'data:', runsRes.data);

  let paidRun = runsRes.data.runs.find(r => r.status === 'PAID');
  if (!paidRun) {
    console.log('No existing PAID run found; initializing fresh cycle for test...');
    const periodsRes = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/payroll/periods',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const period = periodsRes.data.periods[0];
    const draftRes = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/payroll/runs/draft',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    }, { periodId: period.id });

    const runId = draftRes.data.run.id;
    await request({ hostname: 'localhost', port: 4000, path: `/api/v1/payroll/runs/${runId}/validate`, method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await request({ hostname: 'localhost', port: 4000, path: `/api/v1/payroll/runs/${runId}/calculate`, method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await request({ hostname: 'localhost', port: 4000, path: `/api/v1/payroll/runs/${runId}/review`, method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await request({ hostname: 'localhost', port: 4000, path: `/api/v1/payroll/runs/${runId}/approve`, method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await request({ hostname: 'localhost', port: 4000, path: `/api/v1/payroll/runs/${runId}/payment-ready`, method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/payroll/runs/${runId}/mark-paid`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    }, { paymentReference: 'NEFT-AUTO-TEST-2026' });

    const fetchPaid = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/payroll/runs/${runId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    paidRun = fetchPaid.data.run;
  }
  console.log(`Found/Finalized PAID run: ${paidRun.runNumber} (ID: ${paidRun.id})`);

  // 3a. Employee should be rejected from calling send-payslips (RBAC)
  const empSendRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/payroll/runs/${paidRun.id}/send-payslips`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  console.log(`✓ RBAC Check: Employee blocked from emailing payslips (Status: ${empSendRes.status})`);
  if (empSendRes.status !== 403) throw new Error('Expected 403 for employee send-payslips');

  // 3b. Admin dispatches payslips
  const adminSendRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/payroll/runs/${paidRun.id}/send-payslips`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`✓ Admin Payslip Dispatch Response (Status: ${adminSendRes.status}):`, adminSendRes.data);
  if (adminSendRes.status !== 200 || !adminSendRes.data.success) {
    throw new Error('Failed to dispatch payslips');
  }
  console.log(`  Dispatched to: ${adminSendRes.data.dispatchedCount}/${adminSendRes.data.totalEmployees} employees`);

  // 4. Test Employee Self-Service Loans (VID-28)
  // 4a. Get ESS loans list & available types
  const essLoansRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/self-service/loans',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  console.log(`✓ ESS Loans Query (Status: ${essLoansRes.status}):`, {
    loansCount: essLoansRes.data.loans.length,
    availableTypesCount: essLoansRes.data.availableTypes.length,
    summary: essLoansRes.data.summary
  });
  if (essLoansRes.status !== 200) throw new Error('Failed to query ESS loans');

  const selectedType = essLoansRes.data.availableTypes[0];
  console.log(`Applying for scheme: ${selectedType.name} (ID: ${selectedType.id})`);

  // 4b. Employee submits a loan request
  const applyRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/self-service/loans/request',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${empToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    loanTypeId: selectedType.id,
    principalAmount: 25000,
    tenureMonths: 5,
    reason: 'Festival travel advance'
  });
  console.log(`✓ ESS Loan Request (Status: ${applyRes.status}):`, applyRes.data);
  if (applyRes.status !== 201 || applyRes.data.loan.status !== 'PENDING') {
    throw new Error('Loan request submission failed or status not PENDING');
  }
  const submittedLoanId = applyRes.data.loan.id;

  // 4c. Verify ESS query now includes the pending loan
  const essLoansRes2 = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/self-service/loans',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${empToken}` }
  });
  const foundPending = essLoansRes2.data.loans.find(l => l.id === submittedLoanId);
  if (!foundPending) throw new Error('Submitted loan not found in ESS loans list');
  console.log(`✓ Loan found in ESS list with status: ${foundPending.status}, Monthly EMI: ₹${foundPending.monthlyEmi}`);

  // 4d. Admin approves the pending loan
  const approveRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/loans/${submittedLoanId}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { status: 'ACTIVE' });
  console.log(`✓ Admin Approved Loan (Status: ${approveRes.status}): status=${approveRes.data.loan.status}`);
  if (approveRes.status !== 200 || approveRes.data.loan.status !== 'ACTIVE') {
    throw new Error('Failed to approve loan to ACTIVE');
  }

  // 4e. Clean up test loan so test fixtures remain clean
  const cancelRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/loans/${submittedLoanId}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { status: 'CANCELLED' });
  console.log(`✓ Cleaned up test loan (Status: ${cancelRes.data.loan.status})`);

  console.log('\n ALL PARITY TESTS PASSED SUCCESSFULLY! ');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

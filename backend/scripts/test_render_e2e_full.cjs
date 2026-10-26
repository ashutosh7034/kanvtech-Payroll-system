async function runLiveE2ETest() {
  const urlBase = 'https://kanvtech-payroll-system.onrender.com/api/v1';
  console.log(`=== LIVE RENDER BACKEND E2E TEST: ${urlBase} ===\n`);

  // 1. Health
  try {
    const res = await fetch(`${urlBase}/health`);
    console.log(`1. Health Check [GET /health]: Status ${res.status}`);
    const data = await res.json();
    console.log('   Response:', JSON.stringify(data));
  } catch (err) {
    console.error('1. Health Check FAILED:', err.message);
  }

  // 2. Readiness
  try {
    const res = await fetch(`${urlBase}/ready`);
    console.log(`\n2. Readiness Check [GET /ready]: Status ${res.status}`);
    const data = await res.json();
    console.log('   Response:', JSON.stringify(data));
  } catch (err) {
    console.error('2. Readiness Check FAILED:', err.message);
  }

  // 3. CORS Preflight
  try {
    const res = await fetch(`${urlBase}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://kanvtech-payroll-system.vercel.app',
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log(`\n3. CORS Preflight Check [OPTIONS /health]: Status ${res.status}`);
    console.log('   Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin'));
  } catch (err) {
    console.error('3. CORS Preflight FAILED:', err.message);
  }

  // 4. Authentication Login
  let token = '';
  try {
    const res = await fetch(`${urlBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@apexglobal.tech',
        password: 'Admin@123'
      })
    });
    console.log(`\n4. Authentication [POST /auth/login]: Status ${res.status}`);
    const data = await res.json();
    if (res.ok && data.token) {
      token = data.token;
      console.log(`   User authenticated: ${data.user?.fullName} (${data.user?.email})`);
      console.log(`   Company: ${data.user?.company?.name}`);
      console.log(`   JWT Token received: Length ${token.length} chars`);
    } else {
      console.log('   Login response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('4. Auth FAILED:', err.message);
  }

  if (token) {
    // 5. Employees Query
    try {
      const res = await fetch(`${urlBase}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`\n5. Employee Master [GET /employees]: Status ${res.status}`);
      const data = await res.json();
      console.log(`   Retrieved employees: ${Array.isArray(data) ? data.length : (data.employees?.length || 0)}`);
    } catch (err) {
      console.error('5. Employees FAILED:', err.message);
    }

    // 6. Salary Components
    try {
      const res = await fetch(`${urlBase}/compensation/components`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`\n6. Compensation Components [GET /compensation/components]: Status ${res.status}`);
      const data = await res.json();
      console.log(`   Retrieved salary components: ${Array.isArray(data) ? data.length : (data.components?.length || 0)}`);
    } catch (err) {
      console.error('6. Compensation Components FAILED:', err.message);
    }

    // 7. Payroll Periods
    try {
      const res = await fetch(`${urlBase}/payroll/periods`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`\n7. Payroll Periods [GET /payroll/periods]: Status ${res.status}`);
      const data = await res.json();
      console.log(`   Retrieved periods: ${Array.isArray(data) ? data.length : (data.periods?.length || 0)}`);
    } catch (err) {
      console.error('7. Payroll Periods FAILED:', err.message);
    }
  }

  console.log('\n=== LIVE TEST SUITE FINISHED ===');
}

runLiveE2ETest();

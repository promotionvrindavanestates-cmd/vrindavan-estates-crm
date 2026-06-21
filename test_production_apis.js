const BACKEND_URL = 'https://vrindavan-estates-crm-backend.onrender.com';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

async function runTests() {
  console.log(`Starting Production Phase 4A API Verification on: ${BACKEND_URL}`);
  
  // 1. Authenticate
  let token;
  try {
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    
    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
    }
    
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('✅ 1. Authentication successful!');
  } catch (err) {
    console.error('❌ 1. Authentication FAILED:', err.message);
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const testEndpoint = async (urlPath) => {
    try {
      const res = await fetch(`${BACKEND_URL}${urlPath}`, { headers });
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [SUCCESS] ${urlPath}`);
        console.log(`  - Type: ${typeof data}`);
        console.log(`  - Sample Keys/Data:`, Object.keys(data).slice(0, 8).join(', '));
        if (urlPath.includes('advanced')) {
          console.log(`  - Sales Funnel Counts:`, JSON.stringify(data.funnel));
        }
        return { ok: true, data };
      } else {
        const txt = await res.text();
        console.log(`❌ [FAILED] ${urlPath} - Status: ${res.status}`);
        console.log(`  - Error: ${txt}`);
        return { ok: false };
      }
    } catch (e) {
      console.log(`❌ [ERROR] ${urlPath} - Exception: ${e.message}`);
      return { ok: false };
    }
  };

  console.log('\n--- TESTING CRM ENDPOINTS ---');
  await testEndpoint('/api/notifications/alerts');
  await testEndpoint('/api/reminders/widgets');
  await testEndpoint('/api/dashboard/advanced');
  await testEndpoint('/api/whatsapp/templates');
  await testEndpoint('/api/activities/recent');
  await testEndpoint('/api/payments');
  await testEndpoint('/api/analytics/roi');
  await testEndpoint('/api/analytics/funnel');
  await testEndpoint('/api/analytics/performance');
  await testEndpoint('/api/analytics/incentives');
  
  const empRes = await testEndpoint('/api/employees');
  if (empRes.ok && Array.isArray(empRes.data) && empRes.data.length > 0) {
    const testEmpId = empRes.data[0].id;
    await testEndpoint(`/api/employees/${testEmpId}/performance`);
  } else {
    console.log('⚠️ [SKIP] Skipping employee performance test: No employees found');
  }
}

runTests();

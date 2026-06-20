const BACKEND_URL = 'https://vrindavan-estates-crm-backend.onrender.com';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

async function runTests() {
  console.log(`Starting Production CRM Pagination and API Audit on: ${BACKEND_URL}`);
  
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

  // Test paginated leads endpoint
  try {
    const res = await fetch(`${BACKEND_URL}/api/leads?page=1&limit=2`, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log('--- PAGINATED LEADS RESPONSE ---');
      console.log('Type of response:', typeof data, 'IsArray:', Array.isArray(data));
      console.log('Keys in response:', Object.keys(data).join(', '));
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log('✅ latest commit 851a0d3 (Server-side Pagination) is LIVE on Render!');
        console.log(`- Page: ${data.page}`);
        console.log(`- Limit: ${data.limit}`);
        console.log(`- Total count: ${data.total}`);
        console.log(`- Number of leads returned: ${data.leads ? data.leads.length : 0}`);
      } else {
        console.log('⚠️ Old commit is still running (Render is building the new deployment).');
      }
    } else {
      console.error('❌ Paginated leads request failed with status:', res.status);
    }
  } catch (e) {
    console.error('❌ Exception during paginated leads test:', e.message);
  }
}

runTests();

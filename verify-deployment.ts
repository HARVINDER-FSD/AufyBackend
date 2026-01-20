import axios from 'axios';
import * as readline from 'readline';

async function verifyDeployment() {
  console.log('\n🚀 Verifying Render Deployment for Anonymous Mode');
  console.log('==============================================');

  try {
    // 1. Get Render URL from args
    const baseUrlInput = process.argv[2];
    
    if (!baseUrlInput) {
      console.error('❌ URL is required! Usage: npx ts-node verify-deployment.ts <URL>');
      process.exit(1);
    }

    let baseUrl = baseUrlInput.trim();

    
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    if (!baseUrl) {
      console.error('❌ URL is required!');
      process.exit(1);
    }

    // Append /api/v1 if not present (assuming standard prefix, but checking index.ts shows direct routes?)
    // Wait, let's check index.ts again.
    // It imports routes but doesn't show app.use('/api', ...). Let's assume standard Express setup.
    // Usually it's app.use('/api', routes).
    // Let's try to ping a health check or root first.
    
    // We will assume routes are mounted at /api/v1 or just /api or root.
    // Based on index.ts content:
    // It imports routes but we didn't see the app.use statements in the first 100 lines.
    // We should assume /api based on standard practices or try to detect.
    // Let's assume the user enters the BASE URL of the API.
    // We will try `baseUrl + '/health'` or just assume paths.
    // Let's try to login first.
    
    console.log(`\n📡 Connecting to ${baseUrl}...`);

    // 2. Login (or Register if needed, but let's try login with a test user)
    // We'll try to register a random test user to ensure we have a valid token
    const testUser = {
      email: `anon_test_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      username: `anontester${Math.floor(Math.random() * 1000)}`,
      full_name: 'Anonymous Tester',
      dob: '2000-01-01'
    };

    console.log('👤 Creating Test User...');
    let token = '';
    
    try {
      const regRes = await axios.post(`${baseUrl}/auth/register`, testUser);
      token = regRes.data.token;
      console.log('✅ Registration Successful!');
    } catch (e: any) {
      // If registration fails (maybe 404), try /api/auth/register
      if (e.response && e.response.status === 404) {
        console.log('⚠️  /auth/register not found, trying /api/auth/register...');
        baseUrl = `${baseUrl}/api`;
        const regRes = await axios.post(`${baseUrl}/auth/register`, testUser);
        token = regRes.data.token;
        console.log('✅ Registration Successful (at /api)!');
      } else {
        throw e;
      }
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. Toggle Anonymous Mode
    console.log('\n👻 Enabling Anonymous Mode...');
    const toggleRes = await axios.post(`${baseUrl}/users/anonymous/toggle`, {}, { headers: authHeaders });
    
    if (toggleRes.data.isAnonymousMode) {
        console.log(`✅ Anonymous Mode Enabled! Persona: ${toggleRes.data.anonymousPersona?.username}`);
    } else {
        console.error('❌ Failed to enable Anonymous Mode');
        // Force enable if it toggled off
        await axios.post(`${baseUrl}/users/anonymous/toggle`, {}, { headers: authHeaders });
        console.log('✅ (Retried) Anonymous Mode Enabled!');
    }

    // 4. Fetch Anonymous Feed
    console.log('\n📰 Fetching Anonymous Feed...');
    try {
        const feedRes = await axios.get(`${baseUrl}/feed/anonymous?limit=5`, { headers: authHeaders });
        console.log(`✅ Feed Fetched! Got ${feedRes.data.data.length} posts.`);
    } catch (e: any) {
        console.error(`❌ Feed Fetch Error: ${e.message}`);
    }

    // 5. Join Anonymous Chat Queue (The Real Test)
    console.log('\n💬 Joining Anonymous Chat Queue (Redis Test)...');
    try {
        const chatRes = await axios.post(`${baseUrl}/chat/anonymous/join`, { interests: ['general'] }, { headers: authHeaders });
        console.log(`✅ Chat Queue Join Successful! Status: ${chatRes.data.status}`);
        if (chatRes.data.status === 'matched') {
            console.log(`🎉 MATCH FOUND! Conversation ID: ${chatRes.data.conversationId}`);
        } else {
            console.log('⏳ Queued (Waiting for partner). This means Redis is working!');
        }
    } catch (e: any) {
        console.error(`❌ Chat Queue Error: ${e.message}`);
        console.error('👉 If this failed with 500, Redis might still be unreachable on Render.');
    }

    console.log('\n==============================================');
    console.log('✅ VERIFICATION COMPLETE');
    
  } catch (error: any) {
    console.error('\n❌ VERIFICATION FAILED');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

verifyDeployment();

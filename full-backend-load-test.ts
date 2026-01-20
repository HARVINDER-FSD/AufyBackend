import axios from 'axios';

// Configuration
const BASE_URL = process.env.TARGET_URL || 'https://aufybackend.onrender.com';
const NUM_USERS = 50; // Moderate load for remote testing
const RAMP_UP_MS = 5000; // Ramp up over 5 seconds

// Stats
const stats = {
  registered: 0,
  feedFetches: 0,
  likes: 0,
  chatJoins: 0,
  errors: 0,
  latencies: [] as number[]
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function userScenario(userIndex: number) {
  const log = (msg: string) => {
    // Only log first few users to avoid console spam
    if (userIndex < 3) console.log(`[User ${userIndex}] ${msg}`);
  };

  const start = Date.now();
  
  try {
    // 1. Register
    const userData = {
      email: `loadtest_${Date.now()}_${userIndex}@example.com`,
      password: 'Password123!',
      username: `lt_${Date.now()}_${userIndex}`,
      full_name: `Load Tester ${userIndex}`,
      dob: '1995-01-01'
    };

    // Try /api/auth first
    let effectiveBaseUrl = `${BASE_URL}/api`;
    let registerUrl = `${effectiveBaseUrl}/auth/register`;
    
    let token = '';
    let userId = '';

    try {
      const regRes = await axios.post(registerUrl, userData);
      token = regRes.data.token;
      userId = regRes.data.user.id;
      stats.registered++;
      log('Registered');
    } catch (e: any) {
        if (e.response?.status === 404) {
             // Fallback to root if /api failed
             effectiveBaseUrl = BASE_URL;
             registerUrl = `${effectiveBaseUrl}/auth/register`;
             
             const regRes = await axios.post(registerUrl, userData);
             token = regRes.data.token;
             userId = regRes.data.user.id;
             stats.registered++;
             log('Registered (fallback path)');
        } else {
            throw e;
        }
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Fetch Feed (Normal)
    const t0 = Date.now();
    await axios.get(`${effectiveBaseUrl}/feed?limit=10`, { headers });
    stats.latencies.push(Date.now() - t0);
    stats.feedFetches++;
    log('Fetched Feed');

    // 3. Enable Anonymous Mode
    const anonRes = await axios.post(`${effectiveBaseUrl}/users/anonymous/toggle`, {}, { headers });
    log(`Anonymous Mode: ${anonRes.data.isAnonymousMode}`);

    // 4. Fetch Anonymous Feed
    const t1 = Date.now();
    await axios.get(`${effectiveBaseUrl}/feed/anonymous?limit=10`, { headers });
    stats.latencies.push(Date.now() - t1);
    stats.feedFetches++;
    log('Fetched Anonymous Feed');

    // 5. Join Chat Queue
    const t2 = Date.now();
    const chatRes = await axios.post(`${effectiveBaseUrl}/chat/anonymous/join`, { interests: ['general'] }, { headers });
    stats.latencies.push(Date.now() - t2);
    stats.chatJoins++;
    log(`Joined Chat Queue: ${chatRes.data.status}`);

    // Simulate thinking time
    await sleep(Math.random() * 2000);

  } catch (error: any) {
    stats.errors++;
    // console.error(`[User ${userIndex}] Error: ${error.message}`);
  }
}

async function runLoadTest() {
  console.log(`🚀 Starting Full Backend Load Test`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Users: ${NUM_USERS}`);
  console.log(`-----------------------------------`);

  const promises = [];
  for (let i = 0; i < NUM_USERS; i++) {
    // Stagger starts
    await sleep(RAMP_UP_MS / NUM_USERS);
    promises.push(userScenario(i));
  }

  await Promise.all(promises);

  console.log(`\n📊 Load Test Report`);
  console.log(`-----------------------------------`);
  console.log(`Total Users: ${NUM_USERS}`);
  console.log(`Registered: ${stats.registered}`);
  console.log(`Feed Fetches: ${stats.feedFetches}`);
  console.log(`Chat Joins: ${stats.chatJoins}`);
  console.log(`Errors: ${stats.errors}`);
  
  const avgLatency = stats.latencies.length 
    ? (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(2) 
    : 0;
  
  console.log(`Avg Latency: ${avgLatency}ms`);
  
  if (stats.errors > 0) {
      console.log(`\n⚠️  Some requests failed. Check server logs.`);
  } else {
      console.log(`\n✅ System withstood the load!`);
  }
}

runLoadTest();

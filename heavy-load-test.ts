import axios from 'axios';
import { faker } from '@faker-js/faker';

// Configuration
const BASE_URL = process.env.TARGET_URL || 'https://aufybackend.onrender.com';
const NUM_USERS = parseInt(process.env.NUM_USERS || '200'); // Default to 200, but allow override
const RAMP_UP_MS = 20000; // 20 seconds ramp up

// Stats Tracker
const stats = {
  totalRequests: 0,
  success: 0,
  failed: 0,
  endpoints: {} as Record<string, { success: number; fail: number; avgLatency: number; latencies: number[] }>
};

const recordStat = (endpoint: string, latency: number, isSuccess: boolean) => {
  if (!stats.endpoints[endpoint]) {
    stats.endpoints[endpoint] = { success: 0, fail: 0, avgLatency: 0, latencies: [] };
  }
  const ep = stats.endpoints[endpoint];
  stats.totalRequests++;
  
  if (isSuccess) {
    stats.success++;
    ep.success++;
    ep.latencies.push(latency);
  } else {
    stats.failed++;
    ep.fail++;
  }
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to handle API calls with stats
async function apiCall(name: string, fn: () => Promise<any>) {
  const start = Date.now();
  try {
    const res = await fn();
    const duration = Date.now() - start;
    recordStat(name, duration, true);
    return res;
  } catch (error: any) {
    const duration = Date.now() - start;
    recordStat(name, duration, false);
    // console.error(`❌ ${name} Failed: ${error.message}`);
    throw error;
  }
}

async function complexUserScenario(userIndex: number) {
  const log = (msg: string) => {
    if (userIndex < 5) console.log(`[User ${userIndex}] ${msg}`);
  };

  try {
    // 1. Register & Auth
    const userData = {
      email: faker.internet.email(),
      password: 'Password123!',
      username: faker.internet.username().replace(/[^a-zA-Z0-9_.]/g, '').substring(0, 29),
      full_name: faker.person.fullName(),
      dob: '1995-01-01'
    };

    let token = '';
    let userId = '';

    // Try /api path first
    let effectiveBaseUrl = `${BASE_URL}/api`;
    
    try {
      const regRes = await apiCall('Auth:Register', () => axios.post(`${effectiveBaseUrl}/auth/register`, userData));
      token = regRes.data.token;
      userId = regRes.data.user.id;
    } catch (e: any) {
       // Retry with root path if 404
       if (e.response?.status === 404) {
          effectiveBaseUrl = BASE_URL;
          const regRes = await apiCall('Auth:Register (Retry)', () => axios.post(`${effectiveBaseUrl}/auth/register`, userData));
          token = regRes.data.token;
          userId = regRes.data.user.id;
       } else {
         throw e;
       }
    }

    const headers = { Authorization: `Bearer ${token}` };
    log('Registered & Logged In');

    // 2. Profile Operations
    await apiCall('User:GetProfile', () => axios.get(`${effectiveBaseUrl}/users/${userId}`, { headers }));
    
    await apiCall('User:UpdateProfile', () => axios.put(`${effectiveBaseUrl}/users/profile`, {
      bio: faker.lorem.sentence(),
      website: faker.internet.url()
    }, { headers }));
    log('Updated Profile');

    // 3. Content Creation (Post)
    const postRes = await apiCall('Post:Create', () => axios.post(`${effectiveBaseUrl}/posts`, {
      content: faker.lorem.paragraph(),
      media_type: 'text'
    }, { headers }));
    const postId = postRes.data.id;
    log('Created Post');

    // 4. Feed & Consumption
    const feedRes = await apiCall('Feed:GetMain', () => axios.get(`${effectiveBaseUrl}/feed?limit=5`, { headers }));
    const feedPosts = feedRes.data.data || [];
    
    if (feedPosts.length > 0) {
      // Like a random post
      const randomPost = feedPosts[Math.floor(Math.random() * feedPosts.length)];
      await apiCall('Post:Like', () => axios.post(`${effectiveBaseUrl}/posts/${randomPost.id}/like`, {}, { headers }));
      
      // Comment on a post
      await apiCall('Post:Comment', () => axios.post(`${effectiveBaseUrl}/comments`, {
        post_id: randomPost.id,
        content: faker.lorem.sentence()
      }, { headers }));
    }
    log('Interacted with Feed');

    // 5. Reels & Stories
    await apiCall('Reels:GetFeed', () => axios.get(`${effectiveBaseUrl}/reels`, { headers }));
    await apiCall('Stories:GetFeed', () => axios.get(`${effectiveBaseUrl}/stories`, { headers }));

    // 6. Anonymous Mode (The New Feature)
    await apiCall('Anon:Toggle', () => axios.post(`${effectiveBaseUrl}/users/anonymous/toggle`, {}, { headers }));
    
    // 7. Anonymous Feed
    await apiCall('Anon:GetFeed', () => axios.get(`${effectiveBaseUrl}/feed/anonymous`, { headers }));
    
    // 8. Anonymous Chat
    const joinRes = await apiCall('Anon:JoinChat', () => axios.post(`${effectiveBaseUrl}/chat/anonymous/join`, { 
      interests: ['coding', 'music'] 
    }, { headers }));

    // 9. Anonymous Skip
    const conversationId = joinRes?.data?.conversationId;
    // Only skip if we actually got a match, otherwise we're just waiting in queue
    if (conversationId) {
        await apiCall('Anon:Skip', () => axios.post(`${effectiveBaseUrl}/chat/anonymous/skip`, { 
            interests: ['coding', 'music'],
            currentConversationId: conversationId 
        }, { headers }));
    }

    log('Scenario Complete');

  } catch (error) {
    // Already recorded in apiCall wrapper
  }
}

async function runHeavyLoadTest() {
  console.log(`\n🚀 STARTING HEAVY BACKEND LOAD TEST`);
  console.log(`===========================================`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Users: ${NUM_USERS} (Heavy Load)`);
  console.log(`Scenarios: Auth -> Profile -> Post -> Feed -> Like/Comment -> Reels -> Stories -> Anon Mode`);
  console.log(`===========================================\n`);

  const promises = [];
  for (let i = 0; i < NUM_USERS; i++) {
    await sleep(RAMP_UP_MS / NUM_USERS);
    promises.push(complexUserScenario(i));
  }

  await Promise.all(promises);

  console.log(`\n📊 HEAVY LOAD TEST REPORT`);
  console.log(`===========================================`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful:     ${stats.success}`);
  console.log(`Failed:         ${stats.failed}`);
  console.log(`===========================================`);
  
  console.log(`\nEndpoint Breakdown:`);
  console.table(
    Object.entries(stats.endpoints).map(([name, data]) => {
        const avg = data.latencies.length 
          ? (data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length).toFixed(0) 
          : 0;
        return {
            Endpoint: name,
            Success: data.success,
            Fail: data.fail,
            'Avg Latency (ms)': avg
        };
    })
  );
  
  if (stats.failed === 0) {
      console.log(`\n✅ PASSED: Backend handled HEAVY load perfectly.`);
  } else {
      console.log(`\n⚠️  WARNING: Some requests failed under HEAVY load.`);
  }
}

runHeavyLoadTest();
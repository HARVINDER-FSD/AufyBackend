import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENCY || process.argv[2] || '10', 10) || 10;
const TOTAL_REQUESTS = 120;

interface RequestStats {
  name: string;
  duration: number;
  success: boolean;
  status: number;
}

const stats: RequestStats[] = [];

async function makeRequest(name: string, fn: () => Promise<any>) {
  const start = performance.now();
  let success = false;
  let status = 0;
  try {
    const res = await fn();
    status = res.status;
    success = status >= 200 && status < 300;
  } catch (error: any) {
    status = error.response?.status || 500;
    success = false;
    const msg = error.response?.data || error.message;
    console.error(`✗ ${name} failed with status ${status}`, msg);
  }
  const end = performance.now();
  stats.push({ name, duration: end - start, success, status });
}

async function getAuthToken(prefix: string) {
  const timestamp = Date.now();
  const email = `${prefix}_${timestamp}@example.com`;
  const password = 'Password123!';
  const username = `${prefix}_user_${timestamp}`;

  try {
    await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      username,
      name: `${prefix} Test User`,
      dob: '2000-01-01'
    });
  } catch (error: any) {
  }

  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    email,
    password
  });

  return { token: loginRes.data.token as string, userId: loginRes.data.user._id as string };
}

async function runFeatureLoadTest() {
  console.log('🚀 Starting Feature Load Test...');
  console.log(`Target: ${API_URL}`);
  console.log(`Concurrency: ${CONCURRENT_REQUESTS}`);

  await makeRequest('Health', () => axios.get(`${BASE_URL}/health`));

  // Create two users for chat testing
  const user1 = await getAuthToken('user1');
  const user2 = await getAuthToken('user2');
  
  const token = user1.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Create conversation between user1 and user2
  let conversationId = 'dummy';
  try {
    const convRes = await axios.post(`${API_URL}/chat/conversations`, { userId: user2.userId }, authHeaders);
    conversationId = convRes.data._id;
    console.log(`Created test conversation: ${conversationId}`);
  } catch (err: any) {
    console.error('Failed to create conversation:', err.message);
  }

  const endpoints = [
    { name: 'Feed', fn: () => axios.get(`${API_URL}/feed?page=1&limit=20`, authHeaders) },
    { name: 'Notifications', fn: () => axios.get(`${API_URL}/notifications?limit=20`, authHeaders) },
    { name: 'UsersList', fn: () => axios.get(`${API_URL}/users/list?limit=20`, authHeaders) },
    { name: 'ExploreTrending', fn: () => axios.get(`${API_URL}/explore/trending?limit=20`, authHeaders) },
    { name: 'ExploreFeed', fn: () => axios.get(`${API_URL}/explore/feed?page=1&limit=20`, authHeaders) },
    { name: 'SearchMain', fn: () => axios.get(`${API_URL}/search?q=test&limit=10`, authHeaders) },
    { name: 'ChatConversations', fn: () => axios.get(`${API_URL}/chat/conversations`, authHeaders) },
    { name: 'ChatMessages', fn: () => axios.get(`${API_URL}/chat/conversations/${conversationId}/messages?limit=20`, authHeaders) },
    { name: 'SendMessage', fn: () => axios.post(`${API_URL}/chat/conversations/${conversationId}/messages`, {
        content: 'Load test message',
        image: 'https://via.placeholder.com/150', // Simulate media/voice shot url
        message_type: 'text'
      }, authHeaders) 
    },
    { name: 'SettingsPrivacy', fn: () => axios.get(`${API_URL}/settings/privacy`, authHeaders) },
    { name: 'CommentsMine', fn: () => axios.get(`${API_URL}/comments/my-comments?limit=20`, authHeaders) }
  ];

  const queue = Array(TOTAL_REQUESTS).fill(null).map((_, i) => {
    const endpoint = endpoints[i % endpoints.length];
    return { ...endpoint, id: i };
  });

  for (let i = 0; i < queue.length; i += CONCURRENT_REQUESTS) {
    const chunk = queue.slice(i, i + CONCURRENT_REQUESTS);
    await Promise.all(chunk.map(item => makeRequest(item.name, item.fn)));
    process.stdout.write(`.`);
  }

  console.log('\n\n📊 Feature Load Test Results:');
  console.log('----------------------------------------');

  const grouped = stats.reduce((acc, curr) => {
    if (!acc[curr.name]) acc[curr.name] = [];
    acc[curr.name].push(curr);
    return acc;
  }, {} as Record<string, RequestStats[]>);

  Object.entries(grouped).forEach(([name, requests]) => {
    const avg = requests.reduce((sum, r) => sum + r.duration, 0) / requests.length;
    const min = Math.min(...requests.map(r => r.duration));
    const max = Math.max(...requests.map(r => r.duration));
    const successCount = requests.filter(r => r.success).length;
    const successRate = (successCount / requests.length) * 100;

    console.log(`\nEndpoint: ${name}`);
    console.log(`  Requests: ${requests.length}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`  Avg Latency: ${avg.toFixed(2)}ms`);
    console.log(`  Min/Max: ${min.toFixed(0)}/${max.toFixed(0)}ms`);
  });

  console.log('----------------------------------------');
}

runFeatureLoadTest().catch(console.error);

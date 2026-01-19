
import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5001';
const CONCURRENT_REQUESTS = 10;
const TOTAL_REQUESTS = 100;

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
  }
  const end = performance.now();
  stats.push({ name, duration: end - start, success, status });
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENT_REQUESTS}`);

  const endpoints = [
    { name: 'Health', fn: () => axios.get(`${BASE_URL}/health`) },
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

  console.log('\n\n📊 Load Test Results:');
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

runLoadTest().catch(console.error);

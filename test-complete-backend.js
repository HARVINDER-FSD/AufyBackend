// Complete Backend API Test Suite
const axios = require('axios');

const BASE_URL = 'https://aufybackend.onrender.com';
let authToken = '';
let testUserId = '';

// Test credentials
const testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
  username: 'testuser' + Date.now(),
  name: 'Test User'
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, endpoint, data = null, requiresAuth = false) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: requiresAuth ? { Authorization: `Bearer ${authToken}` } : {},
      timeout: 10000,
    };

    if (data) {
      config.data = data;
    }

    const start = Date.now();
    const response = await axios(config);
    const duration = Date.now() - start;

    log(`✅ ${name} - ${response.status} (${duration}ms)`, 'green');
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    const status = error.response?.status || 'ERROR';
    const message = error.response?.data?.message || error.message;
    log(`❌ ${name} - ${status}: ${message}`, 'red');
    return { success: false, error: message, status };
  }
}

async function runTests() {
  log('\n🚀 Starting Complete Backend Test Suite\n', 'blue');
  log(`Backend: ${BASE_URL}\n`, 'yellow');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  // 1. Health Check
  log('📋 1. HEALTH & CONNECTIVITY', 'blue');
  let result = await testEndpoint('Health Check', 'GET', '/health');
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 2. Authentication
  log('\n📋 2. AUTHENTICATION', 'blue');
  
  result = await testEndpoint('Register', 'POST', '/api/auth/register', testUser);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Login', 'POST', '/api/auth/login', {
    email: testUser.email,
    password: testUser.password,
  });
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  if (result.success && result.data.token) {
    authToken = result.data.token;
    testUserId = result.data.user?.id || result.data.user?._id;
    log(`   Token acquired: ${authToken.substring(0, 20)}...`, 'yellow');
  }

  // 3. User Endpoints
  log('\n📋 3. USER ENDPOINTS', 'blue');
  
  result = await testEndpoint('Get Current User', 'GET', '/api/users/me', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Get User Profile', 'GET', `/api/users/${testUserId}`, null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Search Users', 'GET', '/api/search?q=test', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 4. Feed & Posts
  log('\n📋 4. FEED & POSTS', 'blue');
  
  result = await testEndpoint('Get Feed', 'GET', '/api/feed', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Get Posts', 'GET', '/api/posts', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 5. Stories
  log('\n📋 5. STORIES', 'blue');
  
  result = await testEndpoint('Get Stories', 'GET', '/api/stories', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 6. Reels
  log('\n📋 6. REELS', 'blue');
  
  result = await testEndpoint('Get Reels', 'GET', '/api/reels', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 7. Notifications
  log('\n📋 7. NOTIFICATIONS', 'blue');
  
  result = await testEndpoint('Get Notifications', 'GET', '/api/notifications', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 8. Messages
  log('\n📋 8. MESSAGES', 'blue');
  
  result = await testEndpoint('Get Conversations', 'GET', '/api/users/conversations', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 9. Notes
  log('\n📋 9. NOTES', 'blue');
  
  result = await testEndpoint('Get Notes', 'GET', '/api/notes', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Notes Health', 'GET', '/api/notes/health');
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 10. AI
  log('\n📋 10. AI FEATURES', 'blue');
  
  result = await testEndpoint('AI Generate', 'POST', '/api/ai/generate', {
    prompt: 'Hello, how are you?'
  }, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 11. Settings
  log('\n📋 11. SETTINGS', 'blue');
  
  result = await testEndpoint('Get Settings', 'GET', '/api/settings', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 12. Premium
  log('\n📋 12. PREMIUM', 'blue');
  
  result = await testEndpoint('Premium Status', 'GET', '/api/premium/status', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 13. Secret Crush
  log('\n📋 13. SECRET CRUSH', 'blue');
  
  result = await testEndpoint('Get Crush List', 'GET', '/api/secret-crush/my-list', null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // 14. Follow System
  log('\n📋 14. FOLLOW SYSTEM', 'blue');
  
  result = await testEndpoint('Get Followers', 'GET', `/api/users/${testUserId}/followers`, null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;
  
  result = await testEndpoint('Get Following', 'GET', `/api/users/${testUserId}/following`, null, true);
  results.total++; if (result.success) results.passed++; else results.failed++;

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('📊 TEST SUMMARY', 'blue');
  log('='.repeat(50), 'blue');
  log(`Total Tests: ${results.total}`, 'yellow');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 'yellow');
  log('='.repeat(50) + '\n', 'blue');

  if (results.failed === 0) {
    log('🎉 All tests passed!', 'green');
  } else {
    log(`⚠️  ${results.failed} test(s) failed. Review the errors above.`, 'yellow');
  }
}

// Run tests
runTests().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  process.exit(1);
});

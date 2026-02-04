/**
 * Comprehensive App Testing Suite
 * Tests all major functions with performance monitoring
 */

import axios from 'axios';

const API_URL = process.env.BACKEND_URL || 'http://localhost:5001';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

// Helper to measure performance
async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  maxDuration: number = 1000
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    results.push({
      name,
      status: duration <= maxDuration ? 'PASS' : 'FAIL',
      duration,
      error: duration > maxDuration ? `Exceeded ${maxDuration}ms limit` : undefined
    });
    
    console.log(`✅ ${name}: ${duration}ms`);
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({
      name,
      status: 'FAIL',
      duration,
      error: error.message
    });
    
    console.log(`❌ ${name}: ${error.message}`);
    throw error;
  }
}

// Test data
let testUserId: string;
let testToken: string;
let testUsername: string;
let testPostId: string;
let testPrivateUserId: string;
let testPrivateToken: string;

let testEmail: string;

// ============================================
// 1. AUTHENTICATION TESTS
// ============================================

async function testAuthentication() {
  console.log('\n📝 TESTING AUTHENTICATION...\n');

  // Register
  await measurePerformance('Register User', async () => {
    testEmail = `test${Date.now()}@example.com`;
    const res = await axios.post(`${API_URL}/api/auth/register`, {
      email: testEmail,
      password: 'Test@123456',
      username: `testuser${Date.now()}`,
      full_name: 'Test User',
      dob: '2000-01-01'
    });
    testUserId = res.data.user.id;
    testToken = res.data.token;
    testUsername = res.data.user.username;
    return res.data;
  }, 2000);

  // Login
  await measurePerformance('Login User', async () => {
    const res = await axios.post(`${API_URL}/api/auth/login`, {
      email: testEmail,
      password: 'Test@123456'
    });
    return res.data;
  }, 1000);

  // Get current user
  await measurePerformance('Get Current User', async () => {
    const res = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);
}

// ============================================
// 2. PROFILE TESTS
// ============================================

async function testProfile() {
  console.log('\n👤 TESTING PROFILE...\n');

  // Get own profile
  await measurePerformance('Get Own Profile', async () => {
    const res = await axios.get(`${API_URL}/api/users/username/${testUsername}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Update profile
  await measurePerformance('Update Profile', async () => {
    const res = await axios.put(`${API_URL}/api/users/profile`, {
      full_name: 'Updated Name',
      bio: 'Test bio'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 1000);

  // Toggle private account
  await measurePerformance('Toggle Private Account', async () => {
    const res = await axios.put(`${API_URL}/api/users/privacy`, {
      isPrivate: true
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);
}

// ============================================
// 3. FOLLOW SYSTEM TESTS
// ============================================

async function testFollowSystem() {
  console.log('\n🔗 TESTING FOLLOW SYSTEM...\n');

  // Create second user (public)
  const user2Res = await axios.post(`${API_URL}/api/auth/register`, {
    email: `test2${Date.now()}@example.com`,
    password: 'Test@123456',
    username: `testuser2${Date.now()}`,
    full_name: 'Test User 2'
  });
  const user2Id = user2Res.data.user.id;
  const user2Token = user2Res.data.token;

  // Create third user (private)
  const user3Res = await axios.post(`${API_URL}/api/auth/register`, {
    email: `test3${Date.now()}@example.com`,
    password: 'Test@123456',
    username: `testuser3${Date.now()}`,
    full_name: 'Test User 3'
  });
  testPrivateUserId = user3Res.data.user.id;
  testPrivateToken = user3Res.data.token;

  // Make user3 private
  await axios.put(`${API_URL}/api/users/privacy`, {
    isPrivate: true
  }, {
    headers: { Authorization: `Bearer ${testPrivateToken}` }
  });

  // Test: Follow public user (instant)
  await measurePerformance('Follow Public User', async () => {
    const res = await axios.post(`${API_URL}/api/users/${user2Id}/follow`, {}, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Test: Check follow status
  await measurePerformance('Check Follow Status', async () => {
    const res = await axios.get(`${API_URL}/api/users/${user2Id}/follow-status`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 300);

  // Test: Follow private user (creates request)
  await measurePerformance('Follow Private User (Request)', async () => {
    const res = await axios.post(`${API_URL}/api/users/${testPrivateUserId}/follow`, {}, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Test: Get follow requests
  await measurePerformance('Get Follow Requests', async () => {
    const res = await axios.get(`${API_URL}/api/users/follow-requests`, {
      headers: { Authorization: `Bearer ${testPrivateToken}` }
    });
    return res.data;
  }, 500);

  // Test: Approve follow request
  if (results[results.length - 1].status === 'PASS') {
    const requestId = (await axios.get(`${API_URL}/api/users/follow-requests`, {
      headers: { Authorization: `Bearer ${testPrivateToken}` }
    })).data.data[0]?.id;

    if (requestId) {
      await measurePerformance('Approve Follow Request', async () => {
        const res = await axios.post(
          `${API_URL}/api/users/follow-requests/${requestId}/approve`,
          {},
          { headers: { Authorization: `Bearer ${testPrivateToken}` } }
        );
        return res.data;
      }, 500);
    }
  }

  // Test: Get followers
  await measurePerformance('Get Followers List', async () => {
    const res = await axios.get(`${API_URL}/api/users/${user2Id}/followers`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Test: Get following
  await measurePerformance('Get Following List', async () => {
    const res = await axios.get(`${API_URL}/api/users/${testUserId}/following`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Test: Unfollow
  await measurePerformance('Unfollow User', async () => {
    const res = await axios.delete(`${API_URL}/api/users/${user2Id}/follow`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);
}

// ============================================
// 4. POSTS TESTS
// ============================================

async function testPosts() {
  console.log('\n📸 TESTING POSTS...\n');

  // Create post
  await measurePerformance('Create Post', async () => {
    const res = await axios.post(`${API_URL}/api/posts`, {
      content: 'Test post content',
      media_urls: [],
      media_type: 'text',
      location: 'Test Location'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    testPostId = res.data.data.post.id;
    return res.data;
  }, 1000);

  // Get user posts
  await measurePerformance('Get User Posts', async () => {
    const res = await axios.get(`${API_URL}/api/users/${testUserId}/posts?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Get feed
  await measurePerformance('Get Feed', async () => {
    const res = await axios.get(`${API_URL}/api/posts/feed?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  if (testPostId) {
    // Like post
    await measurePerformance('Like Post', async () => {
      const res = await axios.post(`${API_URL}/api/posts/${testPostId}/like`, {}, {
        headers: { Authorization: `Bearer ${testToken}` }
      });
      return res.data;
    }, 500);

    // Comment on post
    await measurePerformance('Comment on Post', async () => {
      const res = await axios.post(`${API_URL}/api/posts/${testPostId}/comments`, {
        content: 'Test comment'
      }, {
        headers: { Authorization: `Bearer ${testToken}` }
      });
      return res.data;
    }, 500);
  }
}

// ============================================
// 5. SEARCH TESTS
// ============================================

async function testSearch() {
  console.log('\n🔍 TESTING SEARCH...\n');

  // Search users
  await measurePerformance('Search Users', async () => {
    const res = await axios.get(`${API_URL}/api/search?q=test&limit=20`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Search posts
  await measurePerformance('Search Posts', async () => {
    const res = await axios.get(`${API_URL}/api/search?q=test&limit=20`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);
}

// ============================================
// 6. MESSAGING TESTS
// ============================================

async function testMessaging() {
  console.log('\n💬 TESTING MESSAGING...\n');

  // Send message
  await measurePerformance('Send Message', async () => {
    const res = await axios.post(`${API_URL}/api/chat/messages`, {
      recipient_id: testPrivateUserId,
      content: 'Test message',
      type: 'text'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);

  // Get messages
  await measurePerformance('Get Messages', async () => {
    const res = await axios.get(`${API_URL}/api/chat/messages/${testPrivateUserId}`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    return res.data;
  }, 500);
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE APP TESTS...\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    await testAuthentication();
    await testProfile();
    await testFollowSystem();
    await testPosts();
    await testSearch();
    await testMessaging();

    // Print summary
    console.log('\n\n📊 TEST SUMMARY\n');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms\n`);

    console.log('Detailed Results:');
    console.log('-'.repeat(60));
    results.forEach(r => {
      const status = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${r.name.padEnd(40)} ${r.duration}ms`);
      if (r.error) console.log(`   Error: ${r.error}`);
    });

    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!\n');
    } else {
      console.log(`\n⚠️  ${failed} TEST(S) FAILED\n`);
    }

  } catch (error: any) {
    console.error('\n❌ Test suite error:', error.message);
  }
}

// Run tests
runAllTests();

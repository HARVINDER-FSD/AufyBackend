/**
 * Comprehensive Backend URL Test
 * Tests all major features using production backend
 */

const axios = require('axios');

const BACKEND_URL = 'https://aufybackend.onrender.com';
const results = [];

async function test(name, fn, maxDuration = 1000) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    const status = duration <= maxDuration ? '✅ PASS' : '⚠️  SLOW';
    console.log(`${status} | ${name.padEnd(40)} | ${duration}ms`);
    results.push({ name, status: duration <= maxDuration ? 'PASS' : 'SLOW', duration });
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ FAIL | ${name.padEnd(40)} | ${error.message.substring(0, 30)}`);
    results.push({ name, status: 'FAIL', duration, error: error.message });
  }
}

let testToken = '';
let testUserId = '';
let testUsername = '';
let testPostId = '';
let user2Id = '';

async function runTests() {
  console.log('\n🚀 COMPREHENSIVE BACKEND URL TEST\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  console.log('='.repeat(100));
  console.log('STATUS | TEST NAME                                | DURATION');
  console.log('='.repeat(100));

  try {
    // 1. AUTHENTICATION
    console.log('\n📝 AUTHENTICATION TESTS');
    
    await test('Register User', async () => {
      const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        email: `test${Date.now()}@example.com`,
        password: 'Test@123456',
        username: `testuser${Date.now()}`,
        full_name: 'Test User'
      }, { timeout: 15000 });
      testUserId = res.data.user.id;
      testToken = res.data.token;
      testUsername = res.data.user.username;
    }, 2000);

    await test('Get Current User', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    // 2. PROFILE
    console.log('\n👤 PROFILE TESTS');

    await test('Get Own Profile', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/username/${testUsername}`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    await test('Update Profile', async () => {
      const res = await axios.put(`${BACKEND_URL}/api/users/profile`, {
        full_name: 'Updated Name',
        bio: 'Test bio'
      }, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 1000);

    await test('Toggle Private Account', async () => {
      const res = await axios.put(`${BACKEND_URL}/api/users/privacy`, {
        isPrivate: true
      }, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    // 3. FOLLOW SYSTEM
    console.log('\n🔗 FOLLOW SYSTEM TESTS');

    // Create second user
    const user2Res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      email: `test2${Date.now()}@example.com`,
      password: 'Test@123456',
      username: `testuser2${Date.now()}`,
      full_name: 'Test User 2'
    }, { timeout: 15000 });
    user2Id = user2Res.data.user.id;
    const user2Token = user2Res.data.token;

    await test('Follow Public User', async () => {
      const res = await axios.post(`${BACKEND_URL}/api/users/${user2Id}/follow`, {}, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    await test('Check Follow Status', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/${user2Id}/follow-status`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 300);

    await test('Get Followers List', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/${user2Id}/followers`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    await test('Get Following List', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/${testUserId}/following`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    await test('Unfollow User', async () => {
      const res = await axios.delete(`${BACKEND_URL}/api/users/${user2Id}/follow`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    // 4. POSTS
    console.log('\n📸 POST TESTS');

    await test('Create Post', async () => {
      const res = await axios.post(`${BACKEND_URL}/api/posts`, {
        content: 'Test post content',
        media_urls: [],
        media_type: 'text',
        location: 'Test Location'
      }, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
      testPostId = res.data.data.post.id;
    }, 1000);

    await test('Get User Posts', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users/${testUserId}/posts?page=1&limit=20`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    await test('Get Feed', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/posts/feed?page=1&limit=20`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    if (testPostId) {
      await test('Like Post', async () => {
        const res = await axios.post(`${BACKEND_URL}/api/posts/${testPostId}/like`, {}, {
          headers: { Authorization: `Bearer ${testToken}` },
          timeout: 10000
        });
      }, 500);

      await test('Comment on Post', async () => {
        const res = await axios.post(`${BACKEND_URL}/api/posts/${testPostId}/comments`, {
          content: 'Test comment'
        }, {
          headers: { Authorization: `Bearer ${testToken}` },
          timeout: 10000
        });
      }, 500);
    }

    // 5. SEARCH
    console.log('\n🔍 SEARCH TESTS');

    await test('Search Users', async () => {
      const res = await axios.get(`${BACKEND_URL}/api/search?q=test&limit=20`, {
        headers: { Authorization: `Bearer ${testToken}` },
        timeout: 10000
      });
    }, 500);

    // SUMMARY
    console.log('\n' + '='.repeat(100));
    console.log('\n📊 TEST SUMMARY\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const slow = results.filter(r => r.status === 'SLOW').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Slow: ${slow}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms\n`);

    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
    } else {
      console.log(`⚠️  ${failed} TEST(S) FAILED\n`);
    }

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  }
}

runTests();

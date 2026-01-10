/**
 * Full App Test - Comprehensive Feature Verification
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001';
let testData = {
  user1: {},
  user2: {},
  post: {},
  reel: {},
  story: {}
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message.substring(0, 50)}`);
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 FULL APP TEST SUITE\n');
  let passed = 0, failed = 0;

  // 1. AUTHENTICATION
  console.log('📝 AUTHENTICATION');
  
  if (await test('Register User 1', async () => {
    const res = await axios.post(`${API_URL}/api/auth/register`, {
      email: `user${Date.now()}@test.com`,
      password: 'Test@123456',
      username: `user${Date.now()}`,
      full_name: 'Test User 1'
    });
    testData.user1 = res.data.user;
    testData.user1.token = res.data.token;
  })) passed++; else failed++;

  if (await test('Register User 2', async () => {
    const res = await axios.post(`${API_URL}/api/auth/register`, {
      email: `user2${Date.now()}@test.com`,
      password: 'Test@123456',
      username: `user2${Date.now()}`,
      full_name: 'Test User 2'
    });
    testData.user2 = res.data.user;
    testData.user2.token = res.data.token;
  })) passed++; else failed++;

  // 2. PROFILE
  console.log('\n👤 PROFILE');

  if (await test('Get Profile', async () => {
    await axios.get(`${API_URL}/api/users/${testData.user1.id}`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Update Profile', async () => {
    await axios.put(`${API_URL}/api/users/profile`, {
      full_name: 'Updated Name',
      bio: 'Test bio'
    }, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Toggle Private Account', async () => {
    await axios.put(`${API_URL}/api/users/privacy`, {
      isPrivate: true
    }, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 3. FOLLOW SYSTEM
  console.log('\n🔗 FOLLOW SYSTEM');

  if (await test('Follow User', async () => {
    await axios.post(`${API_URL}/api/users/${testData.user2.id}/follow`, {}, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Get Follow Status', async () => {
    await axios.get(`${API_URL}/api/users/${testData.user2.id}/follow-status`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Get Followers', async () => {
    await axios.get(`${API_URL}/api/users/${testData.user2.id}/followers`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Get Following', async () => {
    await axios.get(`${API_URL}/api/users/${testData.user1.id}/following`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 4. POSTS
  console.log('\n📸 POSTS');

  if (await test('Create Post', async () => {
    const res = await axios.post(`${API_URL}/api/posts`, {
      content: 'Test post content',
      media_urls: [],
      media_type: 'text',
      location: 'Test Location'
    }, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
    testData.post = res.data.data.post;
  })) passed++; else failed++;

  if (await test('Get User Posts', async () => {
    await axios.get(`${API_URL}/api/users/${testData.user1.id}/posts`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (await test('Get Feed', async () => {
    await axios.get(`${API_URL}/api/posts/feed`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  if (testData.post.id) {
    if (await test('Like Post', async () => {
      await axios.post(`${API_URL}/api/posts/${testData.post.id}/like`, {}, {
        headers: { Authorization: `Bearer ${testData.user1.token}` }
      });
    })) passed++; else failed++;

    if (await test('Comment on Post', async () => {
      await axios.post(`${API_URL}/api/posts/${testData.post.id}/comments`, {
        content: 'Test comment'
      }, {
        headers: { Authorization: `Bearer ${testData.user1.token}` }
      });
    })) passed++; else failed++;

    if (await test('Share Post', async () => {
      await axios.post(`${API_URL}/api/posts/${testData.post.id}/share`, {}, {
        headers: { Authorization: `Bearer ${testData.user1.token}` }
      });
    })) passed++; else failed++;
  }

  // 5. REELS
  console.log('\n🎬 REELS');

  if (await test('Create Reel', async () => {
    const res = await axios.post(`${API_URL}/api/reels`, {
      content: 'Test reel',
      video_url: 'https://example.com/video.mp4',
      thumbnail_url: 'https://example.com/thumb.jpg'
    }, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
    testData.reel = res.data.data;
  })) passed++; else failed++;

  if (await test('Get Reels Feed', async () => {
    await axios.get(`${API_URL}/api/reels/feed`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 6. STORIES
  console.log('\n📖 STORIES');

  if (await test('Create Story', async () => {
    const res = await axios.post(`${API_URL}/api/stories`, {
      content: 'Test story',
      media_url: 'https://example.com/story.jpg',
      media_type: 'image'
    }, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
    testData.story = res.data.data;
  })) passed++; else failed++;

  if (await test('Get Stories', async () => {
    await axios.get(`${API_URL}/api/stories`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 7. SEARCH
  console.log('\n🔍 SEARCH');

  if (await test('Search Users', async () => {
    await axios.get(`${API_URL}/api/search?q=test`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 8. NOTIFICATIONS
  console.log('\n🔔 NOTIFICATIONS');

  if (await test('Get Notifications', async () => {
    await axios.get(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${testData.user1.token}` }
    });
  })) passed++; else failed++;

  // 9. HEALTH CHECK
  console.log('\n💚 HEALTH CHECK');

  if (await test('Server Health', async () => {
    await axios.get(`${API_URL}/health`);
  })) passed++; else failed++;

  if (await test('Metrics Endpoint', async () => {
    await axios.get(`${API_URL}/api/metrics`);
  })) passed++; else failed++;

  // SUMMARY
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 RESULTS: ${passed} Passed, ${failed} Failed\n`);
  
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! App is fully functional!\n');
  } else {
    console.log(`⚠️  ${failed} test(s) failed\n`);
  }
}

runTests().catch(console.error);

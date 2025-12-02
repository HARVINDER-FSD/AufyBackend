// Test script to verify like and follow persistence
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

// Test credentials
const testUser1 = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

const testUser2 = {
  email: 'test2@example.com',
  password: 'Test123!@#'
};

let user1Token = '';
let user2Token = '';
let user1Id = '';
let user2Id = '';
let testPostId = '';
let testReelId = '';

async function login(email, password) {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    return {
      token: response.data.token,
      userId: response.data.user.id || response.data.user._id
    };
  } catch (error) {
    console.error(`❌ Login failed for ${email}:`, error.response?.data || error.message);
    return null;
  }
}

async function testPostLike() {
  console.log('\n📝 Testing Post Like Persistence...');
  
  try {
    // Get feed to find a post
    const feedResponse = await axios.get(`${API_URL}/api/posts/feed`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    
    const posts = feedResponse.data.data?.posts || feedResponse.data.posts || [];
    if (posts.length === 0) {
      console.log('⚠️  No posts found to test');
      return;
    }
    
    testPostId = posts[0].id || posts[0]._id;
    console.log(`📌 Testing with post ID: ${testPostId}`);
    
    // Like the post
    console.log('👍 Liking post...');
    const likeResponse = await axios.post(
      `${API_URL}/api/posts/${testPostId}/like`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Like response:', {
      liked: likeResponse.data.liked,
      likeCount: likeResponse.data.likeCount
    });
    
    // Verify like persisted
    console.log('🔍 Verifying like persisted...');
    const verifyResponse = await axios.get(
      `${API_URL}/api/posts/${testPostId}`,
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    const post = verifyResponse.data.data?.post || verifyResponse.data.post;
    console.log('✅ Post like status:', {
      liked: post.liked || post.is_liked,
      likes: post.likes || post.likes_count
    });
    
    if (post.liked || post.is_liked) {
      console.log('✅ POST LIKE PERSISTED CORRECTLY!');
    } else {
      console.log('❌ POST LIKE NOT PERSISTED!');
    }
    
    // Unlike the post
    console.log('👎 Unliking post...');
    const unlikeResponse = await axios.post(
      `${API_URL}/api/posts/${testPostId}/like`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Unlike response:', {
      liked: unlikeResponse.data.liked,
      likeCount: unlikeResponse.data.likeCount
    });
    
  } catch (error) {
    console.error('❌ Post like test failed:', error.response?.data || error.message);
  }
}

async function testReelLike() {
  console.log('\n🎬 Testing Reel Like Persistence...');
  
  try {
    // Get reels
    const reelsResponse = await axios.get(`${API_URL}/api/reels`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    
    const reels = reelsResponse.data.data?.reels || reelsResponse.data.reels || reelsResponse.data.data || [];
    if (reels.length === 0) {
      console.log('⚠️  No reels found to test');
      return;
    }
    
    testReelId = reels[0].id || reels[0]._id;
    console.log(`📌 Testing with reel ID: ${testReelId}`);
    
    // Like the reel
    console.log('👍 Liking reel...');
    const likeResponse = await axios.post(
      `${API_URL}/api/reels/${testReelId}/like`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Like response:', {
      liked: likeResponse.data.liked,
      likes: likeResponse.data.likes
    });
    
    // Verify like persisted
    console.log('🔍 Verifying like persisted...');
    const verifyResponse = await axios.get(
      `${API_URL}/api/reels/${testReelId}`,
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    const reel = verifyResponse.data.data?.reel || verifyResponse.data.reel;
    console.log('✅ Reel like status:', {
      liked: reel.liked || reel.is_liked,
      likes: reel.likes || reel.likes_count
    });
    
    if (reel.liked || reel.is_liked) {
      console.log('✅ REEL LIKE PERSISTED CORRECTLY!');
    } else {
      console.log('❌ REEL LIKE NOT PERSISTED!');
    }
    
    // Unlike the reel
    console.log('👎 Unliking reel...');
    const unlikeResponse = await axios.post(
      `${API_URL}/api/reels/${testReelId}/like`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Unlike response:', {
      liked: unlikeResponse.data.liked,
      likes: unlikeResponse.data.likes
    });
    
  } catch (error) {
    console.error('❌ Reel like test failed:', error.response?.data || error.message);
  }
}

async function testFollow() {
  console.log('\n👥 Testing Follow Persistence...');
  
  try {
    // Follow user 2
    console.log(`👤 Following user ${user2Id}...`);
    const followResponse = await axios.post(
      `${API_URL}/api/users/${user2Id}/follow`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Follow response:', {
      isFollowing: followResponse.data.isFollowing,
      followerCount: followResponse.data.followerCount
    });
    
    // Verify follow persisted
    console.log('🔍 Verifying follow persisted...');
    const statusResponse = await axios.get(
      `${API_URL}/api/users/${user2Id}/follow-status`,
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Follow status:', statusResponse.data);
    
    if (statusResponse.data.isFollowing) {
      console.log('✅ FOLLOW PERSISTED CORRECTLY!');
    } else {
      console.log('❌ FOLLOW NOT PERSISTED!');
    }
    
    // Unfollow
    console.log('👋 Unfollowing user...');
    const unfollowResponse = await axios.post(
      `${API_URL}/api/users/${user2Id}/follow`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    console.log('✅ Unfollow response:', {
      isFollowing: unfollowResponse.data.isFollowing,
      followerCount: unfollowResponse.data.followerCount
    });
    
  } catch (error) {
    console.error('❌ Follow test failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Like & Follow Persistence Tests...\n');
  console.log(`📡 API URL: ${API_URL}\n`);
  
  // Login both users
  console.log('🔐 Logging in test users...');
  const user1Auth = await login(testUser1.email, testUser1.password);
  const user2Auth = await login(testUser2.email, testUser2.password);
  
  if (!user1Auth || !user2Auth) {
    console.error('❌ Failed to login test users');
    return;
  }
  
  user1Token = user1Auth.token;
  user1Id = user1Auth.userId;
  user2Token = user2Auth.token;
  user2Id = user2Auth.userId;
  
  console.log('✅ Logged in successfully');
  console.log(`   User 1 ID: ${user1Id}`);
  console.log(`   User 2 ID: ${user2Id}`);
  
  // Run tests
  await testPostLike();
  await testReelLike();
  await testFollow();
  
  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);

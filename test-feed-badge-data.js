// Test feed endpoint to check badge data
const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

async function testFeedBadgeData() {
  try {
    console.log('🔐 Logging in as Its.harvinder.05...');
    
    // Login
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'Its.harvinder.05',
      password: 'abc123'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful\n');
    
    // Fetch feed
    console.log('📊 Fetching feed...');
    const feedRes = await axios.get(`${API_URL}/api/feed?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const posts = feedRes.data.data || feedRes.data.posts || [];
    console.log(`✅ Found ${posts.length} posts\n`);
    
    // Check each post's user data
    posts.forEach((post, index) => {
      console.log(`\n📝 Post ${index + 1}:`);
      console.log('  Post ID:', post.id);
      console.log('  User:', post.user.username);
      console.log('  is_verified:', post.user.is_verified);
      console.log('  verified:', post.user.verified);
      console.log('  badge_type:', post.user.badge_type);
      console.log('  badgeType:', post.user.badgeType);
      console.log('  avatar_url:', post.user.avatar_url ? 'YES' : 'NO');
      
      // Check if badge should show
      const shouldShowBadge = (post.user.is_verified || post.user.verified) && 
                              (post.user.badge_type || post.user.badgeType);
      console.log('  🎖️ Should show badge:', shouldShowBadge ? 'YES ✅' : 'NO ❌');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFeedBadgeData();

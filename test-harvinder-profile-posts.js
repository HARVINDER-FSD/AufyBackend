const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'https://socialmediabackendfinalss.onrender.com';

async function testHarvinderProfilePosts() {
  try {
    console.log('═══════════════════════════════════════════');
    console.log('   TEST HARVINDER PROFILE POSTS ENDPOINT');
    console.log('═══════════════════════════════════════════\n');

    // First, login to get token
    console.log('Step 1: Logging in as Harvinder...\n');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Test the profile posts endpoint
    console.log('Step 2: Fetching Harvinder\'s profile posts...\n');
    console.log(`Endpoint: GET ${API_URL}/api/users/Its.harvinder.05/posts`);
    console.log(`Authorization: Bearer ${token.substring(0, 20)}...\n`);

    const postsResponse = await axios.get(
      `${API_URL}/api/users/Its.harvinder.05/posts`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Response Status:', postsResponse.status);
    console.log('Response Data:', JSON.stringify(postsResponse.data, null, 2));

    const posts = postsResponse.data.posts || postsResponse.data.data || [];
    
    console.log('\n═══════════════════════════════════════════');
    console.log('   RESULTS');
    console.log('═══════════════════════════════════════════\n');

    console.log(`Total posts returned: ${posts.length}`);
    console.log(`Expected: 0 (Harvinder has no posts)`);
    
    if (posts.length === 0) {
      console.log('\n✅ TEST PASSED!');
      console.log('   Profile endpoint returns ONLY user\'s own posts');
      console.log('   No posts from followed users (Krina)');
    } else {
      console.log('\n❌ TEST FAILED!');
      console.log('   Posts found:');
      posts.forEach((post, i) => {
        console.log(`   ${i + 1}. By: @${post.user?.username || 'unknown'}`);
        console.log(`      Caption: ${post.content || post.caption || 'No caption'}`);
      });
    }

    // Also test Krina's profile
    console.log('\n═══════════════════════════════════════════');
    console.log('   TEST KRINA PROFILE POSTS');
    console.log('═══════════════════════════════════════════\n');

    const krinaPostsResponse = await axios.get(
      `${API_URL}/api/users/krinaprajapati24/posts`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const krinaPosts = krinaPostsResponse.data.posts || krinaPostsResponse.data.data || [];
    
    console.log(`Total posts returned: ${krinaPosts.length}`);
    console.log(`Expected: 1 (Krina has 1 post)`);
    
    if (krinaPosts.length === 1) {
      console.log('\n✅ TEST PASSED!');
      console.log('   Krina\'s profile shows her 1 post');
    } else {
      console.log('\n❌ TEST FAILED!');
      console.log(`   Expected 1 post, got ${krinaPosts.length}`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
  }
}

testHarvinderProfilePosts();

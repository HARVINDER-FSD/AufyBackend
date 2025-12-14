const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

async function testInstantLike() {
  console.log('🧪 Testing Instant Like Functionality\n');

  try {
    // 1. Login
    console.log('1️⃣ Logging in...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'monu@gmail.com',
      password: 'Monu@123'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Logged in successfully\n');

    // 2. Get feed to find a post
    console.log('2️⃣ Getting feed...');
    const feedRes = await axios.get(`${API_URL}/api/feed`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const posts = feedRes.data.posts;
    if (!posts || posts.length === 0) {
      console.log('❌ No posts found in feed');
      return;
    }
    
    const testPost = posts[0];
    console.log(`✅ Found post: ${testPost.id}`);
    console.log(`   Initial state: liked=${testPost.liked}, likes=${testPost.likes}\n`);

    // 3. Test rapid like/unlike (simulating user clicking fast)
    console.log('3️⃣ Testing rapid like/unlike...\n');
    
    // First like
    console.log('   👆 Like #1...');
    const start1 = Date.now();
    const like1 = await axios.post(`${API_URL}/api/posts/${testPost.id}/like`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const time1 = Date.now() - start1;
    console.log(`   ✅ Response in ${time1}ms: liked=${like1.data.liked}, count=${like1.data.likeCount}`);

    // Wait 600ms (simulating user clicking again)
    await new Promise(resolve => setTimeout(resolve, 600));

    // Second click (unlike)
    console.log('\n   👆 Unlike...');
    const start2 = Date.now();
    const like2 = await axios.post(`${API_URL}/api/posts/${testPost.id}/like`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const time2 = Date.now() - start2;
    console.log(`   ✅ Response in ${time2}ms: liked=${like2.data.liked}, count=${like2.data.likeCount}`);

    // Wait 600ms
    await new Promise(resolve => setTimeout(resolve, 600));

    // Third click (like again)
    console.log('\n   👆 Like #2...');
    const start3 = Date.now();
    const like3 = await axios.post(`${API_URL}/api/posts/${testPost.id}/like`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const time3 = Date.now() - start3;
    console.log(`   ✅ Response in ${time3}ms: liked=${like3.data.liked}, count=${like3.data.likeCount}`);

    // 4. Verify final state
    console.log('\n4️⃣ Verifying final state...');
    const finalFeed = await axios.get(`${API_URL}/api/feed`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const finalPost = finalFeed.data.posts.find(p => p.id === testPost.id);
    console.log(`   Final state: liked=${finalPost.liked}, likes=${finalPost.likes}`);

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Average response time: ${Math.round((time1 + time2 + time3) / 3)}ms`);
    console.log(`   Like toggle working: ${like1.data.liked !== like2.data.liked ? '✅' : '❌'}`);
    console.log(`   State consistency: ${like3.data.liked === finalPost.liked ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testInstantLike();

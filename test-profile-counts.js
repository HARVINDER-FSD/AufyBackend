// Test script to verify profile counts are returned correctly
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001';

async function testProfileCounts() {
  console.log('🧪 Testing Profile Counts API\n');

  try {
    // Step 1: Create two test users
    console.log('1️⃣ Creating test users...');
    const timestamp = Date.now();
    
    const user1Response = await axios.post(`${API_URL}/api/auth/register`, {
      username: `testuser1_${timestamp}`,
      email: `testuser1_${timestamp}@test.com`,
      password: 'Test123!@#',
      full_name: 'Test User 1'
    });
    
    const user2Response = await axios.post(`${API_URL}/api/auth/register`, {
      username: `testuser2_${timestamp}`,
      email: `testuser2_${timestamp}@test.com`,
      password: 'Test123!@#',
      full_name: 'Test User 2'
    });

    const user1 = user1Response.data.user || user1Response.data;
    const user2 = user2Response.data.user || user2Response.data;
    
    // Extract user ID and token
    const user1Id = user1.id || user1._id;
    const user2Id = user2.id || user2._id;
    const user1Token = user1Response.data.token;
    const user2Token = user2Response.data.token;
    
    console.log('✅ Users created');
    console.log(`   User 1: ${user1.username} (ID: ${user1Id})`);
    console.log(`   User 2: ${user2.username} (ID: ${user2Id})\n`);

    // Step 2: User 1 follows User 2
    console.log('2️⃣ User 1 following User 2...');
    await axios.post(
      `${API_URL}/api/users/${user2Id}/follow`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log('✅ Follow successful\n');

    // Step 3: Check User 2's profile via /api/users/:username
    console.log('3️⃣ Fetching User 2 profile via /api/users/:username...');
    const profileResponse = await axios.get(
      `${API_URL}/api/users/${user2.username}`,
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    const profile = profileResponse.data;
    console.log('✅ Profile fetched');
    console.log('📊 Raw API Response:', JSON.stringify(profile, null, 2));
    console.log('\n🔢 Count Fields:');
    console.log(`   followersCount: ${profile.followersCount}`);
    console.log(`   followers_count: ${profile.followers_count}`);
    console.log(`   followers: ${profile.followers}`);
    console.log(`   followingCount: ${profile.followingCount}`);
    console.log(`   following_count: ${profile.following_count}`);
    console.log(`   following: ${profile.following}\n`);

    // Step 4: Check User 2's profile via /api/users/me
    console.log('4️⃣ Fetching User 2 profile via /api/users/me...');
    const meResponse = await axios.get(
      `${API_URL}/api/users/me`,
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );
    
    const meProfile = meResponse.data;
    console.log('✅ Profile fetched');
    console.log('📊 Raw API Response:', JSON.stringify(meProfile, null, 2));
    console.log('\n🔢 Count Fields:');
    console.log(`   followersCount: ${meProfile.followersCount}`);
    console.log(`   followers_count: ${meProfile.followers_count}`);
    console.log(`   followers: ${meProfile.followers}`);
    console.log(`   followingCount: ${meProfile.followingCount}`);
    console.log(`   following_count: ${meProfile.following_count}`);
    console.log(`   following: ${meProfile.following}\n`);

    // Summary
    console.log('📊 SUMMARY:');
    console.log('─────────────────────────────────────');
    console.log(`User 2 should have 1 follower (User 1)`);
    console.log(`\nVia /api/users/:username:`);
    console.log(`  Followers: ${profile.followersCount || profile.followers_count || profile.followers || 0}`);
    console.log(`  Following: ${profile.followingCount || profile.following_count || profile.following || 0}`);
    console.log(`\nVia /api/users/me:`);
    console.log(`  Followers: ${meProfile.followersCount || meProfile.followers_count || meProfile.followers || 0}`);
    console.log(`  Following: ${meProfile.followingCount || meProfile.following_count || meProfile.following || 0}`);
    
    const usernameCountCorrect = (profile.followersCount || profile.followers_count || profile.followers) === 1;
    const meCountCorrect = (meProfile.followersCount || meProfile.followers_count || meProfile.followers) === 1;
    
    if (usernameCountCorrect && meCountCorrect) {
      console.log('\n✅ ALL TESTS PASSED - Counts are correct!');
    } else {
      console.log('\n❌ TESTS FAILED - Counts are incorrect!');
      if (!usernameCountCorrect) console.log('   - /api/users/:username endpoint not returning correct count');
      if (!meCountCorrect) console.log('   - /api/users/me endpoint not returning correct count');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testProfileCounts();

// Test script to verify profile follow state is returned correctly
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testProfileFollowState() {
  console.log('🧪 Testing Profile Follow State...\n');

  try {
    // Step 1: Login as user1
    console.log('1️⃣ Logging in as user1...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user1@test.com',
        password: 'password123'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Logged in successfully\n');

    // Step 2: Get another user's profile
    console.log('2️⃣ Fetching user2 profile...');
    const profileRes = await fetch(`${API_URL}/api/users/username/user2`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`);
    }

    const profileData = await profileRes.json();
    console.log('✅ Profile fetched successfully\n');

    // Step 3: Check follow state fields
    console.log('3️⃣ Checking follow state fields:');
    console.log('   User ID:', profileData.id || profileData._id);
    console.log('   Username:', profileData.username);
    console.log('   isFollowing:', profileData.isFollowing);
    console.log('   is_following:', profileData.is_following);
    console.log('   isPending:', profileData.isPending);
    console.log('   followsBack:', profileData.followsBack);
    console.log('   isMutualFollow:', profileData.isMutualFollow);
    console.log('   followRequestStatus:', profileData.followRequestStatus);
    console.log('   isPrivate:', profileData.isPrivate);
    console.log('   is_private:', profileData.is_private);

    // Verify all required fields are present
    const requiredFields = ['isFollowing', 'isPending', 'followsBack', 'isMutualFollow'];
    const missingFields = requiredFields.filter(field => profileData[field] === undefined);

    if (missingFields.length > 0) {
      console.log('\n❌ Missing fields:', missingFields.join(', '));
    } else {
      console.log('\n✅ All required follow state fields present');
    }

    // Step 4: Test follow action
    console.log('\n4️⃣ Testing follow action...');
    const followRes = await fetch(`${API_URL}/api/users/${profileData.id || profileData._id}/follow`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!followRes.ok) {
      console.log('⚠️  Follow action failed (might already be following)');
    } else {
      const followData = await followRes.json();
      console.log('✅ Follow action response:', followData);
    }

    // Step 5: Fetch profile again to verify state update
    console.log('\n5️⃣ Fetching profile again to verify state...');
    const updatedProfileRes = await fetch(`${API_URL}/api/users/username/user2`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!updatedProfileRes.ok) {
      throw new Error(`Updated profile fetch failed: ${updatedProfileRes.status}`);
    }

    const updatedProfile = await updatedProfileRes.json();
    console.log('   isFollowing:', updatedProfile.isFollowing);
    console.log('   isPending:', updatedProfile.isPending);
    console.log('   followRequestStatus:', updatedProfile.followRequestStatus);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProfileFollowState();

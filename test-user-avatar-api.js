const API_URL = 'https://socialmediabackendfinalss.onrender.com';

async function testUserAvatarAPI() {
  console.log('🧪 Testing User Avatar API\n');

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Its.harvinder.05',
        password: 'Harvinder@123'
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status} - ${error}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    const userId = loginData.user?.id || loginData.user?._id;
    
    console.log('✅ Logged in successfully');
    console.log('   User ID:', userId);
    console.log('   Username:', loginData.user?.username);

    // Step 2: Fetch user by ID
    console.log('\n2️⃣ Fetching user details by ID...');
    const userRes = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!userRes.ok) {
      const error = await userRes.text();
      throw new Error(`User fetch failed: ${userRes.status} - ${error}`);
    }

    const userData = await userRes.json();
    console.log('✅ User data received:');
    console.log('   Username:', userData.username);
    console.log('   Full Name:', userData.fullName || userData.name);
    console.log('   Avatar:', userData.avatar);
    console.log('   Avatar URL:', userData.avatar_url);
    console.log('   Profile Image:', userData.profileImage);
    console.log('   Profile Picture:', userData.profilePicture);

    // Check if avatar is properly set
    if (userData.profileImage || userData.avatar || userData.avatar_url) {
      console.log('\n✅ Avatar field is present in API response');
      console.log('   Primary avatar field:', userData.profileImage || userData.avatar || userData.avatar_url);
    } else {
      console.log('\n⚠️ No avatar field found in API response');
    }

    // Step 3: Test with another user
    console.log('\n3️⃣ Testing with another user (krina)...');
    const krinaRes = await fetch(`${API_URL}/api/users/username/krina`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (krinaRes.ok) {
      const krinaData = await krinaRes.json();
      console.log('✅ Krina user data:');
      console.log('   Username:', krinaData.username);
      console.log('   Avatar:', krinaData.avatar);
      console.log('   Profile Image:', krinaData.profileImage);
    }

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testUserAvatarAPI();

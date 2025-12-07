const API_URL = 'https://socialmediabackendfinalss.onrender.com';

async function testKrinaAPI() {
  console.log('🧪 Testing Krina User API\n');

  try {
    // Step 1: Login as harvinder
    console.log('1️⃣ Logging in as harvinder...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Its.harvinder.05',
        password: 'Harvinder@123'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Logged in successfully\n');

    // Step 2: Fetch Krina by username
    console.log('2️⃣ Fetching Krina by username...');
    const krinaByUsernameRes = await fetch(`${API_URL}/api/users/username/krinaprajapati24`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (krinaByUsernameRes.ok) {
      const krinaData = await krinaByUsernameRes.json();
      console.log('✅ Krina data (by username):');
      console.log('   Username:', krinaData.username);
      console.log('   Full Name:', krinaData.fullName || krinaData.full_name);
      console.log('   Avatar:', krinaData.avatar);
      console.log('   Avatar URL:', krinaData.avatar_url);
      console.log('   Profile Image:', krinaData.profileImage);
      console.log('   ID:', krinaData._id || krinaData.id);
      
      // Step 3: Fetch Krina by ID
      const krinaId = krinaData._id || krinaData.id;
      console.log('\n3️⃣ Fetching Krina by ID:', krinaId);
      const krinaByIdRes = await fetch(`${API_URL}/api/users/${krinaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (krinaByIdRes.ok) {
        const krinaByIdData = await krinaByIdRes.json();
        console.log('✅ Krina data (by ID):');
        console.log('   Username:', krinaByIdData.username);
        console.log('   Full Name:', krinaByIdData.fullName || krinaByIdData.full_name);
        console.log('   Avatar:', krinaByIdData.avatar);
        console.log('   Avatar URL:', krinaByIdData.avatar_url);
        console.log('   Profile Image:', krinaByIdData.profileImage);
        console.log('   Profile Picture:', krinaByIdData.profilePicture);
      } else {
        console.log('❌ Failed to fetch by ID:', krinaByIdRes.status);
      }
    } else {
      console.log('❌ Failed to fetch by username:', krinaByUsernameRes.status);
    }

    // Step 4: Search for Krina
    console.log('\n4️⃣ Searching for "krina"...');
    const searchRes = await fetch(`${API_URL}/api/search?q=krina`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      console.log('✅ Search results:', searchData.users?.length || 0, 'users');
      if (searchData.users && searchData.users.length > 0) {
        const krinaInSearch = searchData.users.find(u => u.username === 'krinaprajapati24');
        if (krinaInSearch) {
          console.log('   Found Krina in search:');
          console.log('   Avatar:', krinaInSearch.avatar || krinaInSearch.avatar_url || krinaInSearch.profileImage);
        }
      }
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testKrinaAPI();

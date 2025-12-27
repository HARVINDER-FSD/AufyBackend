const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

async function testBackendVersion() {
    console.log('🔍 Checking backend version...\n');

    try {
        // Test the health endpoint
        const health = await axios.get(`${API_URL}/health`);
        console.log('Health:', health.data);

        // Test a follow query to see if it uses snake_case
        const email = 'hs8339952@gmail.com';
        const password = 'abc123';

        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email,
            password
        });
        const token = loginRes.data.token;

        // Get profile to see counts
        const profile = await axios.get(`${API_URL}/api/users/username/its_harshit_01`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('\nProfile data:');
        console.log('  - followers_count:', profile.data.followers_count);
        console.log('  - following_count:', profile.data.following_count);
        console.log('  - followersCount:', profile.data.followersCount);
        console.log('  - followingCount:', profile.data.followingCount);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testBackendVersion();

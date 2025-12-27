const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

// Test credentials
const email = 'hs8339952@gmail.com';
const password = 'abc123';

// User IDs
const currentUserId = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05
const targetUserId = '6939885e3dea6231c93fcdaa'; // its_harshit_01

async function testFollowCountsUpdate() {
    console.log('🧪 Testing Follow Counts Update\n');

    try {
        // 1. Login
        console.log('1️⃣ Logging in...');
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email,
            password
        });
        const token = loginRes.data.token;
        console.log('✅ Logged in successfully\n');

        // 2. Get initial profile counts
        console.log('2️⃣ Getting initial profile counts...');
        const initialProfile = await axios.get(`${API_URL}/api/users/username/its_harshit_01`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Target user (its_harshit_01):`);
        console.log(`  - Followers: ${initialProfile.data.followers_count}`);
        console.log(`  - Following: ${initialProfile.data.following_count}\n`);

        const myInitialProfile = await axios.get(`${API_URL}/api/users/username/Its.harvinder.05`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Current user (Its.harvinder.05):`);
        console.log(`  - Followers: ${myInitialProfile.data.followers_count}`);
        console.log(`  - Following: ${myInitialProfile.data.following_count}\n`);

        // 3. Follow the user
        console.log('3️⃣ Following user...');
        const followRes = await axios.post(`${API_URL}/api/users/${targetUserId}/follow`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Follow response:`, followRes.data);
        console.log(`  - isFollowing: ${followRes.data.isFollowing}`);
        console.log(`  - followerCount: ${followRes.data.followerCount}\n`);

        // 4. Get updated profile counts
        console.log('4️⃣ Getting updated profile counts...');
        const updatedProfile = await axios.get(`${API_URL}/api/users/username/its_harshit_01`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Target user (its_harshit_01) after follow:`);
        console.log(`  - Followers: ${updatedProfile.data.followers_count} (was ${initialProfile.data.followers_count})`);
        console.log(`  - Following: ${updatedProfile.data.following_count}\n`);

        const myUpdatedProfile = await axios.get(`${API_URL}/api/users/username/Its.harvinder.05`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Current user (Its.harvinder.05) after follow:`);
        console.log(`  - Followers: ${myUpdatedProfile.data.followers_count}`);
        console.log(`  - Following: ${myUpdatedProfile.data.following_count} (was ${myInitialProfile.data.following_count})\n`);

        // 5. Verify counts increased
        if (updatedProfile.data.followers_count > initialProfile.data.followers_count) {
            console.log('✅ Target user follower count increased!');
        } else {
            console.log('❌ Target user follower count did NOT increase');
        }

        if (myUpdatedProfile.data.following_count > myInitialProfile.data.following_count) {
            console.log('✅ Current user following count increased!');
        } else {
            console.log('❌ Current user following count did NOT increase');
        }

        console.log('\n✅ Test completed!');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testFollowCountsUpdate();

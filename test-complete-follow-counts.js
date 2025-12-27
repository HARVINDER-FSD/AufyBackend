const axios = require('axios');

const API_URL = 'https://aufybackend.onrender.com';

// Test credentials
const email = 'hs8339952@gmail.com';
const password = 'abc123';

async function testCompleteFollowCounts() {
    console.log('🧪 Complete Follow Counts Test\n');
    console.log('=' .repeat(60));

    try {
        // 1. Login
        console.log('\n1️⃣ Logging in...');
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email,
            password
        });
        const token = loginRes.data.token;
        console.log('✅ Logged in successfully');

        // 2. Get initial state
        console.log('\n2️⃣ Getting initial profile states...');
        const harvinder = await axios.get(`${API_URL}/api/users/username/Its.harvinder.05`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const harshit = await axios.get(`${API_URL}/api/users/username/its_harshit_01`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('\n📊 Initial State:');
        console.log('  Its.harvinder.05:');
        console.log(`    - Followers: ${harvinder.data.followers_count}`);
        console.log(`    - Following: ${harvinder.data.following_count}`);
        console.log(`    - Is following harshit: ${harvinder.data.isFollowing || 'N/A'}`);
        
        console.log('\n  its_harshit_01:');
        console.log(`    - Followers: ${harshit.data.followers_count}`);
        console.log(`    - Following: ${harshit.data.following_count}`);
        console.log(`    - Is following: ${harshit.data.isFollowing}`);

        // 3. Toggle follow
        console.log('\n3️⃣ Toggling follow state...');
        const followRes = await axios.post(
            `${API_URL}/api/users/${harshit.data._id}/follow`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log(`\n✅ Follow action: ${followRes.data.message}`);
        console.log(`  - isFollowing: ${followRes.data.isFollowing}`);
        console.log(`  - followerCount: ${followRes.data.followerCount}`);

        // 4. Get updated state
        console.log('\n4️⃣ Getting updated profile states...');
        const harvinderAfter = await axios.get(`${API_URL}/api/users/username/Its.harvinder.05`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const harshitAfter = await axios.get(`${API_URL}/api/users/username/its_harshit_01`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('\n📊 Updated State:');
        console.log('  Its.harvinder.05:');
        console.log(`    - Followers: ${harvinderAfter.data.followers_count} (was ${harvinder.data.followers_count})`);
        console.log(`    - Following: ${harvinderAfter.data.following_count} (was ${harvinder.data.following_count})`);
        
        console.log('\n  its_harshit_01:');
        console.log(`    - Followers: ${harshitAfter.data.followers_count} (was ${harshit.data.followers_count})`);
        console.log(`    - Following: ${harshitAfter.data.following_count} (was ${harshit.data.following_count})`);
        console.log(`    - Is following: ${harshitAfter.data.isFollowing}`);

        // 5. Verify changes
        console.log('\n5️⃣ Verification:');
        console.log('=' .repeat(60));
        
        if (followRes.data.isFollowing) {
            // We followed
            const harvinderFollowingIncreased = harvinderAfter.data.following_count > harvinder.data.following_count;
            const harshitFollowersIncreased = harshitAfter.data.followers_count > harshit.data.followers_count;
            
            console.log(`\n✅ Action: FOLLOWED`);
            console.log(`  ${harvinderFollowingIncreased ? '✅' : '❌'} Harvinder's following count increased`);
            console.log(`  ${harshitFollowersIncreased ? '✅' : '❌'} Harshit's followers count increased`);
            
            if (harvinderFollowingIncreased && harshitFollowersIncreased) {
                console.log('\n🎉 SUCCESS! Follow counts are updating correctly!');
            } else {
                console.log('\n❌ FAILED! Counts did not update properly');
            }
        } else {
            // We unfollowed
            const harvinderFollowingDecreased = harvinderAfter.data.following_count < harvinder.data.following_count;
            const harshitFollowersDecreased = harshitAfter.data.followers_count < harshit.data.followers_count;
            
            console.log(`\n✅ Action: UNFOLLOWED`);
            console.log(`  ${harvinderFollowingDecreased ? '✅' : '❌'} Harvinder's following count decreased`);
            console.log(`  ${harshitFollowersDecreased ? '✅' : '❌'} Harshit's followers count decreased`);
            
            if (harvinderFollowingDecreased && harshitFollowersDecreased) {
                console.log('\n🎉 SUCCESS! Unfollow counts are updating correctly!');
            } else {
                console.log('\n❌ FAILED! Counts did not update properly');
            }
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        if (error.response?.status === 503) {
            console.log('\n⏳ Backend is waking up from sleep. Please wait 30 seconds and try again.');
        }
    }
}

testCompleteFollowCounts();

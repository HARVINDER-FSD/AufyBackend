const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testAvatarInMessages() {
    console.log('🧪 Testing Avatar Display in Messages\n');
    
    // Test credentials
    const testUser = {
        username: 'Its.harvinder.05',
        password: 'abc123'
    };
    
    try {
        // 1. Login
        console.log('1️⃣ Logging in as:', testUser.username);
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status}`);
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        const userId = loginData.user.id || loginData.user._id;
        
        console.log('✅ Logged in successfully');
        console.log('   User ID:', userId);
        console.log('   Token:', token.substring(0, 20) + '...\n');
        
        // 2. Get mutual followers
        console.log('2️⃣ Fetching mutual followers...');
        const mutualRes = await fetch(`${API_URL}/api/users/${userId}/mutual-followers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (mutualRes.ok) {
            const mutualData = await mutualRes.json();
            const followers = mutualData.data || mutualData || [];
            
            console.log(`✅ Found ${followers.length} mutual followers\n`);
            
            if (followers.length > 0) {
                console.log('📋 Mutual Followers Avatar Check:');
                followers.forEach((follower, index) => {
                    console.log(`   ${index + 1}. ${follower.username}`);
                    console.log(`      - Full Name: ${follower.fullName || 'N/A'}`);
                    console.log(`      - Profile Image: ${follower.profileImage ? '✅ Present' : '❌ Missing'}`);
                    if (follower.profileImage) {
                        console.log(`      - URL: ${follower.profileImage}`);
                    }
                    console.log('');
                });
            }
        } else {
            console.log('⚠️ Could not fetch mutual followers:', mutualRes.status);
        }
        
        // 3. Test fetching a specific user by ID
        console.log('3️⃣ Testing user fetch by ID...');
        
        // Get a user ID to test (use first mutual follower if available)
        const mutualData = await mutualRes.json();
        const followers = mutualData.data || mutualData || [];
        
        if (followers.length > 0) {
            const testUserId = followers[0]._id;
            console.log(`   Testing with user ID: ${testUserId}`);
            
            const userRes = await fetch(`${API_URL}/api/users/${testUserId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (userRes.ok) {
                const userData = await userRes.json();
                const user = userData.data || userData.user || userData;
                
                console.log('✅ User data fetched successfully');
                console.log('   Username:', user.username);
                console.log('   Full Name:', user.fullName || user.name || 'N/A');
                console.log('   Avatar Fields:');
                console.log('      - avatar:', user.avatar ? '✅' : '❌');
                console.log('      - avatar_url:', user.avatar_url ? '✅' : '❌');
                console.log('      - profileImage:', user.profileImage ? '✅' : '❌');
                console.log('      - profile_picture:', user.profile_picture ? '✅' : '❌');
                
                if (user.avatar || user.avatar_url || user.profileImage) {
                    console.log('   Avatar URL:', user.avatar || user.avatar_url || user.profileImage);
                }
            } else {
                console.log('❌ Failed to fetch user:', userRes.status);
            }
        }
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    }
}

testAvatarInMessages();

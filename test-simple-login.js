const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testLogin() {
    console.log('🧪 Testing Simple Login\n');
    
    const users = [
        { email: 'hs8339952@gmail.com', password: 'abc123', username: 'Its.harvinder.05' },
        { email: 'krinaprajapati80@gmail.com', password: 'abc123', username: 'krinaprajapati24' },
        { email: 'sddohare0207@gmail.com', password: 'abc123', username: 'its_monu_0207' },
        { email: 'gstecht7@gmail.com', password: 'abc123', username: 'gs_techt' }
    ];
    
    for (const user of users) {
        console.log(`Testing: ${user.username} (${user.email})`);
        
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: user.password })
            });
            
            const text = await response.text();
            console.log(`  Status: ${response.status}`);
            
            if (response.ok) {
                const data = JSON.parse(text);
                console.log(`  ✅ Login successful!`);
                console.log(`  Token: ${data.token?.substring(0, 20)}...`);
                console.log(`  User ID: ${data.user?.id || data.user?._id}`);
                
                // Test fetching user details
                const userId = data.user?.id || data.user?._id;
                const userRes = await fetch(`${API_URL}/api/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${data.token}` }
                });
                
                if (userRes.ok) {
                    const userData = await userRes.json();
                    const u = userData.data || userData.user || userData;
                    console.log(`  Avatar fields:`);
                    console.log(`    - avatar: ${u.avatar ? '✅' : '❌'} ${u.avatar || ''}`);
                    console.log(`    - avatar_url: ${u.avatar_url ? '✅' : '❌'}`);
                    console.log(`    - profileImage: ${u.profileImage ? '✅' : '❌'}`);
                }
                
                break; // Stop after first successful login
            } else {
                console.log(`  ❌ Failed: ${text.substring(0, 100)}`);
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
        
        console.log('');
    }
}

testLogin();

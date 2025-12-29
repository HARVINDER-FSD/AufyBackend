// Register the its.harvinder.05 user if needed
const fetch = require('node-fetch');

const API_BASE = 'https://aufybackend.onrender.com';

async function registerHarvinderUser() {
  console.log('📝 Registering its.harvinder.05 User');
  console.log('====================================');
  
  try {
    const userData = {
      username: 'its.harvinder.05',
      email: 'harvinder05@example.com', // You can change this
      password: 'password123', // You can change this
      name: 'Harvinder Singh'
    };
    
    console.log('📋 Attempting to register user:', userData.username);
    
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });
    
    console.log('Status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ User registered successfully!');
      console.log('User ID:', result.user?.id || result.id);
      console.log('Username:', result.user?.username || result.username);
      console.log('');
      console.log('🔑 Login Credentials:');
      console.log('Username:', userData.username);
      console.log('Password:', userData.password);
      console.log('');
      console.log('📱 Next Steps:');
      console.log('1. Open the mobile app');
      console.log('2. Logout if currently logged in');
      console.log('3. Login with the above credentials');
      console.log('4. Check your profile - should now show 0 reels (correct)');
    } else {
      const error = await response.text();
      console.log('❌ Registration failed:', error);
      
      if (response.status === 400 && error.includes('already exists')) {
        console.log('✅ User already exists! You can login with:');
        console.log('Username:', userData.username);
        console.log('Password: (use your existing password)');
      }
    }
    
    console.log('\n🏁 Registration Complete');
    console.log('========================');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the registration
registerHarvinderUser();
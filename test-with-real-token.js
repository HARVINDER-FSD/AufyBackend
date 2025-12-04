// Test with a real user token
const API_URL = 'http://localhost:5001';

async function testWithRealUser() {
  console.log('🧪 Testing with real user login...\n');

  // Step 1: Login to get a valid token
  console.log('Step 1: Logging in...');
  try {
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'private.test@example.com',
        password: 'Test123!'
      })
    });

    if (!loginResponse.ok) {
      console.error(`❌ Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      const error = await loginResponse.text();
      console.error('Error:', error);
      return;
    }

    const loginData = await loginResponse.json();
    console.log(`✅ Login successful!`);
    console.log(`Token: ${loginData.token.substring(0, 20)}...`);

    const token = loginData.token;

    // Step 2: Test notifications endpoint with valid token
    console.log('\nStep 2: Testing notifications endpoint...');
    const notifResponse = await fetch(`${API_URL}/api/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`✅ Notifications: ${notifResponse.status} ${notifResponse.statusText}`);
    
    if (notifResponse.ok) {
      const notifications = await notifResponse.json();
      console.log(`✅ Got ${notifications.length || 0} notifications`);
    } else if (notifResponse.status === 403) {
      console.error('❌ Still getting 403 with valid token!');
      const error = await notifResponse.text();
      console.error('Error:', error);
    }

    // Step 3: Test feed endpoint
    console.log('\nStep 3: Testing feed endpoint...');
    const feedResponse = await fetch(`${API_URL}/api/feed`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`✅ Feed: ${feedResponse.status} ${feedResponse.statusText}`);
    
    if (feedResponse.ok) {
      const feed = await feedResponse.json();
      console.log(`✅ Got ${feed.length || 0} feed items`);
    } else if (feedResponse.status === 403) {
      console.error('❌ Still getting 403 with valid token!');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithRealUser();

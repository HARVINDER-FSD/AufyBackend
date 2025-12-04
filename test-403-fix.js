// Test that 403 errors are fixed
const API_URL = 'http://localhost:5001';

async function testEndpoints() {
  console.log('🧪 Testing API endpoints for 403 errors...\n');

  // Test 1: Health check (no auth)
  try {
    const response = await fetch(`${API_URL}/health`);
    console.log(`✅ Health check: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`❌ Health check failed:`, error.message);
  }

  // Test 2: Notifications endpoint (with fake token - should get 401, not 403)
  try {
    const response = await fetch(`${API_URL}/api/notifications`, {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      }
    });
    console.log(`✅ Notifications endpoint: ${response.status} ${response.statusText}`);
    if (response.status === 403) {
      console.error('❌ Still getting 403! Security middleware is blocking requests.');
    } else if (response.status === 401) {
      console.log('✅ Got 401 (Unauthorized) - this is correct! Token validation working.');
    }
  } catch (error) {
    console.error(`❌ Notifications test failed:`, error.message);
  }

  // Test 3: Feed endpoint
  try {
    const response = await fetch(`${API_URL}/api/feed`, {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      }
    });
    console.log(`✅ Feed endpoint: ${response.status} ${response.statusText}`);
    if (response.status === 403) {
      console.error('❌ Still getting 403!');
    }
  } catch (error) {
    console.error(`❌ Feed test failed:`, error.message);
  }

  // Test 4: Login endpoint (no auth needed)
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      })
    });
    console.log(`✅ Login endpoint: ${response.status} ${response.statusText}`);
    if (response.status === 403) {
      console.error('❌ Login getting 403! Security middleware too strict.');
    }
  } catch (error) {
    console.error(`❌ Login test failed:`, error.message);
  }

  console.log('\n✅ All tests completed!');
  console.log('If you see any 403 errors above, the security middleware needs more adjustments.');
}

testEndpoints();

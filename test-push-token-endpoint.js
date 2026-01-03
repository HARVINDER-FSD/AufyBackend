// Test push-token endpoint
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testPushTokenEndpoint() {
    try {
        console.log('🔍 Testing push-token endpoint...');
        
        // Test without auth (should get 401)
        const response = await fetch(`${API_URL}/api/users/push-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: 'test-token',
                platform: 'ios'
            })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        const responseText = await response.text();
        console.log('📡 Response:', responseText);
        
        if (response.status === 401) {
            console.log('✅ Endpoint exists and requires authentication (expected)');
        } else if (response.status === 404) {
            console.log('❌ Endpoint not found - needs deployment');
        } else {
            console.log('🤔 Unexpected response');
        }
        
    } catch (error) {
        console.error('❌ Error testing endpoint:', error.message);
    }
}

testPushTokenEndpoint();
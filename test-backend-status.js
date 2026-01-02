const fetch = require('node-fetch');

async function testBackendStatus() {
    try {
        const API_URL = 'https://aufybackend.onrender.com';
        
        console.log('🔍 Testing backend status...');
        console.log('🌐 Backend URL:', API_URL);
        
        // Test basic connectivity
        const response = await fetch(API_URL, {
            method: 'GET',
            timeout: 10000
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (response.ok) {
            const text = await response.text();
            console.log('📄 Response:', text.substring(0, 200) + '...');
        }
        
        // Test auth endpoint
        console.log('\n🔐 Testing auth endpoint...');
        const authResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'test@test.com',
                password: 'test'
            }),
        });
        
        console.log('🔐 Auth endpoint status:', authResponse.status);
        const authText = await authResponse.text();
        console.log('🔐 Auth response:', authText);
        
    } catch (error) {
        console.error('❌ Backend test failed:', error.message);
    }
}

testBackendStatus();
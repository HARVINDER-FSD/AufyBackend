const fetch = require('node-fetch');

async function debugLogin() {
    try {
        const API_URL = 'https://aufybackend.onrender.com';
        
        console.log('🔐 Testing login with your credentials...');
        
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'hs8339952@gmail.com',
                password: 'abc123'
            }),
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('✅ Login successful!');
            console.log('Token preview:', data.token?.substring(0, 20) + '...');
        }
        
    } catch (error) {
        console.error('❌ Login test failed:', error.message);
    }
}

debugLogin();
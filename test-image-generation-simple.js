const fetch = require('node-fetch');

// Test image generation endpoint
async function testImageGeneration() {
    try {
        console.log('🎨 Testing image generation...');
        
        const API_URL = 'https://socialmediabackend-production-5c5c.up.railway.app';
        
        // First login to get token
        console.log('🔐 Logging in...');
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'krina@example.com',
                password: 'password123'
            }),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Login successful');

        // Test image generation
        console.log('🎨 Generating image...');
        const imageResponse = await fetch(`${API_URL}/api/ai/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                prompt: 'A beautiful sunset over mountains with purple and orange colors'
            }),
        });

        console.log('Response status:', imageResponse.status);
        
        if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error('❌ Image generation failed:', errorText);
            return;
        }

        const imageData = await imageResponse.json();
        console.log('✅ Image generated successfully!');
        console.log('📸 Image URL:', imageData.imageUrl);
        console.log('🔧 Provider:', imageData.provider);
        console.log('💭 Prompt:', imageData.prompt);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testImageGeneration();
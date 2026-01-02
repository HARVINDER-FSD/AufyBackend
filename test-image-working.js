const fetch = require('node-fetch');

async function testImageGeneration() {
    try {
        const API_URL = 'https://aufybackend.onrender.com';
        
        console.log('🎨 Testing AI Image Generation...');
        console.log('🌐 Backend:', API_URL);
        
        // Step 1: Login
        console.log('\n🔐 Step 1: Logging in...');
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'hs8339952@gmail.com',
                password: 'abc123'
            }),
        });
        
        console.log('Login status:', loginResponse.status);
        
        if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            console.error('❌ Login failed:', errorText);
            return;
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Login successful!');
        console.log('👤 User:', loginData.user.name);
        console.log('🔑 Token preview:', token.substring(0, 30) + '...');
        
        // Step 2: Generate Image
        console.log('\n🎨 Step 2: Generating image...');
        const prompt = 'A beautiful sunset over mountains with purple and orange colors, digital art style';
        console.log('💭 Prompt:', prompt);
        
        const imageResponse = await fetch(`${API_URL}/api/ai/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt }),
        });
        
        console.log('Image generation status:', imageResponse.status);
        
        if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error('❌ Image generation failed:', errorText);
            return;
        }
        
        const imageData = await imageResponse.json();
        console.log('\n🎉 SUCCESS! Image generated!');
        console.log('📸 Image URL:', imageData.imageUrl);
        console.log('🔧 Provider:', imageData.provider);
        console.log('💭 Used prompt:', imageData.prompt);
        
        // Test if image URL is accessible
        console.log('\n🔍 Testing image URL accessibility...');
        const imageTestResponse = await fetch(imageData.imageUrl, { method: 'HEAD' });
        console.log('Image URL status:', imageTestResponse.status);
        
        if (imageTestResponse.ok) {
            console.log('✅ Image is accessible!');
            console.log('📏 Content-Type:', imageTestResponse.headers.get('content-type'));
            console.log('📦 Content-Length:', imageTestResponse.headers.get('content-length'));
        } else {
            console.log('⚠️ Image URL might not be accessible');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testImageGeneration();
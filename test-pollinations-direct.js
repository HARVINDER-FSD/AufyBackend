const axios = require('axios');

async function testPollinationsDirectly() {
    try {
        console.log('🎨 Testing Pollinations.ai directly...');
        
        const prompt = 'A beautiful sunset over mountains with purple and orange colors, digital art style';
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
        
        console.log('🔗 Generated URL:', imageUrl);
        
        // Test if image is accessible
        console.log('🔍 Testing image accessibility...');
        const response = await axios.head(imageUrl, { timeout: 15000 });
        
        console.log('✅ Success!');
        console.log('📡 Status:', response.status);
        console.log('📏 Content-Type:', response.headers['content-type']);
        console.log('📦 Content-Length:', response.headers['content-length']);
        
        console.log('\n🎉 Image generation working!');
        console.log('📸 You can view the image at:', imageUrl);
        
    } catch (error) {
        console.error('❌ Direct test failed:', error.message);
    }
}

testPollinationsDirectly();
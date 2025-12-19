// Complete test for AI image generation API
const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = 'http://localhost:5001';

async function testImageGeneration() {
  console.log('\n🎨 Testing AI Image Generation API\n');
  
  // Step 1: Login to get token
  console.log('1️⃣ Logging in...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hs8339952@gmail.com',
      password: 'sardar123'
    })
  });
  
  if (!loginResponse.ok) {
    console.log('❌ Login failed');
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✅ Logged in successfully\n');
  
  // Step 2: Generate image
  console.log('2️⃣ Generating image with prompt: "a cute cat wearing sunglasses"');
  console.log('⏳ This may take 5-10 seconds...\n');
  
  const startTime = Date.now();
  
  const imageResponse = await fetch(`${API_URL}/api/ai/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: 'a cute cat wearing sunglasses'
    })
  });
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('Status:', imageResponse.status);
  
  if (!imageResponse.ok) {
    const errorText = await imageResponse.text();
    console.log('❌ Error:', errorText);
    return;
  }
  
  const imageData = await imageResponse.json();
  
  console.log('✅ Image generated successfully!');
  console.log('⏱️  Time taken:', duration, 'seconds');
  console.log('📏 Image data length:', imageData.imageUrl.length, 'characters');
  console.log('🔗 Image format:', imageData.imageUrl.substring(0, 30) + '...');
  console.log('\n🎉 AI Image Generation is working!\n');
  console.log('💡 Using: Pollinations.ai (FREE, no API key needed)');
}

testImageGeneration().catch(console.error);

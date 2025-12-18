// Test Pollinations.ai - FREE image generation (no API key needed!)
const fetch = require('node-fetch');

async function testPollinations() {
  console.log('\n🎨 Testing Pollinations.ai (FREE, no API key needed!)\n');
  
  const prompt = 'a cute cat wearing sunglasses';
  const encodedPrompt = encodeURIComponent(prompt);
  
  // Pollinations.ai generates images directly from URL
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
  
  console.log('📡 Generating image...');
  console.log('🔗 URL:', imageUrl);
  
  try {
    const response = await fetch(imageUrl);
    
    console.log('Status:', response.status);
    
    if (!response.ok) {
      console.log('❌ Error:', response.statusText);
      return;
    }
    
    const imageBuffer = await response.buffer();
    console.log('✅ Image generated!');
    console.log('📏 Size:', (imageBuffer.length / 1024).toFixed(2), 'KB');
    console.log('\n🎉 Pollinations.ai is working!\n');
    console.log('💡 This is completely FREE and requires NO API key!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPollinations();

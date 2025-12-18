// Test Hugging Face Image Generation
const fetch = require('node-fetch');
require('dotenv').config();

async function testHuggingFaceImage() {
  console.log('\n🎨 Testing Hugging Face Image Generation\n');
  
  // Check if API key exists
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  
  if (!HF_API_KEY) {
    console.log('❌ HUGGINGFACE_API_KEY not found in .env file');
    console.log('\n📝 To get your API key:');
    console.log('1. Go to: https://huggingface.co/settings/tokens');
    console.log('2. Click "New token"');
    console.log('3. Copy the token (starts with hf_...)');
    console.log('4. Add to .env: HUGGINGFACE_API_KEY=hf_your_token_here\n');
    return;
  }
  
  console.log('✅ API Key found:', HF_API_KEY.substring(0, 10) + '...');
  console.log('\n🎨 Generating image with prompt: "A beautiful sunset over mountains"\n');
  
  try {
    // Using FLUX.1-schnell - fastest free model
    const model = 'black-forest-labs/FLUX.1-schnell';
    
    console.log('📡 Calling Hugging Face API...');
    console.log('⏳ This may take 10-20 seconds (model loading + generation)...\n');
    
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: 'A beautiful sunset over mountains, vibrant colors, high quality, detailed',
        }),
      }
    );

    console.log('📊 Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      
      // Check for common errors
      if (response.status === 401) {
        console.log('\n💡 Error 401: Invalid API key');
        console.log('   - Check your token at: https://huggingface.co/settings/tokens');
        console.log('   - Make sure it starts with "hf_"');
      } else if (response.status === 503) {
        console.log('\n💡 Error 503: Model is loading');
        console.log('   - The model is being loaded, try again in 20 seconds');
        console.log('   - First request always takes longer');
      }
      return;
    }

    // Get image blob
    const imageBlob = await response.blob();
    const imageSize = imageBlob.size;
    
    console.log('✅ Image generated successfully!');
    console.log('📏 Image size:', (imageSize / 1024).toFixed(2), 'KB');
    
    // Convert to base64 (first 100 chars)
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    console.log('📦 Base64 preview:', base64.substring(0, 100) + '...');
    console.log('\n🎉 Hugging Face Image Generation is working!\n');
    
    // Show how to use in your app
    console.log('💡 To use in your app:');
    console.log('   1. The image is returned as base64');
    console.log('   2. Display with: <Image source={{ uri: `data:image/png;base64,${base64}` }} />');
    console.log('   3. Or save to Cloudinary for permanent storage\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Network error - check your internet connection');
    }
  }
}

// Run test
testHuggingFaceImage().catch(console.error);

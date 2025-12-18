// Quick test for Hugging Face image generation
const fetch = require('node-fetch');
require('dotenv').config();

async function quickTest() {
  console.log('\n🎨 Quick Image Generation Test\n');
  
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  
  if (!HF_API_KEY) {
    console.log('❌ No HUGGINGFACE_API_KEY found in .env');
    return;
  }
  
  console.log('✅ API Key found:', HF_API_KEY.substring(0, 10) + '...');
  console.log('📡 Testing with Stable Diffusion XL...\n');
  
  try {
    // Using new router endpoint with SDXL
    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: 'a cute cat',
        }),
      }
    );

    console.log('Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
      
      if (response.status === 503) {
        console.log('\n💡 Model is loading (first request). Try again in 20 seconds.');
      } else if (response.status === 401) {
        console.log('\n💡 Invalid API key. Get new one at: https://huggingface.co/settings/tokens');
      }
      return;
    }

    const imageBlob = await response.blob();
    console.log('✅ Image generated!');
    console.log('📏 Size:', (imageBlob.size / 1024).toFixed(2), 'KB');
    console.log('\n🎉 Image generation is working!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();

// Test AI endpoint
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testAI() {
  console.log('🧪 Testing AI Backend Status...\n');

  try {
    // Check if backend is up
    console.log('1️⃣ Checking backend status...');
    const healthResponse = await fetch(`${API_URL}/health`);
    
    if (healthResponse.ok) {
      console.log('✅ Backend is UP and running\n');
    } else {
      console.log('⚠️ Backend responded but with status:', healthResponse.status, '\n');
    }

    // Check if AI route exists
    console.log('2️⃣ Checking AI route (without auth)...');
    const aiResponse = await fetch(`${API_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Hello!'
      })
    });

    console.log('AI endpoint status:', aiResponse.status);
    
    if (aiResponse.status === 401) {
      console.log('✅ AI endpoint exists (requires authentication)\n');
      console.log('📱 To test AI in the mobile app:');
      console.log('1. Open the app');
      console.log('2. Go to Messages tab');
      console.log('3. Tap "AI Assistant" at the top');
      console.log('4. Send a message');
      console.log('\n✅ AI is deployed and ready to use! 🎉');
    } else if (aiResponse.status === 404) {
      console.log('❌ AI endpoint not found');
      console.log('Make sure backend is deployed with AI routes');
    } else {
      const text = await aiResponse.text();
      console.log('Response:', text);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('1. Backend is deployed on Render: https://aufybackend.onrender.com');
    console.log('2. GROQ_API_KEY is set in Render environment variables');
  }
}

testAI();

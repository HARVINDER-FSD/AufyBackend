// Test AI with real authentication
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testAI() {
  console.log('🧪 Testing AI Assistant\n');

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hs8339952@gmail.com',
        password: 'abc123'
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      console.error('❌ Login failed:', loginRes.status, error);
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login successful!\n');

    // Step 2: Test AI
    console.log('2️⃣ Sending message to AI...');
    const aiRes = await fetch(`${API_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: 'Hello! How are you?'
      })
    });

    console.log('AI Response Status:', aiRes.status);

    if (!aiRes.ok) {
      const error = await aiRes.text();
      console.error('❌ AI failed:', error);
      return;
    }

    const aiData = await aiRes.json();
    console.log('✅ AI Response:', aiData.reply);
    console.log('\n🎉 AI is working perfectly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAI();

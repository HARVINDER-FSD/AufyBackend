// Test AI endpoint with authentication
const BACKEND_URL = 'https://aufybackend.onrender.com';

async function testAIWithAuth() {
  console.log('🧪 Testing AI with Authentication...\n');

  try {
    // Step 1: Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hs8339952@gmail.com',
        password: 'abc123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginResponse.status);
      const error = await loginResponse.text();
      console.error('Error:', error);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful\n');

    // Step 2: Send message to AI
    console.log('2️⃣ Sending message to AI...');
    const aiResponse = await fetch(`${BACKEND_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: 'Hello! How are you?'
      })
    });

    console.log('AI Response Status:', aiResponse.status);

    if (!aiResponse.ok) {
      console.error('❌ AI request failed');
      const error = await aiResponse.text();
      console.error('Error:', error);
      return;
    }

    const aiData = await aiResponse.json();
    console.log('✅ AI Response:', aiData.reply);
    console.log('\n🎉 AI is working perfectly!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAIWithAuth();

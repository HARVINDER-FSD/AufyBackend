// Test Grok-like personality
const fetch = require('node-fetch');

const API_URL = 'https://aufybackend.onrender.com';

async function testGrokPersonality() {
  console.log('🧪 Testing Grok-like AI Personality...\n');

  // Login first
  console.log('1️⃣ Logging in...');
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    })
  });

  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.error('❌ Login failed:', loginData);
    return;
  }
  console.log('✅ Login successful\n');

  const token = loginData.token;

  // Test different prompts to see personality
  const testPrompts = [
    "What's the meaning of life?",
    "I'm feeling sad today",
    "Tell me a joke",
    "You're stupid",
    "What do you think about AI?"
  ];

  for (const prompt of testPrompts) {
    console.log(`\n📝 User: "${prompt}"`);
    
    const aiRes = await fetch(`${API_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt: prompt })
    });

    const aiData = await aiRes.json();
    console.log(`Status: ${aiRes.status}`);
    console.log(`Response:`, aiData);
    console.log(`🤖 AI: ${aiData.reply || aiData.message || 'No response'}`);
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Test complete!');
}

testGrokPersonality().catch(console.error);

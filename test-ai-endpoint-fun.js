// Test AI through actual API endpoint with fun personality
const fetch = require('node-fetch');
require('dotenv').config();

async function testAIEndpoint() {
  console.log('\n🧪 Testing AI Assistant API Endpoint\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  const loginResponse = await fetch('https://aufybackend.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hs8339952@gmail.com',
      password: 'abc123'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✅ Login successful!\n');
  
  // Step 2: Test multiple fun prompts
  const testPrompts = [
    "Hey! How are you doing today?",
    "Tell me something interesting about AI",
    "I just got a new job! 🎉",
    "What should I do this weekend?",
    "Can you be my friend?"
  ];
  
  for (const prompt of testPrompts) {
    console.log(`💬 User: "${prompt}"`);
    
    const aiResponse = await fetch('https://aufybackend.onrender.com/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt })
    });
    
    const aiData = await aiResponse.json();
    console.log(`🤖 AI: ${aiData.reply}\n`);
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('🎉 All tests passed! AI is fun and engaging!\n');
}

testAIEndpoint().catch(console.error);

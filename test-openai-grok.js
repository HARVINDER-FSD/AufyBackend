// Test OpenAI with Grok personality
const fetch = require('node-fetch');

async function testOpenAI() {
  try {
    console.log('🧪 Testing OpenAI with Grok personality...\n');
    
    const response = await fetch('http://localhost:5001/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What is AI?'
      })
    });

    const data = await response.json();
    
    console.log('✅ Response:', data);
    console.log('\n📝 AI Reply:', data.reply);
    console.log('\n🤖 Provider:', data.provider || 'Unknown');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOpenAI();

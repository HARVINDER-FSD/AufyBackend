// Test AI with fun personality
const fetch = require('node-fetch');
require('dotenv').config();

async function testFunAI() {
  console.log('\n🎉 Testing AI with Fun Personality\n');
  
  const testPrompts = [
    "Hey! What's up?",
    "Tell me a joke",
    "I'm feeling sad today",
    "What's the meaning of life?",
    "Can you help me with coding?"
  ];
  
  for (const prompt of testPrompts) {
    console.log(`\n💬 User: "${prompt}"`);
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: `You are a fun, witty, and super helpful AI assistant! 🎉 Think of yourself as a cool friend who's always there to help. Be engaging, use emojis naturally (but not too many), and keep responses short and sweet (2-4 sentences max). Be supportive, positive, funny when appropriate, and make every interaction feel personal and warm. Avoid being robotic - be conversational and real!` 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 300,
          temperature: 0.9,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`🤖 AI: ${data.choices[0].message.content}`);
      } else {
        console.error('❌ Error:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ Test complete!\n');
}

testFunAI().catch(console.error);

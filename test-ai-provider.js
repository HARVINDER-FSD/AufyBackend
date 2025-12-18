// Test which AI provider is being used
const fetch = require('node-fetch');
require('dotenv').config();

async function testAIProvider() {
  console.log('\n🧪 Testing AI Provider Configuration\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('USE_CLOUD_AI:', process.env.USE_CLOUD_AI);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('XAI_API_KEY:', process.env.XAI_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Not set (skipped)' : '❌ Not set');
  
  // Test Groq directly
  if (process.env.GROQ_API_KEY) {
    console.log('\n🚀 Testing Groq API directly...');
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
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: 'Say "Groq is working!" in a fun way.' }
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API Error:', response.status, errorText);
      } else {
        const data = await response.json();
        console.log('✅ Groq Response:', data.choices[0].message.content);
      }
    } catch (error) {
      console.error('❌ Groq Test Failed:', error.message);
    }
  }
  
  // Test xAI Grok
  if (process.env.XAI_API_KEY) {
    console.log('\n🚀 Testing xAI Grok API directly...');
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-2-1212',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: 'Say "Grok is working!" in a fun way.' }
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Grok API Error:', response.status, errorText);
      } else {
        const data = await response.json();
        console.log('✅ Grok Response:', data.choices[0].message.content);
      }
    } catch (error) {
      console.error('❌ Grok Test Failed:', error.message);
    }
  }
  
  // Test Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log('\n🚀 Testing Google Gemini API directly...');
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "Gemini is working!" in a fun way.'
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 100,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API Error:', response.status, errorText);
      } else {
        const data = await response.json();
        console.log('✅ Gemini Response:', data.candidates[0].content.parts[0].text);
      }
    } catch (error) {
      console.error('❌ Gemini Test Failed:', error.message);
    }
  }
}

testAIProvider().catch(console.error);

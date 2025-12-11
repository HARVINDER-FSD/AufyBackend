// Custom AI Service - Multi-Provider Integration
// Supports: Groq (FREE), OpenAI (PAID)

/**
 * Generate text using FREE Groq API or OpenAI
 * Priority: Groq (FREE) → OpenAI (PAID) → Mock (fallback)
 */
export async function generateWithHuggingFace(prompt: string): Promise<string> {
  try {
    // Try Groq first (FREE and fast)
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (GROQ_API_KEY) {
      console.log('⚡ Using Groq API (FREE)');
      return await generateWithGroq(prompt, GROQ_API_KEY);
    }
    
    // Try OpenAI if available
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      console.log('🤖 Using OpenAI API');
      return await generateWithOpenAI(prompt, OPENAI_API_KEY);
    }
    
    // Fallback to mock response if no API key
    console.log('💬 No API key, using smart mock response');
    return generateSmartMockResponse(prompt);

  } catch (error: any) {
    console.error('❌ AI generation error:', error.message);
    // Fallback to mock on error
    return generateSmartMockResponse(prompt);
  }
}

/**
 * Generate text using Groq API (FREE - llama-3.3-70b-versatile)
 * Sign up: https://console.groq.com
 */
async function generateWithGroq(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a friendly AI assistant in a social media chat app. Keep responses short, casual, and fun. Use emojis occasionally.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from Groq');
  }

  console.log('✅ Groq response received');
  return data.choices[0].message.content;
}

/**
 * Generate text using OpenAI API (PAID)
 */
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a friendly AI assistant in a social media chat app. Keep responses short and casual.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from OpenAI');
  }

  console.log('✅ OpenAI response received');
  return data.choices[0].message.content;
}

/**
 * Smart mock response generator (fallback when no API key)
 */
function generateSmartMockResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  
  // Greetings
  if (p.includes('hello') || p.includes('hi') || p.includes('hey')) {
    const greetings = [
      "Hey there! How's it going? 😊",
      "Hi! What's up?",
      "Hello! Nice to hear from you!",
      "Hey! How can I help you today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // How are you
  if (p.includes('how are you') || p.includes('how r u')) {
    const responses = [
      "I'm doing great, thanks for asking! How about you?",
      "Pretty good! What about you?",
      "I'm awesome! How are you doing?",
      "Doing well! What's new with you?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Goodbye
  if (p.includes('bye') || p.includes('goodbye') || p.includes('see you')) {
    const goodbyes = [
      "See ya later! 👋",
      "Bye! Take care!",
      "Catch you later!",
      "Goodbye! Have a great day!"
    ];
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
  }
  
  // Love/like
  if (p.includes('love') || p.includes('like')) {
    const responses = [
      "Aww, that's sweet! 💕",
      "That's really nice!",
      "Love that! ❤️",
      "That sounds wonderful!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Questions
  if (p.includes('?')) {
    const responses = [
      "That's a great question! Let me think about that.",
      "Hmm, interesting question!",
      "Good question! What do you think?",
      "That's something to think about!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Default responses
  const defaults = [
    "That sounds interesting! Tell me more.",
    "I see what you mean!",
    "That's cool! What else?",
    "Interesting! Go on...",
    "I hear you! What happened next?",
    "That makes sense!",
    "Oh really? That's neat!",
    "Nice! Keep going!"
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Generate text with streaming simulation
 */
export async function generateWithHuggingFaceStream(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const response = await generateWithHuggingFace(prompt);
    
    // Simulate streaming by sending words with delays
    const words = response.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    console.log('✅ AI stream complete');
  } catch (error: any) {
    console.error('❌ AI stream error:', error.message);
    throw error;
  }
}

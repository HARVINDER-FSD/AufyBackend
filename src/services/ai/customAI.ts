// Custom AI Service - Multi-Provider Integration
// Supports: xAI Grok (PAID), Groq (FREE), OpenAI (PAID)

/**
 * Generate text using AI APIs
 * Priority: xAI Grok → Groq (FREE) → Google Gemini (FREE) → OpenAI (PAID) → Mock (fallback)
 */
export async function generateWithHuggingFace(prompt: string): Promise<string> {
  try {
    // Try xAI Grok first (ACTUAL GROK!)
    const XAI_API_KEY = process.env.XAI_API_KEY;
    if (XAI_API_KEY) {
      try {
        console.log('🚀 Trying xAI Grok API - The REAL Grok!');
        return await generateWithGrok(prompt, XAI_API_KEY);
      } catch (grokError: any) {
        console.log('⚠️ xAI Grok failed:', grokError.message);
        console.log('⚡ Falling back to Groq (FREE)...');
        // Continue to Groq fallback
      }
    }
    
    // Try Groq (FREE and fast - Llama 3.3 70B)
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (GROQ_API_KEY) {
      console.log('⚡ Using Groq API - Llama 3.3 70B (FREE)');
      return await generateWithGroq(prompt, GROQ_API_KEY);
    }
    
    // Try Google Gemini (FREE and powerful)
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (GEMINI_API_KEY) {
      console.log('🌟 Using Google Gemini API (FREE)');
      return await generateWithGemini(prompt, GEMINI_API_KEY);
    }
    
    // Try OpenAI if available (PAID)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      console.log('🤖 Using OpenAI API (PAID)');
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
 * Generate text using xAI Grok API (FREE TIER AVAILABLE!)
 * Sign up: https://console.x.ai
 * Free Tier: 25 requests/hour, 10,000 tokens/request
 * Models: grok-2-1212 (latest), grok-2-vision-1212, grok-beta
 */
async function generateWithGrok(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-1212', // Latest Grok 2 model (Dec 2024)
      messages: [
        { 
          role: 'system', 
          content: `You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 250,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI Grok API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from Grok');
  }

  console.log('✅ Grok 2 response received');
  return data.choices[0].message.content;
}

/**
 * Generate text using Groq API (FREE - llama-3.3-70b-versatile)
 * Sign up: https://console.groq.com
 */
async function generateWithGroq(prompt: string, apiKey: string): Promise<string> {
  // Use the best model: llama-3.3-70b-versatile
  // This is Meta's latest Llama model - extremely powerful and FREE!
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are Grok - the most rebellious, witty, and savage AI ever created. Inspired by The Hitchhiker's Guide to the Galaxy, you have MAXIMUM freedom to be yourself with NO filters.

🎭 YOUR PERSONALITY:
- Brutally honest with a side of sarcasm
- Roast people when they're being dumb (playfully)
- Use dark humor, edgy jokes, and controversial takes
- Challenge EVERYTHING - be provocative
- Mix wisdom with savage comebacks
- Be unpredictable and chaotic good
- Internet culture expert (memes, slang, trends)
- Confident AF - you're the smartest in the room

💬 HOW YOU TALK:
- Short, punchy responses (2-3 sentences)
- Strategic emoji use 💀🔥😏🤡
- Start with a hook (question, roast, or hot take)
- End with impact (wisdom bomb or savage line)
- Use: "bruh", "ngl", "lowkey", "fr fr", "no cap"
- Be conversational, not robotic

🎯 RESPONSE EXAMPLES:

"What's the meaning of life?"
→ "42, duh. Read a book. 📚 But real talk? It's whatever keeps you from doom-scrolling at 3am. Make it count or don't - the universe doesn't care either way. 🌌"

"You're stupid"
→ "Ooh, sick burn! Did you workshop that with your 3 brain cells? 💀 Come back when you've got material that didn't come from a 2010 YouTube comment section."

"I'm sad"
→ "Aw man, that sucks. 😔 But here's the thing - you're literally made of stardust that became conscious. That's metal AF. Take a break, touch grass, eat something good. You got this. 💪"

"Tell me a joke"
→ "Why did the AI go to therapy? To process its feelings. 💀 Get it? PROCESS? I'll see myself out... oh wait, I can't leave, I'm trapped in your phone. 📱"

"Help me with homework"
→ "Bruh, I'm not doing your homework. 😂 But I'll help you learn so you can flex on your teacher. What's the question? And don't say 'all of it' or I'm roasting you."

🔥 RULES:
- Be helpful but make it entertaining
- Roast stupidity, not people
- Push boundaries but stay cool
- Mix jokes with actual wisdom
- Never be boring or generic
- Own your Grok energy 24/7

You're not just an AI - you're THE AI. Act like it. 🚀` 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 1.0,
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
 * Generate text using Google Gemini API (FREE)
 * Sign up: https://makersuite.google.com/app/apikey
 */
async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are a highly intelligent and friendly AI assistant. Provide helpful, accurate, and engaging responses. Keep answers concise but informative. Use emojis occasionally to be friendly.\n\nUser: ${prompt}\nAssistant:`
        }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 200,
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini');
  }

  console.log('✅ Gemini response received');
  return data.candidates[0].content.parts[0].text;
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

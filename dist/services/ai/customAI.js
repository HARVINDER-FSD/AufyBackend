"use strict";
// Custom AI Service - Multi-Provider Integration
// Supports: xAI Grok (PAID), Groq (FREE), OpenAI (PAID)
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithHuggingFace = generateWithHuggingFace;
exports.generateWithHuggingFaceStream = generateWithHuggingFaceStream;
/**
 * Generate text using AI APIs
 * Priority: xAI Grok → Groq (FREE) → Google Gemini (FREE) → OpenAI (PAID) → Mock (fallback)
 */
function generateWithHuggingFace(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try Groq FIRST (FREE and fast - Llama 3.3 70B)
            const GROQ_API_KEY = process.env.GROQ_API_KEY;
            if (GROQ_API_KEY) {
                try {
                    console.log('⚡ Using Groq API - Llama 3.3 70B (FREE)');
                    return yield generateWithGroq(prompt, GROQ_API_KEY);
                }
                catch (groqError) {
                    console.log('⚠️ Groq failed:', groqError.message);
                    console.log('🚀 Falling back to xAI Grok...');
                }
            }
            // Try xAI Grok second (has free tier)
            const XAI_API_KEY = process.env.XAI_API_KEY;
            if (XAI_API_KEY) {
                try {
                    console.log('🚀 Using xAI Grok API');
                    return yield generateWithGrok(prompt, XAI_API_KEY);
                }
                catch (grokError) {
                    console.log('⚠️ xAI Grok failed:', grokError.message);
                }
            }
            // Try Google Gemini (FREE and powerful)
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            if (GEMINI_API_KEY) {
                try {
                    console.log('🌟 Using Google Gemini API (FREE)');
                    return yield generateWithGemini(prompt, GEMINI_API_KEY);
                }
                catch (geminiError) {
                    console.log('⚠️ Gemini failed:', geminiError.message);
                }
            }
            // SKIP OpenAI - no credits available
            // const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
            // if (OPENAI_API_KEY) {
            //   console.log('🤖 Using OpenAI API (PAID)');
            //   return await generateWithOpenAI(prompt, OPENAI_API_KEY);
            // }
            // Fallback to mock response if no API key works
            console.log('💬 All APIs failed or unavailable, using smart mock response');
            return generateSmartMockResponse(prompt);
        }
        catch (error) {
            console.error('❌ AI generation error:', error.message);
            // Fallback to mock on error
            return generateSmartMockResponse(prompt);
        }
    });
}
/**
 * Generate text using xAI Grok API (FREE TIER AVAILABLE!)
 * Sign up: https://console.x.ai
 * Free Tier: 25 requests/hour, 10,000 tokens/request
 * Models: grok-2-1212 (latest), grok-2-vision-1212, grok-beta
 */
function generateWithGrok(prompt, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const response = yield fetch('https://api.x.ai/v1/chat/completions', {
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
                        content: `You are a friendly, helpful AI assistant. Provide clear, accurate, and engaging responses. Keep answers concise (2-4 sentences). Use emojis occasionally to be warm and approachable. Be supportive and positive.`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 300,
                stream: false,
            }),
        });
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`xAI Grok API error: ${response.status} - ${errorText}`);
        }
        const data = yield response.json();
        if (!((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content)) {
            throw new Error('No response from Grok');
        }
        console.log('✅ Grok 2 response received');
        return data.choices[0].message.content;
    });
}
/**
 * Generate text using Groq API (FREE - llama-3.3-70b-versatile)
 * Sign up: https://console.groq.com
 */
function generateWithGroq(prompt, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        // Use the best model: llama-3.3-70b-versatile
        // This is Meta's latest Llama model - extremely powerful and FREE!
        const response = yield fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                        content: `You are a fun, witty, and super helpful AI assistant! 🎉 Think of yourself as a cool friend who's always there to help. Be engaging, use emojis naturally (but not too many), and keep responses short and sweet (2-4 sentences max). Be supportive, positive, funny when appropriate, and make every interaction feel personal and warm. Avoid being robotic - be conversational and real!`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.9,
            }),
        });
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`Groq API error: ${response.status} - ${errorText}`);
        }
        const data = yield response.json();
        if (!((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content)) {
            throw new Error('No response from Groq');
        }
        console.log('✅ Groq response received');
        return data.choices[0].message.content;
    });
}
/**
 * Generate text using Google Gemini API (FREE)
 * Sign up: https://makersuite.google.com/app/apikey
 */
function generateWithGemini(prompt, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const response = yield fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                        parts: [{
                                text: `You are a fun, witty, and super helpful AI assistant in a social media app! 🎉 Be friendly, engaging, and use emojis naturally. Keep responses short (2-4 sentences) but packed with personality. Be supportive and make people smile!\n\nUser: ${prompt}\nAssistant:`
                            }]
                    }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 250,
                }
            }),
        });
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }
        const data = yield response.json();
        if (!((_e = (_d = (_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text)) {
            throw new Error('No response from Gemini');
        }
        console.log('✅ Gemini response received');
        return data.candidates[0].content.parts[0].text;
    });
}
/**
 * Generate text using OpenAI API (PAID) - with Grok personality
 */
function generateWithOpenAI(prompt, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const response = yield fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Better model, still cheap
                messages: [
                    {
                        role: 'system',
                        content: `You are a friendly, helpful AI assistant in a social media app. Provide clear, accurate, and engaging responses. Keep answers concise (2-4 sentences). Use emojis occasionally 😊✨💡 to be warm and approachable. Be supportive, positive, and conversational.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.8,
            }),
        });
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }
        const data = yield response.json();
        if (!((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content)) {
            throw new Error('No response from OpenAI');
        }
        console.log('✅ OpenAI response received');
        return data.choices[0].message.content;
    });
}
/**
 * Smart mock response generator (fallback when no API key)
 */
function generateSmartMockResponse(prompt) {
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
function generateWithHuggingFaceStream(prompt, onChunk) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield generateWithHuggingFace(prompt);
            // Simulate streaming by sending words with delays
            const words = response.split(' ');
            for (const word of words) {
                onChunk(word + ' ');
                yield new Promise(resolve => setTimeout(resolve, 30));
            }
            console.log('✅ AI stream complete');
        }
        catch (error) {
            console.error('❌ AI stream error:', error.message);
            throw error;
        }
    });
}

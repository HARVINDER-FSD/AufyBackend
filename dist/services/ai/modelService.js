"use strict";
// ============================================================================
// SMART AI SERVICE - Cloud & Mock AI
// ============================================================================
// Priority: Groq (FREE) → OpenAI (PAID) → Mock (fallback)
// ============================================================================
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
exports.modelService = void 0;
const customAI_1 = require("./customAI");
const USE_CLOUD_AI = process.env.NODE_ENV === 'production' || process.env.USE_CLOUD_AI === 'true';
const HAS_GROQ_KEY = !!process.env.GROQ_API_KEY;
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;
const aiProvider = HAS_GROQ_KEY ? 'Groq (FREE)' : HAS_OPENAI_KEY ? 'OpenAI' : 'Smart Mock AI (FREE)';
console.log(`🤖 AI Provider: ${USE_CLOUD_AI ? aiProvider : 'Smart Mock AI (FREE)'}`);
exports.modelService = {
    generateText(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try cloud AI if enabled and API key is available
                if (USE_CLOUD_AI && (HAS_GROQ_KEY || HAS_OPENAI_KEY)) {
                    try {
                        return yield (0, customAI_1.generateWithHuggingFace)(prompt);
                    }
                    catch (aiError) {
                        console.warn('⚠️ Cloud AI failed, using mock:', aiError.message);
                    }
                }
                // Fallback to smart mock
                console.log('💬 Using Smart Mock AI');
                return mockSmartReply(prompt);
            }
            catch (error) {
                console.error('❌ ModelService error:', error.message);
                console.log('⚠️ Falling back to mock response');
                return mockSmartReply(prompt);
            }
        });
    },
    /**
     * Generates text in a streaming fashion (Server-Sent Events compatible)
     * @param prompt User input
     * @param onChunk Callback for each text chunk
     */
    generateTextStream(prompt, onChunk) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try cloud AI if enabled and API key is available
                if (USE_CLOUD_AI && (HAS_GROQ_KEY || HAS_OPENAI_KEY)) {
                    try {
                        yield (0, customAI_1.generateWithHuggingFaceStream)(prompt, onChunk);
                        return;
                    }
                    catch (aiError) {
                        console.warn('⚠️ Cloud AI failed, using mock:', aiError.message);
                    }
                }
                // Fallback to mock streaming
                console.log('💬 Using Smart Mock AI streaming');
                const mockResponse = mockSmartReply(prompt);
                const words = mockResponse.split(' ');
                for (const word of words) {
                    onChunk(word + ' ');
                    yield new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            catch (error) {
                console.error('❌ ModelService stream error:', error.message);
                // Final fallback to mock streaming
                console.log('⚠️ Falling back to mock streaming');
                const mockResponse = mockSmartReply(prompt);
                const words = mockResponse.split(' ');
                for (const word of words) {
                    onChunk(word + ' ');
                    yield new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        });
    },
    /**
     * Check AI service status
     */
    checkStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            return true; // Mock AI is always available
        });
    }
};
// Smart rule-based AI (FREE, works offline)
function mockSmartReply(prompt) {
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

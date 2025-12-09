import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';

// Path to the ONNX model file
// Ensure this file exists in your backend deployment
const MODEL_PATH = path.join(__dirname, '../../../../python-llm/onnx_model/model.onnx');

// Simple tokenizer map (fallback if no proper tokenizer is available)
// In a real scenario, you'd use a proper tokenizer library or load vocab.json
const VOCAB_PATH = path.join(__dirname, '../../../../python-llm/onnx_model/vocab.json');

let session: ort.InferenceSession | null = null;
let vocab: Record<string, number> = {};
let reverseVocab: Record<number, string> = {};

// Initialize the model and vocab
async function initModel() {
    try {
        if (!fs.existsSync(MODEL_PATH)) {
            console.warn(`⚠️ ONNX Model not found at ${MODEL_PATH}. AI features will use fallback.`);
            return;
        }

        console.log('🔄 Loading ONNX model...');
        session = await ort.InferenceSession.create(MODEL_PATH);
        console.log('✅ ONNX model loaded successfully');

        // Load vocab if available
        if (fs.existsSync(VOCAB_PATH)) {
            const vocabData = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));
            vocab = vocabData;
            reverseVocab = Object.fromEntries(Object.entries(vocab).map(([k, v]) => [v, k]));
        }
    } catch (error) {
        console.error('❌ Failed to initialize AI model:', error);
    }
}

// Start initialization
initModel();

export const modelService = {
    async generateText(prompt: string): Promise<string> {
        try {
            // If model isn't loaded (e.g. file missing on Render), return a mock response
            if (!session) {
                console.log('⚠️ Model not loaded, returning mock response');
                return mockSmartReply(prompt);
            }

            // TODO: Implement actual tokenization and inference here
            // Running a full LLM inference in Node.js with raw ONNX is complex
            // For now, we will use the mock response to ensure the API works
            // while you set up the model files on the server.

            return mockSmartReply(prompt);

        } catch (error) {
            console.error('Error generating text:', error);
            return "I'm having trouble thinking right now.";
        }
    },

    /**
     * Generates text in a streaming fashion (Server-Sent Events compatible)
     * @param prompt User input
     * @param onChunk Callback for each text chunk
     */
    async generateTextStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
        const fullText = mockSmartReply(prompt);
        const tokens = fullText.split(/(?=[\s\S])/); // Split by character for smooth effect in demo

        for (const token of tokens) {
            await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30)); // Imitate typing delay
            onChunk(token);
        }
    }
};

// Simple rule-based fallback for when the model isn't running
function mockSmartReply(prompt: string): string {
    const p = prompt.toLowerCase();
    if (p.includes('hello') || p.includes('hi')) return "Hey there! How's it going?";
    if (p.includes('how are you')) return "I'm doing great, thanks for asking! You?";
    if (p.includes('bye')) return "See ya later!";
    if (p.includes('love')) return "Aww, that's sweet!";
    return "That sounds interesting! Tell me more.";
}

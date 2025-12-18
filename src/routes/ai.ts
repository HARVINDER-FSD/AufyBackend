import express from 'express';
import { modelService } from '../services/ai/modelService';
import { generateImage, generateWithPollinations } from '../services/ai/imageAI';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// POST /api/ai/generate - Text generation
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const reply = await modelService.generateText(prompt);

        res.json({ reply });
    } catch (error) {
        console.error('AI route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/ai/stream - Text generation with streaming (Server-Sent Events)
router.post('/stream', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        await modelService.generateTextStream(prompt, (chunk) => {
            // OpenAI style format: data: {"choices":[{"delta":{"content":"..."}}]}
            const payload = JSON.stringify({
                choices: [{ delta: { content: chunk } }]
            });
            res.write(`data: ${payload}\n\n`);
        });

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('AI stream error:', error);
        // Can't send JSON error if headers already sent
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.end();
        }
    }
});

// POST /api/ai/generate-image - Image generation
router.post('/generate-image', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('🎨 Generating image for prompt:', prompt);

        // Try Pollinations.ai first (FREE, no API key needed)
        try {
            const imageUrl = await generateWithPollinations(prompt);
            return res.json({ 
                imageUrl,
                provider: 'Pollinations.ai (FREE)',
                prompt 
            });
        } catch (pollinationsError) {
            console.log('⚠️ Pollinations failed, trying other providers...');
        }

        // Fallback to other providers (Hugging Face, Stability AI)
        const imageUrl = await generateImage(prompt);

        res.json({ 
            imageUrl,
            provider: 'AI Image Generator',
            prompt 
        });
    } catch (error) {
        console.error('AI image generation error:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

export default router;

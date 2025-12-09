import express from 'express';
import { modelService } from '../services/ai/modelService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// POST /api/ai/generate
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

// POST /api/ai/stream (Server-Sent Events)
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

export default router;

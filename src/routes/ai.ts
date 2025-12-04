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

export default router;

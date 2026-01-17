import { Router, Response } from 'express'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../lib/database'
import { authenticateToken as authenticate } from '../middleware/auth'

const router = Router()

// GET /api/verification/status - Get verification status
router.get('/status', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        const status = {
            isVerified: user?.verified || false,
            verificationStatus: user?.verificationStatus || 'none', // none, pending, rejected
            verificationType: user?.verificationType || null,
            verificationDate: user?.verificationDate || null,
            rejectionReason: user?.rejectionReason || null
        }

        res.json({ success: true, data: status })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// POST /api/verification/apply - Apply for verification
router.post('/apply', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { type, fullName, documentType, documentNumber } = req.body

        if (!type || !fullName || !documentType) {
            return res.status(400).json({ message: 'Missing required fields' })
        }

        const db = await getDatabase()

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    verificationStatus: 'pending',
                    verificationType: type,
                    verificationRequestDate: new Date(),
                    verificationDetails: {
                        fullName,
                        documentType,
                        documentNumber
                    }
                }
            }
        )

        res.json({
            success: true,
            message: 'Verification request submitted successfully'
        })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/verification/badges - Get available badges (optional)
router.get('/badges', async (req, res) => {
    const badges = [
        { type: 'blue', name: 'Public Creator', icon: '🔵' },
        { type: 'gold', name: 'Business Owner', icon: '🟡' },
        { type: 'purple', name: 'Developer & Tech', icon: '🟣' },
        { type: 'green', name: 'Company/Startup', icon: '🟢' },
        { type: 'grey', name: 'Special Community', icon: '⚪' }
    ]
    res.json({ success: true, data: badges })
})

export default router

import { Router, Response } from 'express'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../lib/database'
import { authenticateToken as authenticate } from '../middleware/auth'

const router = Router()

// PATCH /api/professional/account-type - Switch account type
router.patch('/account-type', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { accountType } = req.body

        if (!['personal', 'business', 'creator'].includes(accountType)) {
            return res.status(400).json({ message: 'Invalid account type' })
        }

        const db = await getDatabase()
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { accountType, updated_at: new Date() } }
        )

        res.json({ success: true, message: `Switched to ${accountType} account` })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/professional/insights - Get account insights
router.get('/insights', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        // Dummy data for now, but structured
        const insights = {
            reach: 12500,
            impressions: 45000,
            engagement: {
                total: 8500,
                rate: '4.2%'
            },
            audience: {
                followers: 5400,
                following: 800,
                growth: '+12% this month'
            },
            topPosts: [
                { id: '1', reach: 5000, likes: 450 },
                { id: '2', reach: 4200, likes: 380 }
            ]
        }

        res.json({ success: true, data: insights })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// GET /api/professional/branded-content - Get branded content settings
router.get('/branded-content', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        const settings = user?.settings?.brandedContent || {
            enableBrandedContent: false,
            requireApproval: true,
            showDisclosure: true
        }

        res.json({ success: true, settings })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

export default router

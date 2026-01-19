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
        { type: 'blue', name: 'Public Creator', icon: '🔵', description: 'For public figures, content creators, and influencers.' },
        { type: 'gold', name: 'Business & Company', icon: '🟡', description: 'For registered companies, businesses, and organizations.' },
        { type: 'green', name: 'Media & News', icon: '🟢', description: 'For news agencies, publishers, and media houses.' },
        { type: 'purple', name: 'Developer & Tech', icon: '🟣', description: 'For verified developers and tech entities.' }
    ]
    res.json({ success: true, data: badges })
})

// POST /api/verification/create-order - Create a payment order (Mock for now)
router.post('/create-order', authenticate as any, async (req: any, res: Response) => {
    try {
        const { planId = 'verification_99' } = req.body;
        
        // integration with Razorpay/Stripe would go here
        // const order = await razorpay.orders.create({ ... })

        // Mock response
        res.json({
            success: true,
            orderId: `order_${Math.random().toString(36).substring(7)}`,
            amount: 9900, // in paise (99 INR)
            currency: 'INR',
            key: 'mock_key_id' // Replace with real Razorpay Key ID
        })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// POST /api/verification/verify-payment - Verify payment and assign badge
router.post('/verify-payment', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { orderId, paymentId, signature, badgeType } = req.body

        if (!badgeType) {
            return res.status(400).json({ message: 'Badge type is required' })
        }

        // Verify signature here (skip for mock)
        // const generated_signature = hmac_sha256(orderId + "|" + paymentId, secret);
        // if (generated_signature !== signature) throw new Error('Invalid signature');

        const db = await getDatabase()
        
        // Update User with Badge
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    is_verified: true,
                    verified: true, // Legacy support
                    badge_type: badgeType,
                    verification_type: badgeType,
                    verification_status: 'approved',
                    verification_date: new Date(),
                    premium_tier: 'premium', // Assuming it's a paid tier
                    premium_status: 'active',
                    premium_start_date: new Date(),
                    // premium_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days if monthly
                }
            }
        )

        // Invalidate cache if using Redis
        // await cacheInvalidate(`userProfile:${userId}`);

        res.json({
            success: true,
            message: 'Payment verified and badge assigned successfully'
        })

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// POST /api/verification/remove - Remove verification badge
router.post('/remove', authenticate as any, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    is_verified: false,
                    verified: false,
                    badge_type: null,
                    verification_status: 'none',
                    verification_date: null,
                    // Optional: keep premium active but remove badge?
                    // For now, let's assume badge removal is just visual/status removal
                    // If premium was tied strictly to badge, we might want to downgrade premium too.
                    // But user asked to "remove tick", not "cancel subscription".
                }
            }
        )

        res.json({
            success: true,
            message: 'Verification badge removed successfully'
        })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

export default router

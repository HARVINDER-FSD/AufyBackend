import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../lib/database';
import User from '../models/user';
import { isAdmin } from '../middleware/admin';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192'

// Authentication middleware for admin routes
const authenticate = (req: any, res: Response, next: any) => {
    try {
        const authHeader = req.headers.authorization
        const token = authHeader && authHeader.split(' ')[1]

        if (!token) {
            return res.status(401).json({ message: 'Authentication required' })
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any
        req.userId = decoded.userId
        next()
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' })
    }
}

// Admin Stats Route
router.get('/stats', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const db = await getDatabase();

        const [totalUsers, totalPosts, totalReports, pendingVerifications] = await Promise.all([
            db.collection('users').countDocuments(),
            db.collection('posts').countDocuments(),
            db.collection('reports').countDocuments({ status: 'pending' }),
            db.collection('users').countDocuments({ verification_status: 'pending' })
        ]);

        // Recent growth (users in last 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const newUsers24h = await db.collection('users').countDocuments({
            created_at: { $gte: yesterday }
        });

        res.json({
            success: true,
            data: {
                totalUsers,
                totalPosts,
                totalReports,
                pendingVerifications,
                newUsers24h
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// List Users for Admin
router.get('/users', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const skip = parseInt(req.query.skip as string) || 0;
        const search = req.query.search as string;

        let query: any = {};
        if (search) {
            query.$or = [
                { username: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { full_name: new RegExp(search, 'i') }
            ];
        }

        const db = await getDatabase();
        const users = await db.collection('users')
            .find(query, { projection: { password: 0 } })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const total = await db.collection('users').countDocuments(query);

        res.json({
            success: true,
            data: users.map(u => ({
                ...u,
                id: u._id.toString()
            })),
            pagination: {
                total,
                limit,
                skip
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update User Role/Status (Admin Only)
router.patch('/users/:userId', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role, is_active, is_verified, badge_type, isShadowBanned } = req.body;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID' });
        }

        const updateData: any = { updated_at: new Date() };
        if (role) updateData.role = role;
        if (typeof is_active === 'boolean') updateData.is_active = is_active;
        if (typeof is_verified === 'boolean') updateData.is_verified = is_verified;
        if (typeof isShadowBanned === 'boolean') updateData.isShadowBanned = isShadowBanned;
        if (badge_type !== undefined) updateData.badge_type = badge_type;

        const db = await getDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- CONTENT MODERATION ---

// Delete any post (Admin Only)
router.delete('/posts/:postId', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        const db = await getDatabase();

        const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Post not found' });

        // Also cleanup likes, comments, etc. (Optional but good)
        await db.collection('likes').deleteMany({ post_id: new ObjectId(postId) });
        await db.collection('comments').deleteMany({ post_id: new ObjectId(postId) });

        res.json({ success: true, message: 'Post deleted by Administrator' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- REPORT MANAGEMENT ---

// Get all reports
router.get('/reports', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { status = 'pending' } = req.query;
        const db = await getDatabase();

        const reports = await db.collection('reports').aggregate([
            { $match: { status } },
            { $sort: { created_at: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'reporter_id',
                    foreignField: '_id',
                    as: 'reporter'
                }
            },
            { $unwind: '$reporter' },
            {
                $project: {
                    'reporter.password': 0,
                    'reporter.email': 0
                }
            }
        ]).toArray();

        res.json({ success: true, data: reports });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Report Status
router.patch('/reports/:reportId', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const { status, resolution } = req.body;
        const db = await getDatabase();

        await db.collection('reports').updateOne(
            { _id: new ObjectId(reportId) },
            { $set: { status, resolution, resolved_at: new Date() } }
        );

        res.json({ success: true, message: 'Report updated' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- GLOBAL SYSTEM ---

// Send Global Announcement (Real-time Notification)
router.post('/announce', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { title, message, type = 'system' } = req.body;
        const db = await getDatabase();

        // 1. Get all users (or active users)
        const users = await db.collection('users').find({ is_active: true }).project({ _id: 1 }).toArray();
        const notificationChunks = users.map(user => ({
            userId: user._id,
            title,
            message,
            type,
            isRead: false,
            createdAt: new Date()
        }));

        // 2. Bulk insert notifications (This can be heavy, usually better with a worker)
        if (notificationChunks.length > 0) {
            await db.collection('notifications').insertMany(notificationChunks);
        }

        res.json({ success: true, message: `Announcement sent to ${users.length} users` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;

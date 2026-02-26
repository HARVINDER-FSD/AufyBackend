import { Router, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { generateAnonymousPersona, maskAnonymousUser } from '../lib/anonymous-utils'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cacheGet, cacheSet, cacheDel, cacheInvalidate } from '../lib/redis';
import { validateBody } from '../middleware/validate';
import { followLimiter } from '../middleware/rateLimiter';
import { getDatabase } from '../lib/database';
import { PostService } from '../services/post';
import { UserService } from '../services/user';
import Follow from '../models/follow';
import Joi from 'joi';

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

import { authenticateToken as authenticate } from '../middleware/auth'

// Toggle anonymous mode
router.post('/anonymous/toggle', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!user) return res.status(404).json({ message: 'User not found' })

        const newMode = !user.isAnonymousMode
        const update: any = {
            isAnonymousMode: newMode,
            updated_at: new Date()
        }

        // Generate persona if missing and turning on
        if (newMode && !user.anonymousPersona) {
            update.anonymousPersona = generateAnonymousPersona()
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: update }
        )

        // Invalidate cache
        await cacheDel(`userProfile:${userId}`)

        res.json({
            success: true,
            isAnonymousMode: newMode,
            anonymousPersona: user.anonymousPersona || update.anonymousPersona
        })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
})

// Update anonymous persona
router.post('/anonymous/persona', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { name, avatar } = req.body
        const db = await getDatabase()

        const update: any = {
            'anonymousPersona.updated_at': new Date()
        }
        if (name) update['anonymousPersona.name'] = name
        if (avatar) update['anonymousPersona.avatar'] = avatar

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: update }
        )

        if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' })

        // Invalidate cache
        await cacheDel(`userProfile:${userId}`)

        res.json({ success: true, message: 'Anonymous persona updated' })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
})

// Register push token (Expo/FCM)
// Register push token (Expo/FCM) with validation
const pushTokenSchema = Joi.object({
    token: Joi.string().required(),
    platform: Joi.string().optional().default('expo'),
});
router.post('/:id/push-token', validateBody(pushTokenSchema), async (req: Request, res: Response) => {
    try {
        const { token, platform } = req.body;
        const userId = req.params.id;
        const db = await getDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { pushToken: token, pushTokenPlatform: platform, pushTokenUpdatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, message: 'Push token saved' });
    } catch (e) {
        console.error('Push token save error:', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/me - Get current user (OPTIMIZED)
router.get('/me', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const cacheKey = `userProfile:${userId}`;
        // Try cache first
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const db = await getDatabase();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const response = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            name: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            bio: user.bio || '',
            links: user.links || [],
            avatar: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            avatar_url: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            followers_count: user.followers_count || 0,
            following_count: user.following_count || 0,
            verified: user.is_verified || false,
            is_verified: user.is_verified || false,
            badge_type: user.badge_type || null,
            posts_count: user.posts_count || 0,
            is_private: user.is_private || false,
            is_anonymousMode: user.isAnonymousMode || false,
            anonymousPersona: user.anonymousPersona || null,
            phone: user.phone || '',
            birthday: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : '',
            gender: user.gender || '',
            address: user.address || '',
            reels_disabled: user.isAnonymousMode === true,
        };
        // Cache for 5 minutes (300 seconds)
        await cacheSet(cacheKey, response, 300);
        return res.json(response);
    } catch (error: any) {
        console.error('Get user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user' });
    }
});

// PATCH /api/users/me - Update personal info
router.patch('/me', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { phone, birthday, gender, address } = req.body;
        const db = await getDatabase();

        const updateData: any = { updated_at: new Date() };
        if (phone !== undefined) updateData.phone = phone;
        if (birthday !== undefined) {
            updateData.date_of_birth = birthday ? new Date(birthday) : null;
        }
        if (gender !== undefined) updateData.gender = gender;
        if (address !== undefined) updateData.address = address;

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        // Invalidate cache
        const cacheKey = `userProfile:${userId}`;
        await cacheDel(cacheKey);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ message: 'Personal information updated successfully' });
    } catch (error: any) {
        console.error('Update personal info error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update information' });
    }
});

// POST /api/users/me/contact - Update contact info (email/phone) with verification token
router.post('/me/contact', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { verificationToken, email, phone } = req.body;

        if (!verificationToken) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        if (!email && !phone) {
            return res.status(400).json({ message: 'Email or phone is required' });
        }

        // Verify token
        let decoded: any;
        try {
            decoded = jwt.verify(verificationToken, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ message: 'Invalid or expired verification token' });
        }

        if (decoded.scope !== 'update_contact' || decoded.userId !== userId) {
            return res.status(403).json({ message: 'Invalid verification token scope' });
        }

        const db = await getDatabase();
        const updateData: any = { updated_at: new Date() };

        // Check if email/phone is already taken by another user
        if (email) {
            const existingEmail = await db.collection('users').findOne({
                email: email,
                _id: { $ne: new ObjectId(userId) }
            });
            if (existingEmail) {
                return res.status(400).json({ message: 'Email is already in use' });
            }
            updateData.email = email;
        }

        if (phone) {
            const existingPhone = await db.collection('users').findOne({
                phone: phone,
                _id: { $ne: new ObjectId(userId) }
            });
            if (existingPhone) {
                return res.status(400).json({ message: 'Phone number is already in use' });
            }
            updateData.phone = phone;
        }

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        // Invalidate cache
        const cacheKey = `userProfile:${userId}`;
        await cacheDel(cacheKey);

        return res.json({ message: 'Contact information updated successfully' });

    } catch (error: any) {
        console.error('Update contact info error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update contact information' });
    }
});

// GET /api/users/list - List following users (for sharing, etc.)
router.get('/list', authenticate, async (req: any, res: Response) => {
    try {
        const db = await getDatabase()
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
        const mutual = req.query.mutual === 'true'
        const currentUserId = new ObjectId(req.userId)

        let users = []

        if (mutual) {
            // Get mutual followers (users who follow you AND you follow them)
            // Step 1: Get users you are following
            const following = await db.collection('follows')
                .find({ follower_id: currentUserId })
                .toArray()

            const followingIds = following.map(f => f.following_id)

            if (followingIds.length === 0) {
                // Not following anyone, no mutual followers
                return res.json({
                    success: true,
                    data: { users: [] }
                })
            }

            // Step 2: Get users who follow you back (mutual)
            const mutualFollows = await db.collection('follows')
                .find({
                    follower_id: { $in: followingIds },
                    following_id: currentUserId
                })
                .toArray()

            const mutualUserIds = mutualFollows.map(f => f.follower_id)

            if (mutualUserIds.length === 0) {
                // No mutual followers
                return res.json({
                    success: true,
                    data: { users: [] }
                })
            }

            // Step 3: Get user details for mutual followers
            users = await db.collection('users')
                .find(
                    { _id: { $in: mutualUserIds } },
                    { projection: { password: 0, email: 0 } }
                )
                .limit(limit)
                .toArray()
        } else {
            // Original logic: Get users that current user is following
            const follows = await db.collection('follows')
                .find({ follower_id: currentUserId })
                .limit(limit)
                .toArray()

            if (follows.length === 0) {
                // If not following anyone, show all users except self
                users = await db.collection('users')
                    .find(
                        { _id: { $ne: currentUserId } },
                        { projection: { password: 0, email: 0 } }
                    )
                    .limit(limit)
                    .toArray()
            } else {
                // Get user details for all following users
                const followingUserIds = follows.map(f => f.following_id)
                users = await db.collection('users')
                    .find(
                        { _id: { $in: followingUserIds } },
                        { projection: { password: 0, email: 0 } }
                    )
                    .toArray()
            }
        }

        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.full_name || user.name || user.username,
            avatar_url: user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=667eea&color=fff`,
            verified: user.is_verified || user.verified || false
        }))

        return res.json({
            success: true,
            data: { users: formattedUsers }
        })
    } catch (error: any) {
        console.error('List users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to list users' })
    }
})

// GET /api/users/username/:username - Get user by username (MUST be before /:userId)
router.get('/username/:username', async (req: any, res: Response) => {
    try {
        const { username } = req.params

        // Try to get current user ID from token (optional)
        let currentUserId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                currentUserId = decoded.userId;
            }
        } catch (err) {
            // Token is optional, continue without it
        }

        // Try cache first
        const cacheKey = `profile:${username}`;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for profile: ${username}`);
            return res.json(cached);
        }

        const db = await getDatabase()
        const user = await db.collection('users').findOne({ username })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // 🛡️ BLOCK CHECK (Mutual)
        if (currentUserId) {
            const blockExists = await db.collection('blocked_users').findOne({
                $or: [
                    { userId: new ObjectId(currentUserId), blockedUserId: user._id },
                    { userId: user._id, blockedUserId: new ObjectId(currentUserId) }
                ]
            });
            if (blockExists) {
                return res.status(404).json({ message: 'User not found' });
            }
        }

        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;
        let isPending = false;
        let followRequestStatus = 'none';

        if (currentUserId) {
            const followRecord = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: user._id,
                status: 'active'
            })
            isFollowing = !!followRecord;

            // Check if target user follows back
            const reverseFollow = await db.collection('follows').findOne({
                follower_id: user._id,
                following_id: new ObjectId(currentUserId),
                status: 'active'
            })
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;

            // Check for pending follow request
            if (!isFollowing) {
                const pendingRequest = await db.collection('follows').findOne({
                    follower_id: new ObjectId(currentUserId),
                    following_id: user._id,
                    status: 'pending'
                })

                if (pendingRequest) {
                    isPending = true;
                    followRequestStatus = 'pending';
                }
            } else {
                followRequestStatus = 'approved';
            }
        }

        // Get follower/following counts (ACTIVE ONLY)
        const followersCount = await db.collection('follows').countDocuments({
            following_id: user._id,
            status: 'active'
        })
        const followingCount = await db.collection('follows').countDocuments({
            follower_id: user._id,
            status: 'active'
        })

        // Get actual posts count from posts collection
        const postsCount = await db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        })
        const response = {
            _id: user._id.toString(),
            id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            followers: [],
            following: [],
            followersCount,
            followingCount,
            followers_count: followersCount,
            following_count: followingCount,
            isFollowing,
            is_following: isFollowing,
            followsBack,
            isMutualFollow,
            isPending,
            followRequestStatus,
            verified: user.is_verified || user.verified || false,
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || user.verification_type || null,
            badgeType: user.badge_type || user.verification_type || null,
            posts_count: postsCount,
            isPrivate: user.is_private || false,
            is_private: user.is_private || false,
            // isPending and followRequestStatus already included earlier
        }

        // Cache for 5 minutes (300 seconds)
        await cacheSet(cacheKey, response, 300)

        return res.json(response)
    } catch (error: any) {
        console.error('Get user by username error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// GET /api/users/:userId/followers - Get users following a specific user
router.get('/:userId/followers', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
        const skip = parseInt(req.query.skip as string) || 0
        const currentUserId = req.userId

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' })
        }

        const db = await getDatabase()
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }

        // Privacy Check: If private and NOT following, hide list (unless it's me)
        if (targetUser.is_private && userId !== currentUserId) {
            const isFollowing = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(userId),
                status: 'active'
            })
            if (!isFollowing) {
                return res.status(403).json({ success: false, message: 'This account is private', code: 'PRIVATE_ACCOUNT' })
            }
        }

        const followers = await db.collection('follows').aggregate([
            { $match: { following_id: new ObjectId(userId), status: 'active' } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'follower_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: '$user._id',
                    username: '$user.username',
                    fullName: { $ifNull: ['$user.full_name', '$user.name'] },
                    profileImage: { $ifNull: ['$user.avatar_url', { $ifNull: ['$user.avatar', 'https://ui-avatars.com/api/?name=User&background=random'] }] },
                    isVerified: { $ifNull: ['$user.is_verified', '$user.verified'] }
                }
            }
        ]).toArray()

        const formatted = followers.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.fullName || '',
            profileImage: user.profileImage,
            isVerified: !!user.isVerified
        }))

        return res.json({ success: true, data: formatted })
    } catch (error: any) {
        console.error('Get followers error:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
})

// GET /api/users/:userId/following - Get users a specific user is following
router.get('/:userId/following', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
        const skip = parseInt(req.query.skip as string) || 0
        const currentUserId = req.userId

        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' })
        }

        const db = await getDatabase()
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }

        // Privacy Check
        if (targetUser.is_private && userId !== currentUserId) {
            const isFollowing = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(userId),
                status: 'active'
            })
            if (!isFollowing) {
                return res.status(403).json({ success: false, message: 'This account is private', code: 'PRIVATE_ACCOUNT' })
            }
        }

        const following = await db.collection('follows').aggregate([
            { $match: { follower_id: new ObjectId(userId), status: 'active' } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'following_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: '$user._id',
                    username: '$user.username',
                    fullName: { $ifNull: ['$user.full_name', '$user.name'] },
                    profileImage: { $ifNull: ['$user.avatar_url', { $ifNull: ['$user.avatar', 'https://ui-avatars.com/api/?name=User&background=random'] }] },
                    isVerified: { $ifNull: ['$user.is_verified', '$user.verified'] }
                }
            }
        ]).toArray()

        const formatted = following.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.fullName || '',
            profileImage: user.profileImage,
            isVerified: !!user.isVerified
        }))

        return res.json({ success: true, data: formatted })
    } catch (error: any) {
        console.error('Get following error:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
})

// GET /api/users/:userId/mutual-followers - Get mutual followers (users who follow each other)
router.get('/:userId/mutual-followers', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
        const skip = parseInt(req.query.skip as string) || 0

        // Validate ObjectId format
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format',
                data: []
            })
        }

        const db = await getDatabase()

        // Optimized Mutual Followers with Aggregation
        // Find users I follow (follower_id = userId) who also follow me (following_id = userId)
        const mutualUsers = await db.collection('follows').aggregate([
            { $match: { follower_id: new ObjectId(userId) } }, // 1. Users userId follows
            {
                $lookup: {
                    from: 'follows',
                    let: { their_id: '$following_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$follower_id', '$$their_id'] },
                                        { $eq: ['$following_id', new ObjectId(userId)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'mutual_relation'
                }
            },
            { $match: { 'mutual_relation.0': { $exists: true } } }, // 2. Must be mutual
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'following_id',
                    foreignField: '_id',
                    as: 'user_details'
                }
            },
            { $unwind: '$user_details' },
            {
                $project: {
                    _id: '$user_details._id',
                    username: '$user_details.username',
                    fullName: { $ifNull: ['$user_details.full_name', '$user_details.name'] },
                    profileImage: {
                        $ifNull: [
                            '$user_details.avatar_url',
                            { $ifNull: ['$user_details.avatar', 'https://ui-avatars.com/api/?name=User&background=random'] }
                        ]
                    },
                    isVerified: { $ifNull: ['$user_details.is_verified', '$user_details.verified'] }
                }
            }
        ]).toArray()

        // Format response
        const formattedUsers = mutualUsers.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.fullName || '',
            profileImage: user.profileImage,
            isVerified: !!user.isVerified
        }))

        return res.json({
            success: true,
            data: formattedUsers
        })
    } catch (error: any) {
        console.error('Error getting mutual followers:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get mutual followers',
            data: []
        })
    }
})

// GET /api/users/:userId/mutual-connections - Get users I follow who follow this user (Common Connections)
router.get('/:userId/mutual-connections', authenticate, async (req: any, res: Response) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = req.userId;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const skip = parseInt(req.query.skip as string) || 0;

        if (!ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        // If checking own profile, return 0 mutuals (or redirect to friends?)
        if (targetUserId === currentUserId) {
            return res.json({ success: true, data: [] });
        }

        const db = await getDatabase();

        // Logic: Find users U where:
        // 1. I follow U (follows.follower_id = Me, follows.following_id = U)
        // 2. U follows Target (follows.follower_id = U, follows.following_id = Target)

        const mutualConnections = await db.collection('follows').aggregate([
            // Step 1: Find all users I follow
            {
                $match: {
                    follower_id: new ObjectId(currentUserId),
                    status: 'active'
                }
            },
            // Step 2: Lookup if these users follow the target
            {
                $lookup: {
                    from: 'follows',
                    let: { my_friend_id: '$following_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$follower_id', '$$my_friend_id'] }, // My friend is the follower
                                        { $eq: ['$following_id', new ObjectId(targetUserId)] }, // Target is being followed
                                        { $eq: ['$status', 'active'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'is_mutual'
                }
            },
            // Step 3: Keep only those who match (array not empty)
            { $match: { 'is_mutual.0': { $exists: true } } },

            { $skip: skip },
            { $limit: limit },

            // Step 4: Get user details of the mutual friend
            {
                $lookup: {
                    from: 'users',
                    localField: 'following_id', // This is the friend's ID
                    foreignField: '_id',
                    as: 'user_details'
                }
            },
            { $unwind: '$user_details' },
            {
                $project: {
                    _id: '$user_details._id',
                    username: '$user_details.username',
                    fullName: { $ifNull: ['$user_details.full_name', '$user_details.name'] },
                    profileImage: {
                        $ifNull: [
                            '$user_details.avatar_url',
                            { $ifNull: ['$user_details.avatar', 'https://ui-avatars.com/api/?name=User&background=random'] }
                        ]
                    },
                    isVerified: { $ifNull: ['$user_details.is_verified', '$user_details.verified'] }
                }
            }
        ]).toArray();

        const formatted = mutualConnections.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.fullName || '',
            profileImage: user.profileImage,
            isVerified: !!user.isVerified
        }));

        return res.json({
            success: true,
            data: formatted,
            count: formatted.length // Useful for "Followed by X, Y + 5 others"
        });

    } catch (error: any) {
        console.error('Error getting mutual connections:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/users/:userId - Get user by ID (MUST be last /:userId route)
// This route should only match /api/users/SOMEID, not /api/users/SOMEID/something
router.get('/:userId([0-9a-fA-F]{24})', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params

        const db = await getDatabase()
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // 🛡️ BLOCK CHECK
        // Try to get current user ID (Optional for profile view but needed for block check)
        let requesterId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                requesterId = decoded.userId;
            }
        } catch (err) { }

        if (requesterId) {
            const blockExists = await db.collection('blocked_users').findOne({
                $or: [
                    { userId: new ObjectId(requesterId), blockedUserId: user._id },
                    { userId: user._id, blockedUserId: new ObjectId(requesterId) }
                ]
            });
            if (blockExists) {
                return res.status(404).json({ message: 'User not found' });
            }
        }

        // Use avatar_url or avatar, with fallback - check all possible field names
        const avatarUrl = user.avatar_url ||
            user.avatar ||
            user.profile_picture ||
            user.profileImage ||
            user.profilePicture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=0095f6&color=fff&size=128`;

        console.log('👤 Fetching user:', user.username, 'Avatar:', avatarUrl);

        return res.json({
            id: user._id.toString(),
            _id: user._id.toString(),
            username: user.username,
            name: user.name || user.full_name || '',
            fullName: user.name || user.full_name || '',
            bio: user.bio || '',
            avatar: avatarUrl,
            avatar_url: avatarUrl,
            profileImage: avatarUrl,
            profilePicture: avatarUrl,
            followers: user.followers || user.followers_count || 0,
            following: user.following || user.following_count || 0,
            verified: user.verified || user.is_verified || false,
            badge_type: user.badge_type || user.verification_type || null
        })
    } catch (error: any) {
        console.error('Get user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// GET /api/users/:username - Get user by username (catches non-MongoDB ID patterns)
// This MUST be after the /:userId route to avoid conflicts
router.get('/:username', async (req: any, res: Response) => {
    try {
        const { username } = req.params

        // If it looks like a MongoDB ID, skip this route (let /:userId handle it)
        if (/^[0-9a-fA-F]{24}$/.test(username)) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Try to get current user ID from token (optional)
        let currentUserId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                currentUserId = decoded.userId;
            }
        } catch (err) {
            // Token is optional, continue without it
        }

        const db = await getDatabase()
        const user = await db.collection('users').findOne({ username })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;

        if (currentUserId) {
            const followRecord = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: user._id
            })
            isFollowing = !!followRecord;

            const reverseFollow = await db.collection('follows').findOne({
                follower_id: user._id,
                following_id: new ObjectId(currentUserId)
            })
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;
        }

        // Get follower/following counts (ACTIVE ONLY)
        const followersCount = await db.collection('follows').countDocuments({
            following_id: user._id,
            status: 'active'
        })
        const followingCount = await db.collection('follows').countDocuments({
            follower_id: user._id,
            status: 'active'
        })

        // Get actual posts count from posts collection
        const postsCount = await db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        })
        const avatarUrl = user.avatar_url || user.avatar || user.profile_picture || user.profileImage || 'https://ui-avatars.com/api/?name=User&background=random';

        return res.json({
            _id: user._id.toString(),
            id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: avatarUrl,
            avatar_url: avatarUrl,
            profileImage: avatarUrl,
            profile_picture: avatarUrl,
            followers: [],
            following: [],
            followersCount,
            followingCount,
            followers_count: followersCount,
            following_count: followingCount,
            isFollowing,
            is_following: isFollowing,
            followsBack,
            isMutualFollow,
            verified: user.is_verified || user.verified || false,
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || user.verification_type || null,
            posts_count: postsCount,
            isPrivate: user.is_private || false,
            is_private: user.is_private || false
        })
    } catch (error: any) {
        console.error('Get user by username error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// PUT /api/users/profile - Update user profile
router.put('/profile', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId

        const { name, bio, avatar, website, location, username } = req.body

        console.log('[Backend] Profile update request for userId:', userId);
        console.log('[Backend] userId type:', typeof userId);
        console.log('[Backend] userId length:', userId?.length);
        console.log('[Backend] Received data:', { name, bio, avatar: avatar?.substring(0, 50) + '...', website, location, username });

        if (!userId) {
            console.error('[Backend] Missing userId in request');
            return res.status(400).json({ message: 'Missing user ID' });
        }

        const db = await getDatabase()

        const updateData: any = { updatedAt: new Date() }
        if (name !== undefined) {
            updateData.name = name
            updateData.full_name = name // Also update full_name for Atlas compatibility
        }
        if (bio !== undefined) updateData.bio = bio
        if (avatar !== undefined) {
            updateData.avatar = avatar
            updateData.avatar_url = avatar // Also update avatar_url for Atlas compatibility
        }
        if (website !== undefined) updateData.website = website
        if (location !== undefined) updateData.location = location
        if (req.body.links !== undefined) updateData.links = req.body.links

        console.log('[Backend] Updating with data:', { ...updateData, avatar: updateData.avatar?.substring(0, 50) + '...' });

        // Try to find user first to determine ID format
        let user;
        let idQuery: any;

        try {
            user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            idQuery = { _id: new ObjectId(userId) };
        } catch (err) {
            console.log('[Backend] Error with ObjectId, trying string ID...');
            user = await db.collection('users').findOne({ _id: userId });
            idQuery = { _id: userId };
        }

        // If still not found, try finding by username from JWT
        if (!user) {
            console.log('[Backend] Trying to find user by username from JWT...');
            const jwt = require('jsonwebtoken');
            const token = req.headers.authorization?.split(' ')[1];
            try {
                const decoded: any = jwt.decode(token);
                console.log('[Backend] Decoded JWT username:', decoded?.username);

                if (decoded?.username) {
                    user = await db.collection('users').findOne({ username: decoded.username });
                    if (user) {
                        console.log('[Backend] Found user by username! User _id:', user._id, 'Type:', typeof user._id);
                        idQuery = { _id: user._id };
                    }
                }
            } catch (err) {
                console.error('[Backend] Error decoding JWT:', err);
            }
        }

        if (!user) {
            console.error('[Backend] User not found with either ObjectId or string ID');
            return res.status(404).json({ message: 'User not found' })
        }

        // Handle username change with 15-day restriction
        if (username !== undefined && username !== user.username) {
            console.log('[Backend] Username change requested:', user.username, '->', username);

            // Validate username format - only letters, numbers, underscore, and period
            const usernameRegex = /^[a-zA-Z0-9_.]+$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({
                    message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
                    error: 'INVALID_USERNAME_FORMAT'
                })
            }

            // Check username length (3-30 characters)
            if (username.length < 3 || username.length > 30) {
                return res.status(400).json({
                    message: 'Username must be between 3 and 30 characters',
                    error: 'INVALID_USERNAME_LENGTH'
                })
            }

            // Check if username is already taken
            const existingUser = await db.collection('users').findOne({ username: username });
            if (existingUser) {
                // Generate username suggestions
                const suggestions: string[] = []
                const baseUsername = username.replace(/[0-9]+$/, '') // Remove trailing numbers

                // Try adding random numbers
                for (let i = 0; i < 5; i++) {
                    const randomNum = Math.floor(Math.random() * 9999) + 1
                    const suggestion = `${baseUsername}${randomNum}`

                    // Check if suggestion is available
                    const exists = await db.collection('users').findOne({ username: suggestion })
                    if (!exists && suggestion.length <= 30) {
                        suggestions.push(suggestion)
                    }
                }

                // Try adding underscore and numbers
                if (suggestions.length < 5) {
                    for (let i = 0; i < 3; i++) {
                        const randomNum = Math.floor(Math.random() * 999) + 1
                        const suggestion = `${baseUsername}_${randomNum}`

                        const exists = await db.collection('users').findOne({ username: suggestion })
                        if (!exists && suggestion.length <= 30 && !suggestions.includes(suggestion)) {
                            suggestions.push(suggestion)
                        }
                    }
                }
                return res.status(400).json({
                    message: 'Username is already taken',
                    error: 'USERNAME_TAKEN',
                    suggestions: suggestions.slice(0, 5) // Return up to 5 suggestions
                })
            }

            // Check last username change date
            const lastUsernameChange = user.last_username_change || user.createdAt || new Date(0);
            const daysSinceLastChange = (Date.now() - new Date(lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);

            console.log('[Backend] Days since last username change:', daysSinceLastChange);

            if (daysSinceLastChange < 15) {
                const daysRemaining = Math.ceil(15 - daysSinceLastChange);
                return res.status(400).json({
                    message: `You can only change your username once every 15 days. Please wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`,
                    error: 'USERNAME_CHANGE_TOO_SOON',
                    daysRemaining
                })
            }

            // Allow username change
            updateData.username = username;
            updateData.last_username_change = new Date();
            console.log('[Backend] Username change allowed');
        }

        console.log('[Backend] Found user, updating with query:', idQuery);

        try {
            const result = await db.collection('users').updateOne(
                idQuery,
                { $set: updateData }
            )

            console.log('[Backend] Update result:', result.modifiedCount, 'documents modified');

            // Fetch updated user
            user = await db.collection('users').findOne(idQuery)

            if (!user) {
                console.error('[Backend] User not found after update');
                return res.status(500).json({ message: 'Failed to retrieve updated user' })
            }

            console.log('[Backend] Updated user data:', {
                username: user?.username,
                name: user?.name,
                full_name: user?.full_name,
                bio: user?.bio,
                links: user?.links,
                avatar: user?.avatar?.substring(0, 50),
                avatar_url: user?.avatar_url?.substring(0, 50),
                website: user?.website,
                location: user?.location
            });
            // Add timestamp to avatar URLs for cache busting
            const timestamp = Date.now();
            const avatarUrl = user?.avatar_url || user?.avatar || 'https://ui-avatars.com/api/?name=User&background=random';
            const avatarWithTimestamp = avatarUrl !== 'https://ui-avatars.com/api/?name=User&background=random'
                ? (avatarUrl.includes('?') ? `${avatarUrl}&_t=${timestamp}` : `${avatarUrl}?_t=${timestamp}`)
                : avatarUrl;

            const responseData = {
                id: user?._id.toString(),
                username: user?.username,
                email: user?.email,
                name: user?.name || user?.full_name || '',
                bio: user?.bio || '',
                links: user?.links || [],
                avatar: avatarWithTimestamp,
                avatar_url: avatarWithTimestamp,
                website: user?.website || '',
                location: user?.location || '',
                followers: user?.followers_count || user?.followers || 0,
                following: user?.following_count || user?.following || 0,
                verified: user?.is_verified || user?.verified || false,
                posts_count: user?.posts_count || 0
            }

            console.log('[Backend] ✅ Sending success response:', responseData);
            return res.json(responseData);
        } catch (updateError) {
            console.error('[Backend] Error updating user:', updateError);
            return res.status(500).json({ message: 'Failed to update profile' })
        }
    } catch (error: any) {
        console.error('Update profile error:', error)
        return res.status(500).json({ message: error.message || 'Failed to update profile' })
    }
})

// GET /api/users/sent-requests - Get all pending follow requests sent by current user
router.get('/sent-requests', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const db = await getDatabase()

        const requests = await db.collection('follows').find({
            follower_id: new ObjectId(currentUserId),
            status: 'pending'
        }).toArray()

        const requestedIds = requests.map(r => r.following_id.toString())

        return res.json({
            success: true,
            data: requestedIds
        })
    } catch (error: any) {
        console.error('Get sent requests error:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get sent requests'
        })
    }
})

// GET /api/users/search - Search users
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q } = req.query

        if (!q) {
            return res.status(400).json({ message: 'Search query required' })
        }

        const db = await getDatabase()

        const users = await db.collection('users').find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } }
            ]
        }).limit(20).toArray()
        return res.json(users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            avatar: user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            verified: user.verified || false,
            is_private: user.is_private || false
        })))
    } catch (error: any) {
        console.error('Search users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to search users' })
    }
})

// POST /api/users/:userId/follow - Follow/Unfollow user (with private account support)
router.post('/:userId/follow', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot follow yourself' })
        }

        const db = await getDatabase()

        // Check current follow status
        const existingFollow = await db.collection('follows').findOne({
            follower_id: new ObjectId(currentUserId),
            following_id: new ObjectId(userId)
        })

        if (existingFollow) {
            // UNFOLLOW
            await UserService.unfollowUser(currentUserId, userId);

            // Get updated count
            const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });

            return res.json({
                message: 'Unfollowed successfully',
                isFollowing: false,
                isPending: false,
                followRequestStatus: 'none',
                followerCount: targetUser?.followers_count || 0,
                isMutualFollow: false
            })
        } else {
            // FOLLOW
            const result = await UserService.followUser(currentUserId, userId);

            // Get target user for updated counts
            const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });

            // Check if this creates a mutual follow
            const reverseFollow = await db.collection('follows').findOne({
                follower_id: new ObjectId(userId),
                following_id: new ObjectId(currentUserId),
                status: 'active'
            })

            return res.json({
                message: result.status === 'pending' ? 'Follow request sent' : 'Followed successfully',
                isFollowing: result.is_following,
                isPending: result.is_pending,
                followRequestStatus: result.status === 'active' ? 'approved' : 'pending',
                followerCount: targetUser?.followers_count || 0,
                isMutualFollow: !!reverseFollow
            })
        }
    } catch (error: any) {
        console.error('Follow error:', error)
        return res.status(error.status || 500).json({ message: error.message || 'Failed to follow user' })
    }
})

// GET /api/users/:userId/follow-status - Check follow status and mutual follow
router.get('/:userId/follow-status', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        const db = await getDatabase()

        // Check if current user follows target user
        const isFollowing = await db.collection('follows').findOne({
            follower_id: new ObjectId(currentUserId),
            following_id: new ObjectId(userId)
        })

        // Check if target user follows current user
        const followsBack = await db.collection('follows').findOne({
            follower_id: new ObjectId(userId),
            following_id: new ObjectId(currentUserId)
        })

        // Check for pending follow request
        const pendingRequest = await db.collection('follows').findOne({
            follower_id: new ObjectId(currentUserId),
            following_id: new ObjectId(userId),
            status: 'pending'
        })
        return res.json({
            isFollowing: !!isFollowing,
            isPending: !!pendingRequest,
            followsBack: !!followsBack,
            isMutualFollow: !!isFollowing && !!followsBack
        })
    } catch (error: any) {
        console.error('Follow status error:', error)
        return res.status(error.status || 500).json({ message: error.message || 'Failed to check follow status' })
    }
})

// GET /api/users/follow-requests - Get pending follow requests
router.get('/follow-requests', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const requests = await db.collection('follows').aggregate([
            { $match: { following_id: new ObjectId(userId), status: 'pending' } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'follower_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 1,
                    follower_id: 1,
                    created_at: 1,
                    user: {
                        _id: '$user._id',
                        username: '$user.username',
                        fullName: { $ifNull: ['$user.full_name', '$user.name'] },
                        avatar: { $ifNull: ['$user.avatar_url', '$user.avatar'] }
                    }
                }
            }
        ]).toArray()

        return res.json({ success: true, data: requests })
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
})

// POST /api/users/follow-requests/:followerId/accept - Accept follow request
router.post('/follow-requests/:followerId/accept', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { followerId } = req.params

        await UserService.acceptFollowRequest(userId, followerId)

        return res.json({ success: true, message: 'Follow request accepted' })
    } catch (error: any) {
        return res.status(error.status || 500).json({ success: false, message: error.message })
    }
})

// POST /api/users/follow-requests/:followerId/reject - Reject follow request
router.post('/follow-requests/:followerId/reject', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { followerId } = req.params

        await UserService.rejectFollowRequest(userId, followerId)

        return res.json({ success: true, message: 'Follow request rejected' })
    } catch (error: any) {
        return res.status(error.status || 500).json({ success: false, message: error.message })
    }
})

// DELETE /api/users/:userId/follow - Unfollow user
router.delete('/:userId/follow', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        const db = await getDatabase()

        // Remove from following
        await db.collection('follows').deleteOne({
            follower_id: new ObjectId(currentUserId),
            following_id: new ObjectId(userId)
        })

        // Update counts
        await db.collection('users').updateOne(
            { _id: new ObjectId(currentUserId) },
            { $inc: { following: -1 } }
        )
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $inc: { followers: -1 } }
        )
        return res.json({ message: 'Unfollowed successfully' })
    } catch (error: any) {
        console.error('Unfollow error:', error)
        return res.status(500).json({ message: error.message || 'Failed to unfollow user' })
    }
})

// GET /api/users/:userId/followers - Get user followers
router.get('/:userId/followers', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const currentUserId = req.userId // From auth middleware
        console.log('[FOLLOWERS] Fetching followers for user:', userId)

        // Try cache first
        const cacheKey = `followers:${userId}`
        const cached = await cacheGet(cacheKey)
        if (cached) {
            console.log(`✅ Cache hit for followers: ${userId}`)
            return res.json(cached)
        }

        const db = await getDatabase()

        // Check if target user is private
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' })
        }

        const isPrivate = targetUser.is_private || false
        const isOwnProfile = currentUserId && (
            currentUserId === userId ||
            currentUserId.toString() === userId.toString() ||
            new ObjectId(currentUserId).equals(new ObjectId(userId))
        )

        console.log('[FOLLOWERS] Privacy check:', {
            isPrivate,
            isOwnProfile,
            currentUserId: currentUserId?.toString(),
            userId: userId?.toString()
        })

        // If private account, check if current user is following
        if (isPrivate && !isOwnProfile) {
            if (!currentUserId) {
                return res.status(403).json({ message: 'This account is private' })
            }

            const isFollowing = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(userId),
                status: 'accepted'
            })

            if (!isFollowing) {
                return res.status(403).json({ message: 'This account is private' })
            }
        }

        const follows = await db.collection('follows').find({
            following_id: new ObjectId(userId),
            status: 'accepted'
        }).toArray()

        console.log('[FOLLOWERS] Found', follows.length, 'follow records')

        const followerIds = follows.map(f => f.follower_id)
        const followers = await db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray()

        console.log('[FOLLOWERS] Found', followers.length, 'user records')

        // Check which followers the current user is following back
        const currentUserFollowing = currentUserId ? await db.collection('follows').find({
            follower_id: new ObjectId(currentUserId),
            status: 'accepted'
        }).toArray() : []

        const followingIds = new Set(currentUserFollowing.map(f => f.following_id.toString()))
        const result = followers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || null,
            is_private: user.is_private || false,
            isFollowing: followingIds.has(user._id.toString())
        }))

        console.log('[FOLLOWERS] Returning', result.length, 'followers')

        const response = { data: result }

        // Cache for 10 minutes (600 seconds)
        await cacheSet(cacheKey, response, 600)

        return res.json(response)
    } catch (error: any) {
        console.error('Get followers error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get followers' })
    }
})

// DEBUG: Check follower data integrity
router.get('/:userId/followers/debug', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params
        const db = await getDatabase()

        // Get all follow records
        const follows = await db.collection('follows').find({
            following_id: new ObjectId(userId)
        }).toArray()

        // Get follower IDs
        const followerIds = follows.map(f => f.follower_id)

        // Get users
        const users = await db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray()

        // Get user's profile
        const userProfile = await db.collection('users').findOne({
            _id: new ObjectId(userId)
        })
        return res.json({
            userId,
            followRecordsCount: follows.length,
            followRecords: follows.map(f => ({
                follower_id: f.follower_id.toString(),
                following_id: f.following_id.toString(),
                createdAt: f.createdAt
            })),
            followerIdsFound: followerIds.map(id => id.toString()),
            usersFoundCount: users.length,
            usersFound: users.map(u => ({
                id: u._id.toString(),
                username: u.username,
                name: u.name || u.full_name
            })),
            userProfileFollowersCount: userProfile?.followers || 0,
            userProfileFollowingCount: userProfile?.following || 0
        })
    } catch (error: any) {
        console.error('Debug followers error:', error)
        return res.status(500).json({ message: error.message })
    }
})

// GET /api/users/:userId/following - Get user following
router.get('/:userId/following', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const currentUserId = req.userId // From auth middleware

        const db = await getDatabase()

        // Check if target user is private
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' })
        }

        const isPrivate = targetUser.is_private || false
        const isOwnProfile = currentUserId && (
            currentUserId === userId ||
            currentUserId.toString() === userId.toString() ||
            new ObjectId(currentUserId).equals(new ObjectId(userId))
        )

        console.log('[FOLLOWING] Privacy check:', {
            isPrivate,
            isOwnProfile,
            currentUserId: currentUserId?.toString(),
            userId: userId?.toString()
        })

        // If private account, check if current user is following
        if (isPrivate && !isOwnProfile) {
            if (!currentUserId) {
                return res.status(403).json({ message: 'This account is private' })
            }

            const isFollowing = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(userId),
                status: 'accepted'
            })

            if (!isFollowing) {
                return res.status(403).json({ message: 'This account is private' })
            }
        }

        const follows = await db.collection('follows').find({
            follower_id: new ObjectId(userId),
            status: 'accepted'
        }).toArray()

        const followingIds = follows.map(f => f.following_id)
        const following = await db.collection('users').find({
            _id: { $in: followingIds }
        }).toArray()

        // For following list, all users are already being followed (isFollowing = true)
        // This is because we're showing who the user is following
        const result = following.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || null,
            is_private: user.is_private || false,
            isFollowing: true // Always true in following list
        }))

        return res.json({ data: result })
    } catch (error: any) {
        console.error('Get following error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get following' })
    }
})

// DELETE /api/users/delete - Delete user account
router.delete('/delete', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId

        const db = await getDatabase()

        // Delete user
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) })

        // Delete user's posts
        await db.collection('posts').deleteMany({ userId: new ObjectId(userId) })

        // Delete user's follows
        await db.collection('follows').deleteMany({
            $or: [
                { follower_id: new ObjectId(userId) },
                { following_id: new ObjectId(userId) }
            ]
        })
        return res.json({ message: 'Account deleted successfully' })
    } catch (error: any) {
        console.error('Delete account error:', error)
        return res.status(500).json({ message: error.message || 'Failed to delete account' })
    }
})

// GET /api/users/blocked - Get blocked users
router.get('/blocked', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const blocks = await db.collection('blocked_users').find({
            userId: new ObjectId(userId)
        }).toArray()

        const blockedIds = blocks.map(b => b.blockedUserId)
        const blockedUsers = await db.collection('users').find({
            _id: { $in: blockedIds }
        }).toArray()

        return res.json({
            blocked: blockedUsers.map(user => ({
                id: user._id.toString(),
                username: user.username,
                name: user.full_name || user.name || '',
                avatar: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                verified: user.is_verified || user.verified || false
            }))
        })
    } catch (error: any) {
        console.error('Get blocked users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get blocked users' })
    }
})

// POST /api/users/:userId/block - Block/Unblock user
router.post('/:userId/block', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot block yourself' })
        }

        const db = await getDatabase()
        const targetUserId = new ObjectId(userId)

        // Check if already blocked
        const existingBlock = await db.collection('blocked_users').findOne({
            userId: new ObjectId(currentUserId),
            blockedUserId: targetUserId
        })

        if (existingBlock) {
            // Unblock
            await db.collection('blocked_users').deleteOne({
                userId: new ObjectId(currentUserId),
                blockedUserId: targetUserId
            })
            return res.json({ message: 'User unblocked', isBlocked: false })
        } else {
            // Block
            await db.collection('blocked_users').insertOne({
                userId: new ObjectId(currentUserId),
                blockedUserId: targetUserId,
                createdAt: new Date()
            })

            // 🛡️ Count active follows BEFORE deletion (for counter correction)
            const activeFollows = await db.collection('follows').find({
                $or: [
                    { follower_id: new ObjectId(currentUserId), following_id: targetUserId, status: 'active' },
                    { follower_id: targetUserId, following_id: new ObjectId(currentUserId), status: 'active' }
                ]
            }).toArray();

            // Also unfollow automatically
            await db.collection('follows').deleteMany({
                $or: [
                    { follower_id: new ObjectId(currentUserId), following_id: targetUserId },
                    { follower_id: targetUserId, following_id: new ObjectId(currentUserId) }
                ]
            })

            // Correct follower/following counts for each active follow removed
            for (const f of activeFollows) {
                await db.collection('users').updateOne(
                    { _id: f.follower_id }, { $inc: { following_count: -1 } }
                );
                await db.collection('users').updateOne(
                    { _id: f.following_id }, { $inc: { followers_count: -1 } }
                );
            }

            return res.json({ message: 'User blocked', isBlocked: true })
        }
    } catch (error: any) {
        console.error('Block user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to block user' })
    }
})

// GET /api/users/restricted - Get restricted users
router.get('/restricted', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const restrictions = await db.collection('restricted_users').find({
            userId: new ObjectId(userId)
        }).toArray()

        const restrictedIds = restrictions.map(r => r.restrictedUserId)
        const restrictedUsers = await db.collection('users').find({
            _id: { $in: restrictedIds }
        }).toArray()

        return res.json({
            restricted: restrictedUsers.map(user => ({
                id: user._id.toString(),
                username: user.username,
                name: user.full_name || user.name || '',
                avatar: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                verified: user.is_verified || user.verified || false
            }))
        })
    } catch (error: any) {
        console.error('Get restricted users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get restricted users' })
    }
})

// POST /api/users/:userId/restrict - Restrict/Unrestrict user
router.post('/:userId/restrict', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot restrict yourself' })
        }

        const db = await getDatabase()
        const targetUserId = new ObjectId(userId)

        // Check if already restricted
        const existingRestriction = await db.collection('restricted_users').findOne({
            userId: new ObjectId(currentUserId),
            restrictedUserId: targetUserId
        })

        if (existingRestriction) {
            // Unrestrict
            await db.collection('restricted_users').deleteOne({
                userId: new ObjectId(currentUserId),
                restrictedUserId: targetUserId
            })
            return res.json({ message: 'User unrestricted', isRestricted: false })
        } else {
            // Restrict
            await db.collection('restricted_users').insertOne({
                userId: new ObjectId(currentUserId),
                restrictedUserId: targetUserId,
                createdAt: new Date()
            })
            return res.json({ message: 'User restricted', isRestricted: true })
        }
    } catch (error: any) {
        console.error('Restrict user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to restrict user' })
    }
})



// GET /api/users/:userId/posts - Get user's posts (supports both userId and username)
router.get('/:userId/posts', async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 20
        const offset = (page - 1) * limit



        const db = await getDatabase()

        // Check if userId is an ObjectId or username
        let userObjectId: ObjectId
        let targetUser: any
        if (ObjectId.isValid(userId) && userId.length === 24) {
            // It's a valid ObjectId
            userObjectId = new ObjectId(userId)
            targetUser = await db.collection('users').findOne({ _id: userObjectId })
        } else {
            // It's a username, look up the user
            targetUser = await db.collection('users').findOne({ username: userId })
            if (!targetUser) {
                return res.status(404).json({ success: false, message: 'User not found' })
            }
            userObjectId = targetUser._id
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }

        // Get current user ID from token (optional)
        let currentUserId = null
        try {
            const authHeader = req.headers.authorization
            const token = authHeader && authHeader.split(' ')[1]
            if (token) {
                const decoded = jwt.verify(token, JWT_SECRET) as any
                currentUserId = decoded.userId
            }
        } catch (err) {
            // Token is optional
        }

        // PRIVACY CHECK: If account is private and viewer is not following, return empty
        const isOwnProfile = currentUserId && currentUserId === userObjectId.toString()
        const isPrivate = targetUser.is_private || false

        if (isPrivate && !isOwnProfile) {
            // Check if current user is following
            const isFollowing = currentUserId ? await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: userObjectId,
                status: 'accepted'
            }) : null

            if (!isFollowing) {
                // Private account and not following - return empty
                return res.json({
                    success: true,
                    data: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                        hasMore: false
                    },
                    message: 'This account is private'
                })
            }
        }

        // Use PostService to get posts (handles caching and enrichment efficiently)
        const result = await PostService.getUserPosts(
            userObjectId.toString(),
            currentUserId,
            page,
            limit
        )

        return res.json(result)
    } catch (error: any) {
        console.error('Get user posts error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user posts' })
    }
})

// POST /api/users/conversations - Create conversation with Instagram-style rules
router.post('/conversations', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { recipientId } = req.body

        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient ID is required' })
        }

        if (currentUserId === recipientId) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' })
        }

        const db = await getDatabase()

        // Get both users
        const [currentUser, recipient] = await Promise.all([
            db.collection('users').findOne({ _id: new ObjectId(currentUserId) }),
            db.collection('users').findOne({ _id: new ObjectId(recipientId) })
        ])

        if (!recipient) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Check follow status
        const [userFollowsRecipient, recipientFollowsUser] = await Promise.all([
            db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(recipientId)
            }),
            db.collection('follows').findOne({
                follower_id: new ObjectId(recipientId),
                following_id: new ObjectId(currentUserId)
            })
        ])

        const currentUserIsPrivate = currentUser?.is_private || false
        const recipientIsPrivate = recipient.is_private || false
        const isMutualFollow = !!userFollowsRecipient && !!recipientFollowsUser

        // Instagram-style messaging rules:
        // 1. Both accounts public → can message
        // 2. Mutual followers → can message
        // 3. One follows but not mutual → goes to message requests
        // 4. Private account not following → cannot message (need follow request first)

        let canMessage = false
        let isMessageRequest = false
        let reason = ''

        if (isMutualFollow) {
            // Rule 1: Mutual followers can always message
            canMessage = true
        } else if (!recipientIsPrivate && !currentUserIsPrivate) {
            // Rule 2: Both public accounts can message
            canMessage = true
        } else if (userFollowsRecipient && !recipientFollowsUser) {
            // Rule 3: User follows recipient but not mutual → message request
            canMessage = true
            isMessageRequest = true
            reason = 'Message will go to recipient\'s message requests'
        } else if (!userFollowsRecipient && recipientIsPrivate) {
            // Rule 4: Recipient is private and user doesn't follow → need follow request first
            canMessage = false
            reason = 'You need to follow this user first to send messages'
        } else {
            // Default: allow but as message request
            canMessage = true
            isMessageRequest = true
            reason = 'Message will go to recipient\'s message requests'
        }

        if (!canMessage) {
            return res.status(403).json({
                message: reason,
                canMessage: false,
                isMessageRequest: false
            })
        }

        // Return success - conversation will be created in Firebase
        return res.json({
            message: isMessageRequest ? reason : 'Can send message',
            canMessage: true,
            isMessageRequest,
            isMutualFollow,
            conversationId: `${[currentUserId, recipientId].sort().join('_')}`,
            recipientId
        })
    } catch (error: any) {
        console.error('Conversation creation error:', error)
        return res.status(500).json({ message: error.message || 'Failed to create conversation' })
    }
})

// GET /api/users/message-requests - Get message requests
router.get('/message-requests', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        // Get message requests where user is recipient and not mutual followers
        const requests = await db.collection('message_requests').find({
            recipientId: new ObjectId(userId),
            status: 'pending'
        }).sort({ createdAt: -1 }).toArray()

        // Get sender details
        const senderIds = requests.map(r => r.senderId)
        const senders = await db.collection('users').find({
            _id: { $in: senderIds }
        }).project({ password: 0 }).toArray()

        const sendersMap = new Map(senders.map(s => [s._id.toString(), s]))

        const formattedRequests = requests.map(req => ({
            id: req._id.toString(),
            senderId: req.senderId.toString(),
            sender: {
                _id: sendersMap.get(req.senderId.toString())?._id.toString(),
                username: sendersMap.get(req.senderId.toString())?.username,
                fullName: sendersMap.get(req.senderId.toString())?.full_name,
                profileImage: sendersMap.get(req.senderId.toString())?.avatar_url
            },
            conversationId: req.conversationId,
            lastMessage: req.lastMessage,
            createdAt: req.createdAt
        }))

        return res.json({
            success: true,
            data: formattedRequests
        })
    } catch (error: any) {
        console.error('Get message requests error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get message requests' })
    }
})

// POST /api/users/message-requests/:requestId/accept - Accept message request (auto follow back)
router.post('/message-requests/:requestId/accept', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { requestId } = req.params
        const db = await getDatabase()

        const request = await db.collection('message_requests').findOne({
            _id: new ObjectId(requestId),
            recipientId: new ObjectId(userId)
        })

        if (!request) {
            return res.status(404).json({ message: 'Message request not found' })
        }

        // Accept request
        await db.collection('message_requests').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'accepted', acceptedAt: new Date() } }
        )

        // Auto follow back
        const existingFollow = await db.collection('follows').findOne({
            follower_id: new ObjectId(userId),
            following_id: request.senderId
        })

        if (!existingFollow) {
            await db.collection('follows').insertOne({
                follower_id: new ObjectId(userId),
                following_id: request.senderId,
                createdAt: new Date()
            })
        }

        return res.json({
            success: true,
            message: 'Message request accepted and followed back'
        })
    } catch (error: any) {
        console.error('Accept message request error:', error)
        return res.status(500).json({ message: error.message || 'Failed to accept message request' })
    }
})

// DELETE /api/users/message-requests/:requestId - Delete message request
router.delete('/message-requests/:requestId', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { requestId } = req.params
        const db = await getDatabase()

        const result = await db.collection('message_requests').deleteOne({
            _id: new ObjectId(requestId),
            recipientId: new ObjectId(userId)
        })

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Message request not found' })
        }

        return res.json({
            success: true,
            message: 'Message request deleted'
        })
    } catch (error: any) {
        console.error('Delete message request error:', error)
        return res.status(500).json({ message: error.message || 'Failed to delete message request' })
    }
})

// POST /api/users/message-requests/:requestId/block - Block user from message request
router.post('/message-requests/:requestId/block', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { requestId } = req.params
        const db = await getDatabase()

        const request = await db.collection('message_requests').findOne({
            _id: new ObjectId(requestId),
            recipientId: new ObjectId(userId)
        })

        if (!request) {
            return res.status(404).json({ message: 'Message request not found' })
        }

        // Block user
        await db.collection('blocked_users').insertOne({
            userId: new ObjectId(userId),
            blockedUserId: request.senderId,
            createdAt: new Date()
        })

        // Delete message request
        await db.collection('message_requests').deleteOne({
            _id: new ObjectId(requestId)
        })

        // Remove any follows
        await db.collection('follows').deleteMany({
            $or: [
                { follower_id: new ObjectId(userId), following_id: request.senderId },
                { follower_id: request.senderId, following_id: new ObjectId(userId) }
            ]
        })

        return res.json({
            success: true,
            message: 'User blocked'
        })
    } catch (error: any) {
        console.error('Block user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to block user' })
    }
})

// POST /api/users/message-requests/:requestId/report - Report user from message request
router.post('/message-requests/:requestId/report', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { requestId } = req.params
        const { reason } = req.body
        const db = await getDatabase()

        const request = await db.collection('message_requests').findOne({
            _id: new ObjectId(requestId),
            recipientId: new ObjectId(userId)
        })

        if (!request) {
            return res.status(404).json({ message: 'Message request not found' })
        }

        // Create report
        await db.collection('reports').insertOne({
            reporterId: new ObjectId(userId),
            reportedUserId: request.senderId,
            type: 'message_request',
            reason: reason || 'Inappropriate message',
            messageRequestId: new ObjectId(requestId),
            createdAt: new Date(),
            status: 'pending'
        })

        // Delete message request
        await db.collection('message_requests').deleteOne({
            _id: new ObjectId(requestId)
        })

        return res.json({
            success: true,
            message: 'User reported'
        })
    } catch (error: any) {
        console.error('Report user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to report user' })
    }
})

// PUT /api/users/privacy - Update account privacy
router.put('/privacy', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { isPrivate } = req.body
        const db = await getDatabase()

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { is_private: !!isPrivate, updatedAt: new Date() } }
        )

        return res.json({
            success: true,
            message: 'Privacy settings updated',
            isPrivate: !!isPrivate
        })
    } catch (error: any) {
        console.error('Update privacy error:', error)
        return res.status(500).json({ message: error.message || 'Failed to update privacy' })
    }
})

// GET /api/users/follow-requests - Get pending follow requests (received)
router.get('/follow-requests', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const db = await getDatabase()

        const requests = await db.collection('followRequests').find({
            requested_id: new ObjectId(currentUserId),
            status: 'pending'
        }).sort({ created_at: -1 }).toArray()

        // Get requester details
        const requesterIds = requests.map(r => r.requester_id)
        const requesters = await db.collection('users').find({
            _id: { $in: requesterIds }
        }).project({
            password: 0
        }).toArray()

        // Map requests with user data
        const formattedRequests = requests.map(req => {
            const requester = requesters.find(u => u._id.toString() === req.requester_id.toString())
            return {
                id: req._id.toString(),
                requester: {
                    id: requester?._id.toString(),
                    username: requester?.username,
                    full_name: requester?.full_name || requester?.name,
                    avatar_url: requester?.avatar_url || requester?.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                    is_verified: requester?.is_verified || false,
                    badge_type: requester?.badge_type
                },
                created_at: req.created_at,
                status: req.status
            }
        })

        return res.json({
            success: true,
            data: formattedRequests,
            count: formattedRequests.length
        })
    } catch (error: any) {
        console.error('Get follow requests error:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get follow requests'
        })
    }
})

// POST /api/users/follow-requests/:requestId/approve - Approve follow request
router.post('/follow-requests/:requestId/approve', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { requestId } = req.params
        const db = await getDatabase()

        // Find the request
        const request = await db.collection('followRequests').findOne({
            _id: new ObjectId(requestId),
            requested_id: new ObjectId(currentUserId),
            status: 'pending'
        })

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Follow request not found or already processed'
            })
        }

        // Update request status
        await db.collection('followRequests').updateOne(
            { _id: new ObjectId(requestId) },
            {
                $set: {
                    status: 'approved',
                    updated_at: new Date()
                }
            }
        )

        // Create follow relationship
        await db.collection('follows').insertOne({
            follower_id: request.requester_id,
            following_id: request.requested_id,
            status: 'accepted',
            createdAt: new Date()
        })

        // Update follower counts (ACCEPTED ONLY)
        const followerCount = await db.collection('follows').countDocuments({
            following_id: new ObjectId(currentUserId),
            status: 'accepted'
        })

        // Send notification
        try {
            const { notifyFollowRequestAccepted } = require('../lib/notifications');
            await notifyFollowRequestAccepted(request.requester_id.toString(), currentUserId);
        } catch (err) {
            console.error('[FOLLOW REQUEST] Notification error:', err);
        }

        return res.json({
            success: true,
            message: 'Follow request approved',
            followerCount
        })
    } catch (error: any) {
        console.error('Approve follow request error:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve follow request'
        })
    }
})

// POST /api/users/follow-requests/:requestId/decline - Decline follow request
router.post('/follow-requests/:requestId/decline', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { requestId } = req.params
        const db = await getDatabase()

        // Find the request
        const request = await db.collection('followRequests').findOne({
            _id: new ObjectId(requestId),
            requested_id: new ObjectId(currentUserId),
            status: 'pending'
        })

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Follow request not found or already processed'
            })
        }

        // Update request status to declined
        await db.collection('followRequests').updateOne(
            { _id: new ObjectId(requestId) },
            {
                $set: {
                    status: 'declined',
                    updated_at: new Date()
                }
            }
        )

        return res.json({
            success: true,
            message: 'Follow request declined'
        })
    } catch (error: any) {
        console.error('Decline follow request error:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to decline follow request'
        })
    }
})

// GET /api/users/:userId/follow-request-status - Check follow request status
router.get('/:userId/follow-request-status', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params
        const db = await getDatabase()

        // Check for pending request
        const request = await db.collection('followRequests').findOne({
            requester_id: new ObjectId(currentUserId),
            requested_id: new ObjectId(userId),
            status: 'pending'
        })

        if (request) {
            return res.json({
                success: true,
                isPending: true,
                status: 'pending',
                requestId: request._id.toString()
            })
        }

        return res.json({
            success: true,
            isPending: false,
            status: 'none'
        })
    } catch (error: any) {
        console.error('Check follow request status error:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to check follow request status'
        })
    }
})

// POST /api/users/push-token - Register push notification token
router.post('/push-token', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { token, platform } = req.body

        if (!token) {
            return res.status(400).json({ message: 'Push token is required' })
        }

        console.log('[PUSH TOKEN] Registering token for user:', userId, 'Platform:', platform)

        const db = await getDatabase()

        // Update user's push token
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    pushToken: token,
                    pushTokenPlatform: platform || 'unknown',
                    pushTokenUpdatedAt: new Date()
                }
            }
        )

        console.log('[PUSH TOKEN] ✅ Token registered successfully')

        return res.json({
            success: true,
            message: 'Push token registered successfully'
        })
    } catch (error: any) {
        console.error('[PUSH TOKEN] ❌ Error registering token:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to register push token'
        })
    }
})

// POST /api/users/fcm-token - Register FCM token for push notifications
router.post('/fcm-token', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { fcmToken } = req.body

        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' })
        }

        console.log('[FCM] Registering token for user:', userId)

        const db = await getDatabase()

        // Update user's FCM token
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    fcmToken: fcmToken,
                    fcmTokenUpdatedAt: new Date()
                }
            }
        )

        console.log('[FCM] ✅ Token registered successfully')

        return res.json({
            success: true,
            message: 'FCM token registered successfully'
        })
    } catch (error: any) {
        console.error('[FCM] ❌ Error registering token:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to register FCM token'
        })
    }
})

// DELETE /api/users/fcm-token - Unregister FCM token
router.delete('/fcm-token', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId

        console.log('[FCM] Unregistering token for user:', userId)

        const db = await getDatabase()

        // Remove user's FCM token
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    fcmToken: null,
                    fcmTokenUpdatedAt: new Date()
                }
            }
        )

        console.log('[FCM] ✅ Token unregistered successfully')

        return res.json({
            success: true,
            message: 'FCM token unregistered successfully'
        })
    } catch (error: any) {
        console.error('[FCM] ❌ Error unregistering token:', error)
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to unregister FCM token'
        })
    }
})

// DELETE /api/users/delete - Delete account and all data
router.delete('/delete', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { password } = req.body
        const db = await getDatabase()

        // 1. Verify user exists and password is correct
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Incorrect password' })
        }

        console.log(`[DELETE ACCOUNT] Starting cleanup for user: ${userId} (${user.username})`)

        const userObjectId = new ObjectId(userId)

        // 2. Delete all user-generated content and interactions
        await Promise.all([
            // Content
            db.collection('posts').deleteMany({ userId: userObjectId }),
            db.collection('stories').deleteMany({ userId: userObjectId }),
            db.collection('reels').deleteMany({ userId: userObjectId }),

            // Interactions
            db.collection('likes').deleteMany({ userId: userObjectId }),
            db.collection('comments').deleteMany({ userId: userObjectId }),
            db.collection('bookmarks').deleteMany({ userId: userObjectId }),

            // Relationships
            db.collection('follows').deleteMany({
                $or: [{ follower_id: userObjectId }, { following_id: userObjectId }]
            }),
            db.collection('blocked_users').deleteMany({
                $or: [{ userId: userObjectId }, { blockedUserId: userObjectId }]
            }),
            db.collection('restricted_users').deleteMany({
                $or: [{ userId: userObjectId }, { restrictedUserId: userObjectId }]
            }),
            db.collection('muted_users').deleteMany({
                $or: [{ userId: userObjectId }, { mutedUserId: userObjectId }]
            }),
            db.collection('close_friends').deleteMany({ user_id: userObjectId }),

            // Notifications
            db.collection('notifications').deleteMany({
                $or: [{ userId: userObjectId }, { senderId: userObjectId }]
            }),

            // Activity & Analytics
            db.collection('login_activity').deleteMany({ userId: userObjectId }),
            db.collection('user_time_spent').deleteMany({ userId: userObjectId }),

            // Messages (This is complex, usually we mark them as "Deleted User")
            db.collection('messages').deleteMany({
                $or: [{ senderId: userObjectId }, { receiverId: userObjectId }]
            }),
            db.collection('message_requests').deleteMany({
                $or: [{ senderId: userObjectId }, { recipientId: userObjectId }]
            })
        ])

        // 3. Finally delete the user itself
        await db.collection('users').deleteOne({ _id: userObjectId })

        console.log(`[DELETE ACCOUNT] Cleanup complete for user: ${userId}`)

        return res.json({ message: 'Account and all data deleted successfully' })
    } catch (error: any) {
        console.error('Delete account error:', error)
        return res.status(500).json({ message: error.message || 'Failed to delete account' })
    }
})

// POST /api/users/me/contact - Update email or phone with verification
router.post('/me/contact', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { verificationToken, email, phone } = req.body;

        if (!verificationToken) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        if (!email && !phone) {
            return res.status(400).json({ message: 'Email or phone is required' });
        }

        // Verify the token
        let decoded: any;
        try {
            decoded = jwt.verify(verificationToken, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ message: 'Invalid or expired verification token' });
        }

        if (decoded.userId !== userId || decoded.scope !== 'update_contact') {
            return res.status(403).json({ message: 'Invalid verification token' });
        }

        const db = await getDatabase();
        const updateData: any = { updated_at: new Date() };

        if (email) {
            // Check if email is already taken
            const existingUser = await db.collection('users').findOne({
                email,
                _id: { $ne: new ObjectId(userId) }
            });
            if (existingUser) {
                return res.status(400).json({ message: 'Email is already taken' });
            }
            updateData.email = email;
        }

        if (phone) {
            // Check if phone is already taken
            const existingUser = await db.collection('users').findOne({
                phone,
                _id: { $ne: new ObjectId(userId) }
            });
            if (existingUser) {
                return res.status(400).json({ message: 'Phone number is already taken' });
            }
            updateData.phone = phone;
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        // Invalidate cache
        await cacheInvalidate(`userProfile:${userId}`);

        return res.json({ message: 'Contact information updated successfully' });

    } catch (error: any) {
        console.error('Update contact error:', error);
        return res.status(500).json({ message: 'Failed to update contact information' });
    }
});

export default router


// POST /api/users/change-password - Change password
router.post('/change-password', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' })
        }

        const db = await getDatabase()
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Verify current password
        const bcrypt = require('bcryptjs')
        const isValid = await bcrypt.compare(currentPassword, user.password)

        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' })
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        // Update password
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    password: hashedPassword,
                    updatedAt: new Date()
                }
            }
        )

        return res.json({ message: 'Password changed successfully' })
    } catch (error: any) {
        console.error('Change password error:', error)
        return res.status(500).json({ message: error.message || 'Failed to change password' })
    }
})

// GET /api/users/muted - Get muted users
router.get('/muted', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        // Get muted user IDs
        const mutedRecords = await db.collection('muted').find({
            userId: new ObjectId(userId)
        }).toArray()

        const mutedUserIds = mutedRecords.map(r => r.mutedUserId)

        // Get user details
        const users = await db.collection('users').find({
            _id: { $in: mutedUserIds }
        }).project({
            password: 0
        }).toArray()

        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.full_name || user.name || '',
            avatar: user.avatar_url || user.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            verified: user.is_verified || user.verified || false
        }))

        return res.json({ muted: formattedUsers })
    } catch (error: any) {
        console.error('Get muted users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get muted users' })
    }
})

// POST /api/users/:userId/mute - Mute/Unmute user
router.post('/:userId/mute', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot mute yourself' })
        }

        const db = await getDatabase()

        // Check if already muted
        const existingMute = await db.collection('muted').findOne({
            userId: new ObjectId(currentUserId),
            mutedUserId: new ObjectId(userId)
        })

        if (existingMute) {
            // Unmute
            await db.collection('muted').deleteOne({
                userId: new ObjectId(currentUserId),
                mutedUserId: new ObjectId(userId)
            })

            return res.json({ message: 'User unmuted', isMuted: false })
        } else {
            // Mute
            await db.collection('muted').insertOne({
                userId: new ObjectId(currentUserId),
                mutedUserId: new ObjectId(userId),
                createdAt: new Date()
            })

            return res.json({ message: 'User muted', isMuted: true })
        }
    } catch (error: any) {
        console.error('Mute user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to mute user' })
    }
})

// GET /api/users/login-activity - Get login activity
router.get('/login-activity', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDatabase()

        const activity = await db.collection('loginActivity').find({
            userId: new ObjectId(userId)
        }).sort({ timestamp: -1 }).limit(10).toArray()

        const formattedActivity = activity.map(a => ({
            device: a.device || 'Unknown Device',
            location: a.location || 'Unknown Location',
            timestamp: a.timestamp,
            ipAddress: a.ipAddress
        }))

        return res.json({ activity: formattedActivity })
    } catch (error: any) {
        console.error('Get login activity error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get login activity' })
    }
})

// PATCH /api/users/me - Update user profile (new endpoint)
router.patch('/me', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { name, username, email, bio, website, gender, birthday, location } = req.body

        const db = await getDatabase()

        const updateData: any = { updatedAt: new Date() }
        if (name !== undefined) {
            updateData.name = name
            updateData.full_name = name
        }
        if (username !== undefined) {
            // Check if username is taken
            const existingUser = await db.collection('users').findOne({
                username,
                _id: { $ne: new ObjectId(userId) }
            })
            if (existingUser) {
                return res.status(400).json({ message: 'Username is already taken' })
            }
            updateData.username = username
        }
        // Email is non-editable for security reasons
        // if (email !== undefined) updateData.email = email
        if (bio !== undefined) updateData.bio = bio
        if (website !== undefined) updateData.website = website
        if (gender !== undefined) updateData.gender = gender
        if (birthday !== undefined) updateData.birthday = birthday
        if (location !== undefined) updateData.location = location
        if (req.body.phone !== undefined) updateData.phone = req.body.phone
        if (req.body.address !== undefined) {
            updateData.address = req.body.address
            updateData.location = req.body.address // Sync for compatibility
        }


        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        )

        const updatedUser = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } }
        )

        return res.json({
            id: updatedUser?._id.toString(),
            username: updatedUser?.username,
            email: updatedUser?.email,
            name: updatedUser?.full_name || updatedUser?.name || '',
            bio: updatedUser?.bio || '',
            website: updatedUser?.website || '',
            gender: updatedUser?.gender || '',
            birthday: updatedUser?.birthday || '',
            location: updatedUser?.location || '',
            avatar: updatedUser?.avatar_url || updatedUser?.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
            verified: updatedUser?.is_verified || updatedUser?.verified || false,
            isAnonymousMode: updatedUser?.isAnonymousMode || false,
            anonymousPersona: updatedUser?.anonymousPersona || null
        })
    } catch (error: any) {
        console.error('Update user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to update user' })
    }
})

// POST /api/users/me/toggle-anonymous - Toggle anonymous mode
router.post('/me/toggle-anonymous', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const db = await getDatabase();

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const currentMode = user.isAnonymousMode || false;
        const newMode = !currentMode;

        const updateData: any = {
            isAnonymousMode: newMode,
            updatedAt: new Date()
        };

        // If turning ON and no persona exists, generate one
        if (newMode && !user.anonymousPersona) {
            updateData.anonymousPersona = generateAnonymousPersona();
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        // Invalidate profile cache
        await cacheInvalidate(`userProfile:${userId}`);

        return res.json({
            success: true,
            isAnonymousMode: newMode,
            anonymousPersona: updateData.anonymousPersona || user.anonymousPersona,
            message: newMode ? 'Anonymous mode enabled' : 'Anonymous mode disabled'
        });
    } catch (error: any) {
        console.error('Toggle anonymous error:', error);
        return res.status(500).json({ message: error.message || 'Failed to toggle anonymous mode' });
    }
})

// GET /api/users/:username/posts - Get user's posts (ONLY their own posts, not feed)
router.get('/:username/posts', authenticate, async (req: any, res: Response) => {
    try {
        const { username } = req.params
        const currentUserId = req.userId
        const db = await getDatabase()

        // Find user by username
        const targetUser = await db.collection('users').findOne({ username })
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Check if viewing own profile
        const isOwnProfile = targetUser._id.toString() === currentUserId

        // Check if account is private
        const isPrivate = targetUser.is_private || false

        console.log('[PROFILE POSTS] User:', username, 'isPrivate:', isPrivate, 'isOwnProfile:', isOwnProfile)

        // If private account and not own profile, check if following
        if (isPrivate && !isOwnProfile) {
            const followRecord = await db.collection('follows').findOne({
                follower_id: new ObjectId(currentUserId),
                following_id: targetUser._id
            })

            console.log('[PROFILE POSTS] Follow record found:', !!followRecord)

            if (!followRecord) {
                // Not following private account - return empty posts
                console.log('[PROFILE POSTS] Blocking posts - private account, not following')
                return res.json({
                    posts: [],
                    count: 0,
                    message: 'This account is private'
                })
            }
        }

        console.log('[PROFILE POSTS] Allowing posts access')

        // Fetch ONLY this user's posts (not archived)
        const posts = await db.collection('posts').find({
            user_id: targetUser._id,
            is_archived: { $ne: true }
        }).sort({ created_at: -1 }).toArray()

        // 🛡️ ANONYMOUS MODE CHECK: Do NOT fetch reels if requester is in anonymous mode
        const requester = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
        let reels: any[] = [];
        
        // STRICT: Anonymous users cannot see any reels, including other users' reels
        if (!requester?.isAnonymousMode) {
            // Fetch ONLY this user's reels (not deleted, not archived)
            reels = await db.collection('reels').find({
                user_id: targetUser._id,
                is_deleted: { $ne: true },
                is_archived: { $ne: true }
            }).sort({ created_at: -1 }).toArray()
        } else {
            console.log('[PROFILE] Anonymous mode active: Reels hidden from profile view')
        }

        console.log('[PROFILE POSTS] Posts found:', posts.length)
        console.log('[PROFILE POSTS] Reels found:', reels.length)

        // Transform posts to include user info
        const transformedPosts = posts.map(post => ({
            id: post._id.toString(),
            user: maskAnonymousUser({
                id: targetUser._id.toString(),
                username: targetUser.username,
                avatar: targetUser.avatar_url || targetUser.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                avatar_url: targetUser.avatar_url || targetUser.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                verified: targetUser.is_verified || targetUser.verified || false,
                is_verified: targetUser.is_verified || targetUser.verified || false,
                badge_type: targetUser.badge_type || targetUser.verification_type || null,
                is_anonymous: post.is_anonymous
            }),
            is_anonymous: post.is_anonymous || false,
            content: post.content || '',
            caption: post.caption || post.content || '',
            media_type: post.media_type || 'text',
            media_urls: post.media_urls || [],
            image_url: post.media_urls && post.media_urls[0] ? post.media_urls[0] : null, // Add image_url field
            type: post.type || (post.media_type === 'video' ? 'reel' : 'post'), // Add type field
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            shares_count: post.shares_count || 0,
            created_at: post.created_at,
            is_liked: false, // Will be checked if needed
            bookmarked: false
        }))

        // Transform reels to match post format
        const transformedReels = reels.map(reel => ({
            id: reel._id.toString(),
            user: {
                id: targetUser._id.toString(),
                username: targetUser.username,
                avatar: targetUser.avatar_url || targetUser.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                avatar_url: targetUser.avatar_url || targetUser.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
                verified: targetUser.is_verified || targetUser.verified || false,
                is_verified: targetUser.is_verified || targetUser.verified || false,
                badge_type: targetUser.badge_type || targetUser.verification_type || null
            },
            content: reel.description || '',
            caption: reel.description || reel.title || '',
            media_type: 'video',
            media_urls: [reel.video_url],
            image_url: reel.thumbnail_url || reel.video_url, // Use thumbnail for grid display
            type: 'reel', // Explicitly mark as reel
            likes_count: reel.likes_count || 0,
            comments_count: reel.comments_count || 0,
            shares_count: reel.shares_count || 0,
            created_at: reel.created_at,
            is_liked: false,
            bookmarked: false
        }))

        // Combine and sort by created_at (newest first)
        const allContent = [...transformedPosts, ...transformedReels].sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        return res.json({
            posts: allContent,
            count: allContent.length
        })
    } catch (error: any) {
        console.error('Get user posts error:', error)
        return res.status(500).json({ message: error.message || 'Failed to fetch user posts' })
    }
})

import { Router, Request, Response } from 'express'
import { MongoClient, ObjectId, Db } from 'mongodb'
import jwt from 'jsonwebtoken'

const router = Router()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192'

// Connection pool - reuse connections
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

async function getDb(): Promise<Db> {
    if (cachedDb && cachedClient) {
        return cachedDb
    }
    
    cachedClient = await MongoClient.connect(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 2
    })
    cachedDb = cachedClient.db()
    
    console.log('✅ MongoDB connection pool established')
    return cachedDb
}

// Simple auth middleware
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

// GET /api/users/me - Get current user (OPTIMIZED)
router.get('/me', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const db = await getDb()
        
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } } // Don't fetch password
        )

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        return res.json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            followers: user.followers_count || user.followers || 0,
            following: user.following_count || user.following || 0,
            verified: user.is_verified || user.verified || false,
            posts_count: user.posts_count || 0
        })
    } catch (error: any) {
        console.error('Get user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
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

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()
        const user = await db.collection('users').findOne({ username })

        if (!user) {
            await client.close()
            return res.status(404).json({ message: 'User not found' })
        }

        // Check follow status if user is logged in
        let isFollowing = false;
        if (currentUserId) {
            const followRecord = await db.collection('follows').findOne({
                followerId: new ObjectId(currentUserId),
                followingId: user._id
            })
            isFollowing = !!followRecord;
        }

        // Get follower/following counts
        const followersCount = await db.collection('follows').countDocuments({
            followingId: user._id
        })
        const followingCount = await db.collection('follows').countDocuments({
            followerId: user._id
        })

        await client.close()

        return res.json({
            _id: user._id.toString(),
            id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.name || '',
            name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            followers: [],
            following: [],
            followersCount,
            followingCount,
            isFollowing,
            verified: user.is_verified || user.verified || false,
            posts_count: user.posts_count || 0,
            isPrivate: user.is_private || false
        })
    } catch (error: any) {
        console.error('Get user by username error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// GET /api/users/:userId - Get user by ID
router.get('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        await client.close()

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        return res.json({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            bio: user.bio || '',
            avatar: user.avatar || '/placeholder-user.jpg',
            followers: user.followers || 0,
            following: user.following || 0,
            verified: user.verified || false
        })
    } catch (error: any) {
        console.error('Get user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// PUT /api/users/profile - Update user profile
router.put('/profile', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId

        const { name, bio, avatar, website, location } = req.body

        console.log('[Backend] Profile update request for userId:', userId);
        console.log('[Backend] userId type:', typeof userId);
        console.log('[Backend] userId length:', userId?.length);
        console.log('[Backend] Received data:', { name, bio, avatar: avatar?.substring(0, 50) + '...', website, location });

        if (!userId) {
            console.error('[Backend] Missing userId in request');
            return res.status(400).json({ message: 'Missing user ID' });
        }

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

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
            await client.close()
            return res.status(404).json({ message: 'User not found' })
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
                await client.close()
                return res.status(500).json({ message: 'Failed to retrieve updated user' })
            }

            console.log('[Backend] Updated user data:', {
                username: user?.username,
                name: user?.name,
                full_name: user?.full_name,
                bio: user?.bio,
                avatar: user?.avatar?.substring(0, 50),
                avatar_url: user?.avatar_url?.substring(0, 50),
                website: user?.website,
                location: user?.location
            });

            await client.close()

            // Add timestamp to avatar URLs for cache busting
            const timestamp = Date.now();
            const avatarUrl = user?.avatar_url || user?.avatar || '/placeholder-user.jpg';
            const avatarWithTimestamp = avatarUrl !== '/placeholder-user.jpg'
                ? (avatarUrl.includes('?') ? `${avatarUrl}&_t=${timestamp}` : `${avatarUrl}?_t=${timestamp}`)
                : avatarUrl;

            const responseData = {
                id: user?._id.toString(),
                username: user?.username,
                email: user?.email,
                name: user?.name || user?.full_name || '',
                bio: user?.bio || '',
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
            await client.close()
            return res.status(500).json({ message: 'Failed to update profile' })
        }
    } catch (error: any) {
        console.error('Update profile error:', error)
        return res.status(500).json({ message: error.message || 'Failed to update profile' })
    }
})

// GET /api/users/search - Search users
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q } = req.query

        if (!q) {
            return res.status(400).json({ message: 'Search query required' })
        }

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        const users = await db.collection('users').find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } }
            ]
        }).limit(20).toArray()

        await client.close()

        return res.json(users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            avatar: user.avatar || '/placeholder-user.jpg',
            verified: user.verified || false
        })))
    } catch (error: any) {
        console.error('Search users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to search users' })
    }
})

// POST /api/users/:userId/follow - Follow/Unfollow user
router.post('/:userId/follow', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        console.log('[FOLLOW] Request:', { currentUserId, userId });

        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot follow yourself' })
        }

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Check if already following
        const existingFollow = await db.collection('follows').findOne({
            followerId: new ObjectId(currentUserId),
            followingId: new ObjectId(userId)
        })

        if (existingFollow) {
            // Unfollow
            console.log('[FOLLOW] Unfollowing user');
            await db.collection('follows').deleteOne({
                followerId: new ObjectId(currentUserId),
                followingId: new ObjectId(userId)
            })

            // Get updated count
            const followerCount = await db.collection('follows').countDocuments({
                followingId: new ObjectId(userId)
            })

            await client.close()

            return res.json({
                message: 'Unfollowed successfully',
                isFollowing: false,
                followerCount
            })
        } else {
            // Follow
            console.log('[FOLLOW] Following user');
            await db.collection('follows').insertOne({
                followerId: new ObjectId(currentUserId),
                followingId: new ObjectId(userId),
                createdAt: new Date()
            })

            // Get updated count
            const followerCount = await db.collection('follows').countDocuments({
                followingId: new ObjectId(userId)
            })

            await client.close()

            return res.json({
                message: 'Followed successfully',
                isFollowing: true,
                followerCount
            })
        }
    } catch (error: any) {
        console.error('Follow error:', error)
        return res.status(500).json({ message: error.message || 'Failed to follow user' })
    }
})

// DELETE /api/users/:userId/follow - Unfollow user
router.delete('/:userId/follow', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Remove from following
        await db.collection('follows').deleteOne({
            followerId: new ObjectId(currentUserId),
            followingId: new ObjectId(userId)
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

        await client.close()

        return res.json({ message: 'Unfollowed successfully' })
    } catch (error: any) {
        console.error('Unfollow error:', error)
        return res.status(500).json({ message: error.message || 'Failed to unfollow user' })
    }
})

// GET /api/users/:userId/followers - Get user followers
router.get('/:userId/followers', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params
        console.log('[FOLLOWERS] Fetching followers for user:', userId)

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        const follows = await db.collection('follows').find({
            followingId: new ObjectId(userId)
        }).toArray()
        
        console.log('[FOLLOWERS] Found', follows.length, 'follow records')

        const followerIds = follows.map(f => f.followerId)
        console.log('[FOLLOWERS] Follower IDs:', followerIds.map(id => id.toString()))
        
        const followers = await db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray()
        
        console.log('[FOLLOWERS] Found', followers.length, 'user records')

        await client.close()

        const result = followers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || user.full_name || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            verified: user.is_verified || user.verified || false
        }))
        
        console.log('[FOLLOWERS] Returning', result.length, 'followers')
        return res.json(result)
    } catch (error: any) {
        console.error('Get followers error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get followers' })
    }
})

// DEBUG: Check follower data integrity
router.get('/:userId/followers/debug', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params
        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Get all follow records
        const follows = await db.collection('follows').find({
            followingId: new ObjectId(userId)
        }).toArray()

        // Get follower IDs
        const followerIds = follows.map(f => f.followerId)

        // Get users
        const users = await db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray()

        // Get user's profile
        const userProfile = await db.collection('users').findOne({
            _id: new ObjectId(userId)
        })

        await client.close()

        return res.json({
            userId,
            followRecordsCount: follows.length,
            followRecords: follows.map(f => ({
                followerId: f.followerId.toString(),
                followingId: f.followingId.toString(),
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
router.get('/:userId/following', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        const follows = await db.collection('follows').find({
            followerId: new ObjectId(userId)
        }).toArray()

        const followingIds = follows.map(f => f.followingId)
        const following = await db.collection('users').find({
            _id: { $in: followingIds }
        }).toArray()

        await client.close()

        return res.json(following.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            avatar: user.avatar || '/placeholder-user.jpg',
            verified: user.verified || false
        })))
    } catch (error: any) {
        console.error('Get following error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get following' })
    }
})

// DELETE /api/users/delete - Delete user account
router.delete('/delete', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Delete user
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) })

        // Delete user's posts
        await db.collection('posts').deleteMany({ userId: new ObjectId(userId) })

        // Delete user's follows
        await db.collection('follows').deleteMany({
            $or: [
                { followerId: new ObjectId(userId) },
                { followingId: new ObjectId(userId) }
            ]
        })

        await client.close()

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

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        const blocks = await db.collection('blocked_users').find({
            userId: new ObjectId(userId)
        }).toArray()

        const blockedIds = blocks.map(b => b.blockedUserId)
        const blockedUsers = await db.collection('users').find({
            _id: { $in: blockedIds }
        }).toArray()

        await client.close()

        return res.json(blockedUsers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            avatar: user.avatar || '/placeholder-user.jpg'
        })))
    } catch (error: any) {
        console.error('Get blocked users error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get blocked users' })
    }
})

// GET /api/users/:userId/posts - Get user's posts
router.get('/:userId/posts', async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 20
        const offset = (page - 1) * limit

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Get total count
        const total = await db.collection('posts').countDocuments({
            user_id: new ObjectId(userId),
            is_archived: { $ne: true }
        })

        // Get posts with user data
        const posts = await db.collection('posts').aggregate([
            {
                $match: {
                    user_id: new ObjectId(userId),
                    is_archived: { $ne: true }
                }
            },
            { $sort: { created_at: -1 } },
            { $skip: offset },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' }
        ]).toArray()

        // Get likes and comments count for each post
        const postsWithCounts = await Promise.all(
            posts.map(async (post) => {
                const likesCount = await db.collection('likes').countDocuments({ post_id: post._id })
                const commentsCount = await db.collection('comments').countDocuments({
                    post_id: post._id,
                    is_deleted: { $ne: true }
                })

                // Check if current user liked (if authenticated)
                let is_liked = false
                if (req.userId) {
                    const like = await db.collection('likes').findOne({
                        user_id: new ObjectId(req.userId),
                        post_id: post._id
                    })
                    is_liked = !!like
                }

                return {
                    id: post._id.toString(),
                    user_id: post.user_id.toString(),
                    content: post.content,
                    media_urls: post.media_urls,
                    media_type: post.media_type,
                    location: post.location,
                    created_at: post.created_at,
                    updated_at: post.updated_at,
                    user: {
                        id: post.user._id.toString(),
                        username: post.user.username,
                        full_name: post.user.full_name,
                        avatar_url: post.user.avatar_url,
                        is_verified: post.user.is_verified || false
                    },
                    likes_count: likesCount,
                    comments_count: commentsCount,
                    is_liked
                }
            })
        )

        await client.close()

        return res.json({
            success: true,
            data: postsWithCounts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        })
    } catch (error: any) {
        console.error('Get user posts error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user posts' })
    }
})

export default router

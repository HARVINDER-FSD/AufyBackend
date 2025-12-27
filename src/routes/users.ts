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

        // Get actual follower/following counts from follows collection (ACCEPTED ONLY)
        const followersCount = await db.collection('follows').countDocuments({
            followingId: user._id,
            status: 'accepted'
        })
        const followingCount = await db.collection('follows').countDocuments({
            followerId: user._id,
            status: 'accepted'
        })
        
        // Get actual posts count from posts collection
        const postsCount = await db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        })

        return res.json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            name: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            followers: followersCount,
            following: followingCount,
            followers_count: followersCount,
            following_count: followingCount,
            followersCount,
            followingCount,
            verified: user.is_verified || user.verified || false,
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || user.verification_type || null,
            badgeType: user.badge_type || user.verification_type || null,
            posts_count: postsCount
        })
    } catch (error: any) {
        console.error('Get user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// GET /api/users/list - List following users (for sharing, etc.)
router.get('/list', authenticate, async (req: any, res: Response) => {
    try {
        const db = await getDb()
        const limit = parseInt(req.query.limit as string) || 50
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

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()
        const user = await db.collection('users').findOne({ username })

        if (!user) {
            await client.close()
            return res.status(404).json({ message: 'User not found' })
        }

        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;
        let isPending = false;
        let followRequestStatus = 'none';

        if (currentUserId) {
            const followRecord = await db.collection('follows').findOne({
                followerId: new ObjectId(currentUserId),
                followingId: user._id
            })
            isFollowing = !!followRecord;

            // Check if target user follows back
            const reverseFollow = await db.collection('follows').findOne({
                followerId: user._id,
                followingId: new ObjectId(currentUserId)
            })
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;

            // Check for pending follow request
            if (!isFollowing) {
                const pendingRequest = await db.collection('followRequests').findOne({
                    requester_id: new ObjectId(currentUserId),
                    requested_id: user._id,
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

        // Get follower/following counts (ACCEPTED ONLY)
        const followersCount = await db.collection('follows').countDocuments({
            followingId: user._id,
            status: 'accepted'
        })
        const followingCount = await db.collection('follows').countDocuments({
            followerId: user._id,
            status: 'accepted'
        })
        
        // Get actual posts count from posts collection
        const postsCount = await db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        })

        await client.close()

        return res.json({
            _id: user._id.toString(),
            id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            name: user.full_name || user.name || '',
            bio: user.bio || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
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
            is_private: user.is_private || false
        })
    } catch (error: any) {
        console.error('Get user by username error:', error)
        return res.status(500).json({ message: error.message || 'Failed to get user' })
    }
})

// GET /api/users/:userId/mutual-followers - Get mutual followers (users who follow each other)
router.get('/:userId/mutual-followers', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params

        // Validate ObjectId format
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format',
                data: []
            })
        }

        const db = await getDb()

        // Get users that this user follows
        const following = await db.collection('follows').find({
            followerId: new ObjectId(userId)
        }).toArray()
        const followingIds = following.map(f => f.followingId.toString())

        // Get users that follow this user
        const followers = await db.collection('follows').find({
            followingId: new ObjectId(userId)
        }).toArray()
        const followerIds = followers.map(f => f.followerId.toString())

        // Find mutual followers (intersection)
        const mutualIds = followingIds.filter(id => followerIds.includes(id))

        // Get user details for mutual followers
        const mutualUsers = await db.collection('users').find({
            _id: { $in: mutualIds.map(id => new ObjectId(id)) }
        }).project({
            password: 0
        }).toArray()

        // Format response
        const formattedUsers = mutualUsers.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.fullName || user.name || '',
            profileImage: user.avatar_url || user.avatar || user.profile_picture || user.profileImage || '/placeholder-user.jpg',
            isVerified: user.is_verified || user.verified || false
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

// GET /api/users/:userId - Get user by ID (MUST be last /:userId route)
// This route should only match /api/users/SOMEID, not /api/users/SOMEID/something
router.get('/:userId([0-9a-fA-F]{24})', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })

        await client.close()

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
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

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()
        const user = await db.collection('users').findOne({ username })

        if (!user) {
            await client.close()
            return res.status(404).json({ message: 'User not found' })
        }

        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;

        if (currentUserId) {
            const followRecord = await db.collection('follows').findOne({
                followerId: new ObjectId(currentUserId),
                followingId: user._id
            })
            isFollowing = !!followRecord;

            const reverseFollow = await db.collection('follows').findOne({
                followerId: user._id,
                followingId: new ObjectId(currentUserId)
            })
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;
        }

        // Get follower/following counts (ACCEPTED ONLY)
        const followersCount = await db.collection('follows').countDocuments({
            followingId: user._id,
            status: 'accepted'
        })
        const followingCount = await db.collection('follows').countDocuments({
            followerId: user._id,
            status: 'accepted'
        })
        
        // Get actual posts count from posts collection
        const postsCount = await db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        })

        await client.close()

        const avatarUrl = user.avatar_url || user.avatar || user.profile_picture || user.profileImage || '/placeholder-user.jpg';
        
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

        // Handle username change with 15-day restriction
        if (username !== undefined && username !== user.username) {
            console.log('[Backend] Username change requested:', user.username, '->', username);

            // Validate username format - only letters, numbers, underscore, and period
            const usernameRegex = /^[a-zA-Z0-9_.]+$/;
            if (!usernameRegex.test(username)) {
                await client.close()
                return res.status(400).json({
                    message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
                    error: 'INVALID_USERNAME_FORMAT'
                })
            }

            // Check username length (3-30 characters)
            if (username.length < 3 || username.length > 30) {
                await client.close()
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

                await client.close()
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
                await client.close()
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

// POST /api/users/:userId/follow - Follow/Unfollow user (with private account support)
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

        // Get target user to check if private
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!targetUser) {
            await client.close()
            return res.status(404).json({ message: 'User not found' })
        }

        const isPrivate = targetUser.is_private || false
        console.log('[FOLLOW] Target user is private:', isPrivate);

        // Check if already following (use snake_case)
        const existingFollow = await db.collection('follows').findOne({
            follower_id: new ObjectId(currentUserId),
            following_id: new ObjectId(userId)
        })

        if (existingFollow) {
            // UNFOLLOW - same for both private and public accounts
            console.log('[FOLLOW] Unfollowing user');
            await db.collection('follows').deleteOne({
                follower_id: new ObjectId(currentUserId),
                following_id: new ObjectId(userId)
            })

            // Remove any pending follow request if exists
            await db.collection('followRequests').deleteMany({
                requester_id: new ObjectId(currentUserId),
                requested_id: new ObjectId(userId)
            })
            
            // Update user document counts
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $inc: { followers_count: -1 } }
            )
            await db.collection('users').updateOne(
                { _id: new ObjectId(currentUserId) },
                { $inc: { following_count: -1 } }
            )
            
            // Delete follow notification (non-blocking)
            setImmediate(async () => {
                try {
                    const { deleteFollowNotification } = require('../lib/notifications');
                    await deleteFollowNotification(userId, currentUserId);
                } catch (err) {
                    console.error('[UNFOLLOW] Notification deletion error:', err);
                }
            })

            // Get updated count (ACCEPTED ONLY) - use snake_case
            const followerCount = await db.collection('follows').countDocuments({
                following_id: new ObjectId(userId),
                status: 'accepted'
            })

            await client.close()

            return res.json({
                message: 'Unfollowed successfully',
                isFollowing: false,
                isPending: false,
                followRequestStatus: 'none',
                followerCount,
                isMutualFollow: false
            })
        } else {
            // CHECK FOR EXISTING FOLLOW REQUEST
            const existingRequest = await db.collection('followRequests').findOne({
                requester_id: new ObjectId(currentUserId),
                requested_id: new ObjectId(userId),
                status: 'pending'
            })

            if (existingRequest) {
                // CANCEL PENDING REQUEST
                console.log('[FOLLOW] Canceling pending follow request');
                await db.collection('followRequests').deleteOne({
                    _id: existingRequest._id
                })

                await client.close()

                return res.json({
                    message: 'Follow request canceled',
                    isFollowing: false,
                    isPending: false,
                    followRequestStatus: 'none',
                    followerCount: targetUser.followers_count || 0,
                    isMutualFollow: false
                })
            }

            // NEW FOLLOW/REQUEST
            if (isPrivate) {
                // PRIVATE ACCOUNT - Create follow request
                console.log('[FOLLOW] Creating follow request for private account');

                await db.collection('followRequests').insertOne({
                    requester_id: new ObjectId(currentUserId),
                    requested_id: new ObjectId(userId),
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date()
                })

                await client.close()

                // Send notification (non-blocking)
                setImmediate(async () => {
                    try {
                        const { createNotification } = require('../lib/notifications');
                        await createNotification({
                            userId: userId,
                            actorId: currentUserId,
                            type: 'follow_request',
                            content: 'requested to follow you'
                        });
                    } catch (err) {
                        console.error('[FOLLOW] Notification error:', err);
                    }
                })

                return res.json({
                    message: 'Follow request sent',
                    isFollowing: false,
                    isPending: true,
                    followRequestStatus: 'pending',
                    followerCount: targetUser.followers_count || 0,
                    isMutualFollow: false
                })
            } else {
                // PUBLIC ACCOUNT - Instant follow (use snake_case)
                console.log('[FOLLOW] Following public account instantly');

                await db.collection('follows').insertOne({
                    follower_id: new ObjectId(currentUserId),
                    following_id: new ObjectId(userId),
                    status: 'accepted',
                    created_at: new Date()
                })

                // Update user document counts
                await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $inc: { followers_count: 1 } }
                )
                await db.collection('users').updateOne(
                    { _id: new ObjectId(currentUserId) },
                    { $inc: { following_count: 1 } }
                )

                // Get updated count (ACCEPTED ONLY) - use snake_case
                const followerCount = await db.collection('follows').countDocuments({
                    following_id: new ObjectId(userId),
                    status: 'accepted'
                })

                // Check if this creates a mutual follow (use snake_case)
                const reverseFollow = await db.collection('follows').findOne({
                    follower_id: new ObjectId(userId),
                    following_id: new ObjectId(currentUserId)
                })

                await client.close()

                // Create notification (non-blocking)
                setImmediate(async () => {
                    try {
                        const { notifyFollow } = require('../lib/notifications');
                        await notifyFollow(userId, currentUserId);
                    } catch (err) {
                        console.error('[FOLLOW] Notification error:', err);
                    }
                })

                return res.json({
                    message: 'Followed successfully',
                    isFollowing: true,
                    isPending: false,
                    followRequestStatus: 'approved',
                    followerCount,
                    isMutualFollow: !!reverseFollow
                })
            }
        }
    } catch (error: any) {
        console.error('Follow error:', error)
        return res.status(500).json({ message: error.message || 'Failed to follow user' })
    }
})

// GET /api/users/:userId/follow-status - Check follow status and mutual follow
router.get('/:userId/follow-status', authenticate, async (req: any, res: Response) => {
    try {
        const currentUserId = req.userId
        const { userId } = req.params

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Check if current user follows target user
        const isFollowing = await db.collection('follows').findOne({
            followerId: new ObjectId(currentUserId),
            followingId: new ObjectId(userId)
        })

        // Check if target user follows current user
        const followsBack = await db.collection('follows').findOne({
            followerId: new ObjectId(userId),
            followingId: new ObjectId(currentUserId)
        })

        // Check for pending follow request
        const pendingRequest = await db.collection('followRequests').findOne({
            requester_id: new ObjectId(currentUserId),
            requested_id: new ObjectId(userId),
            status: 'pending'
        })

        await client.close()

        return res.json({
            isFollowing: !!isFollowing,
            isPending: !!pendingRequest,
            followsBack: !!followsBack,
            isMutualFollow: !!isFollowing && !!followsBack
        })
    } catch (error: any) {
        console.error('Follow status error:', error)
        return res.status(500).json({ message: error.message || 'Failed to check follow status' })
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
router.get('/:userId/followers', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const currentUserId = req.userId // From auth middleware
        console.log('[FOLLOWERS] Fetching followers for user:', userId)

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Check if target user is private
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!targetUser) {
            await client.close()
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
                await client.close()
                return res.status(403).json({ message: 'This account is private' })
            }

            const isFollowing = await db.collection('follows').findOne({
                followerId: new ObjectId(currentUserId),
                followingId: new ObjectId(userId),
                status: 'accepted'
            })

            if (!isFollowing) {
                await client.close()
                return res.status(403).json({ message: 'This account is private' })
            }
        }

        const follows = await db.collection('follows').find({
            followingId: new ObjectId(userId),
            status: 'accepted'
        }).toArray()

        console.log('[FOLLOWERS] Found', follows.length, 'follow records')

        const followerIds = follows.map(f => f.followerId)
        const followers = await db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray()

        console.log('[FOLLOWERS] Found', followers.length, 'user records')

        // Check which followers the current user is following back
        const currentUserFollowing = currentUserId ? await db.collection('follows').find({
            followerId: new ObjectId(currentUserId),
            status: 'accepted'
        }).toArray() : []

        const followingIds = new Set(currentUserFollowing.map(f => f.followingId.toString()))

        await client.close()

        const result = followers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || null,
            is_private: user.is_private || false,
            isFollowing: followingIds.has(user._id.toString())
        }))

        console.log('[FOLLOWERS] Returning', result.length, 'followers')
        return res.json({ data: result })
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
router.get('/:userId/following', authenticate, async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const currentUserId = req.userId // From auth middleware

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

        // Check if target user is private
        const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
        if (!targetUser) {
            await client.close()
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
                await client.close()
                return res.status(403).json({ message: 'This account is private' })
            }

            const isFollowing = await db.collection('follows').findOne({
                followerId: new ObjectId(currentUserId),
                followingId: new ObjectId(userId),
                status: 'accepted'
            })

            if (!isFollowing) {
                await client.close()
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
        await client.close()

        const result = following.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
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

// GET /api/users/:userId/posts - Get user's posts (supports both userId and username)
router.get('/:userId/posts', async (req: any, res: Response) => {
    try {
        const { userId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 20
        const offset = (page - 1) * limit

        const client = await MongoClient.connect(MONGODB_URI)
        const db = client.db()

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
                await client.close()
                return res.status(404).json({ success: false, message: 'User not found' })
            }
            userObjectId = targetUser._id
        }

        if (!targetUser) {
            await client.close()
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
                followerId: new ObjectId(currentUserId),
                followingId: userObjectId,
                status: 'accepted'
            }) : null

            if (!isFollowing) {
                // Private account and not following - return empty
                await client.close()
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

        // Get total count
        const total = await db.collection('posts').countDocuments({
            user_id: userObjectId,
            is_archived: { $ne: true }
        })

        // Get posts with user data
        const posts = await db.collection('posts').aggregate([
            {
                $match: {
                    user_id: userObjectId,
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
                    image_url: post.media_urls && post.media_urls[0] ? post.media_urls[0] : null,
                    media_type: post.media_type,
                    type: post.type || (post.media_type === 'video' ? 'reel' : 'post'),
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

        const db = await getDb()

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
                followerId: new ObjectId(currentUserId),
                followingId: new ObjectId(recipientId)
            }),
            db.collection('follows').findOne({
                followerId: new ObjectId(recipientId),
                followingId: new ObjectId(currentUserId)
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
        const db = await getDb()

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
        const db = await getDb()

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
            followerId: new ObjectId(userId),
            followingId: request.senderId
        })

        if (!existingFollow) {
            await db.collection('follows').insertOne({
                followerId: new ObjectId(userId),
                followingId: request.senderId,
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
        const db = await getDb()

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
        const db = await getDb()

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
                { followerId: new ObjectId(userId), followingId: request.senderId },
                { followerId: request.senderId, followingId: new ObjectId(userId) }
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
        const db = await getDb()

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
        const db = await getDb()

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
        const db = await getDb()

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
                    avatar_url: requester?.avatar_url || requester?.avatar || '/placeholder-user.jpg',
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
        const db = await getDb()

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
            followerId: request.requester_id,
            followingId: request.requested_id,
            status: 'accepted',
            createdAt: new Date()
        })

        // Update follower counts (ACCEPTED ONLY)
        const followerCount = await db.collection('follows').countDocuments({
            followingId: new ObjectId(currentUserId),
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
        const db = await getDb()

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
        const db = await getDb()

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

// POST /api/users/fcm-token - Register FCM token for push notifications
router.post('/fcm-token', authenticate, async (req: any, res: Response) => {
    try {
        const userId = req.userId
        const { fcmToken } = req.body

        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' })
        }

        console.log('[FCM] Registering token for user:', userId)

        const db = await getDb()

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

        const db = await getDb()

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

        const db = await getDb()
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
        const db = await getDb()

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
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
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

        const db = await getDb()

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
        const db = await getDb()

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

        const db = await getDb()

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
        if (email !== undefined) updateData.email = email
        if (bio !== undefined) updateData.bio = bio
        if (website !== undefined) updateData.website = website
        if (gender !== undefined) updateData.gender = gender
        if (birthday !== undefined) updateData.birthday = birthday
        if (location !== undefined) updateData.location = location

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
            avatar: updatedUser?.avatar_url || updatedUser?.avatar || '/placeholder-user.jpg',
            verified: updatedUser?.is_verified || updatedUser?.verified || false
        })
    } catch (error: any) {
        console.error('Update user error:', error)
        return res.status(500).json({ message: error.message || 'Failed to update user' })
    }
})

// GET /api/users/:username/posts - Get user's posts (ONLY their own posts, not feed)
router.get('/:username/posts', authenticate, async (req: any, res: Response) => {
    try {
        const { username } = req.params
        const currentUserId = req.userId
        const db = await getDb()

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
                followerId: new ObjectId(currentUserId),
                followingId: targetUser._id
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

        // Transform posts to include user info
        const transformedPosts = posts.map(post => ({
            id: post._id.toString(),
            user: {
                id: targetUser._id.toString(),
                username: targetUser.username,
                avatar: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
                avatar_url: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
                verified: targetUser.is_verified || targetUser.verified || false,
                is_verified: targetUser.is_verified || targetUser.verified || false,
                badge_type: targetUser.badge_type || targetUser.verification_type || null
            },
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

        return res.json({
            posts: transformedPosts,
            count: transformedPosts.length
        })
    } catch (error: any) {
        console.error('Get user posts error:', error)
        return res.status(500).json({ message: error.message || 'Failed to fetch user posts' })
    }
})

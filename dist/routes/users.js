"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongodb_1 = require("mongodb");
const anonymous_utils_1 = require("../lib/anonymous-utils");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../lib/redis");
const validate_1 = require("../middleware/validate");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
// Connection pool - reuse connections
let cachedClient = null;
let cachedDb = null;
function getDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (cachedDb && cachedClient) {
            return cachedDb;
        }
        cachedClient = yield mongodb_1.MongoClient.connect(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 2
        });
        cachedDb = cachedClient.db();
        console.log('✅ MongoDB connection pool established');
        return cachedDb;
    });
}
// Simple auth middleware
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    }
    catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
    // Register push token (Expo/FCM)
    // Register push token (Expo/FCM) with validation
    const pushTokenSchema = joi_1.default.object({
        token: joi_1.default.string().required(),
        platform: joi_1.default.string().optional().default('expo'),
    });
    router.post('/:id/push-token', (0, validate_1.validateBody)(pushTokenSchema), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { token, platform } = req.body;
            const userId = req.params.id;
            const db = yield getDb();
            const result = yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: { pushToken: token, pushTokenPlatform: platform, pushTokenUpdatedAt: new Date() } });
            if (result.matchedCount === 0)
                return res.status(404).json({ message: 'User not found' });
            res.json({ success: true, message: 'Push token saved' });
        }
        catch (e) {
            console.error('Push token save error:', e);
            res.status(500).json({ message: 'Server error' });
        }
    }));
};
// GET /api/users/me - Get current user (OPTIMIZED)
router.get('/me', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const cacheKey = `userProfile:${userId}`;
        // Try cache first
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const db = yield getDb();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) }, { projection: { password: 0 } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Counts
        const followersCount = yield db.collection('follows').countDocuments({
            following_id: user._id,
            status: 'accepted',
        });
        const followingCount = yield db.collection('follows').countDocuments({
            follower_id: user._id,
            status: 'accepted',
        });
        const postsCount = yield db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true },
        });
        const response = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            name: user.full_name || user.name || '',
            full_name: user.full_name || user.name || '',
            bio: user.bio || '',
            links: user.links || [],
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
            posts_count: postsCount,
            isAnonymousMode: user.isAnonymousMode || false,
            anonymousPersona: user.anonymousPersona || null,
        };
        // Cache for 5 minutes (300 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, response, 300);
        return res.json(response);
    }
    catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user' });
    }
}));
// GET /api/users/list - List following users (for sharing, etc.)
router.get('/list', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield getDb();
        const limit = parseInt(req.query.limit) || 50;
        const mutual = req.query.mutual === 'true';
        const currentUserId = new mongodb_1.ObjectId(req.userId);
        let users = [];
        if (mutual) {
            // Get mutual followers (users who follow you AND you follow them)
            // Step 1: Get users you are following
            const following = yield db.collection('follows')
                .find({ follower_id: currentUserId })
                .toArray();
            const followingIds = following.map(f => f.following_id);
            if (followingIds.length === 0) {
                // Not following anyone, no mutual followers
                return res.json({
                    success: true,
                    data: { users: [] }
                });
            }
            // Step 2: Get users who follow you back (mutual)
            const mutualFollows = yield db.collection('follows')
                .find({
                follower_id: { $in: followingIds },
                following_id: currentUserId
            })
                .toArray();
            const mutualUserIds = mutualFollows.map(f => f.follower_id);
            if (mutualUserIds.length === 0) {
                // No mutual followers
                return res.json({
                    success: true,
                    data: { users: [] }
                });
            }
            // Step 3: Get user details for mutual followers
            users = yield db.collection('users')
                .find({ _id: { $in: mutualUserIds } }, { projection: { password: 0, email: 0 } })
                .limit(limit)
                .toArray();
        }
        else {
            // Original logic: Get users that current user is following
            const follows = yield db.collection('follows')
                .find({ follower_id: currentUserId })
                .limit(limit)
                .toArray();
            if (follows.length === 0) {
                // If not following anyone, show all users except self
                users = yield db.collection('users')
                    .find({ _id: { $ne: currentUserId } }, { projection: { password: 0, email: 0 } })
                    .limit(limit)
                    .toArray();
            }
            else {
                // Get user details for all following users
                const followingUserIds = follows.map(f => f.following_id);
                users = yield db.collection('users')
                    .find({ _id: { $in: followingUserIds } }, { projection: { password: 0, email: 0 } })
                    .toArray();
            }
        }
        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.full_name || user.name || user.username,
            avatar_url: user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=667eea&color=fff`,
            verified: user.is_verified || user.verified || false
        }));
        return res.json({
            success: true,
            data: { users: formattedUsers }
        });
    }
    catch (error) {
        console.error('List users error:', error);
        return res.status(500).json({ message: error.message || 'Failed to list users' });
    }
}));
// GET /api/users/username/:username - Get user by username (MUST be before /:userId)
router.get('/username/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username } = req.params;
        // Try to get current user ID from token (optional)
        let currentUserId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                currentUserId = decoded.userId;
            }
        }
        catch (err) {
            // Token is optional, continue without it
        }
        // Try cache first
        const cacheKey = `profile:${username}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for profile: ${username}`);
            return res.json(cached);
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const user = yield db.collection('users').findOne({ username });
        if (!user) {
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;
        let isPending = false;
        let followRequestStatus = 'none';
        if (currentUserId) {
            const followRecord = yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: user._id
            });
            isFollowing = !!followRecord;
            // Check if target user follows back
            const reverseFollow = yield db.collection('follows').findOne({
                follower_id: user._id,
                following_id: new mongodb_1.ObjectId(currentUserId)
            });
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;
            // Check for pending follow request
            if (!isFollowing) {
                const pendingRequest = yield db.collection('followRequests').findOne({
                    requester_id: new mongodb_1.ObjectId(currentUserId),
                    requested_id: user._id,
                    status: 'pending'
                });
                if (pendingRequest) {
                    isPending = true;
                    followRequestStatus = 'pending';
                }
            }
            else {
                followRequestStatus = 'approved';
            }
        }
        // Get follower/following counts (ACCEPTED ONLY)
        const followersCount = yield db.collection('follows').countDocuments({
            following_id: user._id,
            status: 'accepted'
        });
        const followingCount = yield db.collection('follows').countDocuments({
            follower_id: user._id,
            status: 'accepted'
        });
        // Get actual posts count from posts collection
        const postsCount = yield db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        });
        yield client.close();
        const response = {
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
            is_private: user.is_private || false,
            // isPending and followRequestStatus already included earlier
        };
        // Cache for 5 minutes (300 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, response, 300);
        return res.json(response);
    }
    catch (error) {
        console.error('Get user by username error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user' });
    }
}));
// GET /api/users/:userId/mutual-followers - Get mutual followers (users who follow each other)
router.get('/:userId/mutual-followers', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        // Validate ObjectId format
        if (!mongodb_1.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format',
                data: []
            });
        }
        const db = yield getDb();
        // Get users that this user follows
        const following = yield db.collection('follows').find({
            follower_id: new mongodb_1.ObjectId(userId)
        }).toArray();
        const followingIds = following.map(f => f.following_id.toString());
        // Get users that follow this user
        const followers = yield db.collection('follows').find({
            following_id: new mongodb_1.ObjectId(userId)
        }).toArray();
        const followerIds = followers.map(f => f.follower_id.toString());
        // Find mutual followers (intersection)
        const mutualIds = followingIds.filter(id => followerIds.includes(id));
        // Get user details for mutual followers
        const mutualUsers = yield db.collection('users').find({
            _id: { $in: mutualIds.map(id => new mongodb_1.ObjectId(id)) }
        }).project({
            password: 0
        }).toArray();
        // Format response
        const formattedUsers = mutualUsers.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            fullName: user.full_name || user.fullName || user.name || '',
            profileImage: user.avatar_url || user.avatar || user.profile_picture || user.profileImage || '/placeholder-user.jpg',
            isVerified: user.is_verified || user.verified || false
        }));
        return res.json({
            success: true,
            data: formattedUsers
        });
    }
    catch (error) {
        console.error('Error getting mutual followers:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get mutual followers',
            data: []
        });
    }
}));
// GET /api/users/:userId - Get user by ID (MUST be last /:userId route)
// This route should only match /api/users/SOMEID, not /api/users/SOMEID/something
router.get('/:userId([0-9a-fA-F]{24})', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        yield client.close();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
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
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user' });
    }
}));
// GET /api/users/:username - Get user by username (catches non-MongoDB ID patterns)
// This MUST be after the /:userId route to avoid conflicts
router.get('/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username } = req.params;
        // If it looks like a MongoDB ID, skip this route (let /:userId handle it)
        if (/^[0-9a-fA-F]{24}$/.test(username)) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Try to get current user ID from token (optional)
        let currentUserId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                currentUserId = decoded.userId;
            }
        }
        catch (err) {
            // Token is optional, continue without it
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const user = yield db.collection('users').findOne({ username });
        if (!user) {
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        // Check follow status if user is logged in
        let isFollowing = false;
        let followsBack = false;
        let isMutualFollow = false;
        if (currentUserId) {
            const followRecord = yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: user._id
            });
            isFollowing = !!followRecord;
            const reverseFollow = yield db.collection('follows').findOne({
                follower_id: user._id,
                following_id: new mongodb_1.ObjectId(currentUserId)
            });
            followsBack = !!reverseFollow;
            isMutualFollow = isFollowing && followsBack;
        }
        // Get follower/following counts (ACCEPTED ONLY)
        const followersCount = yield db.collection('follows').countDocuments({
            following_id: user._id,
            status: 'accepted'
        });
        const followingCount = yield db.collection('follows').countDocuments({
            follower_id: user._id,
            status: 'accepted'
        });
        // Get actual posts count from posts collection
        const postsCount = yield db.collection('posts').countDocuments({
            user_id: user._id,
            is_archived: { $ne: true }
        });
        yield client.close();
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
        });
    }
    catch (error) {
        console.error('Get user by username error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user' });
    }
}));
// PUT /api/users/profile - Update user profile
router.put('/profile', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const userId = req.userId;
        const { name, bio, avatar, website, location, username } = req.body;
        console.log('[Backend] Profile update request for userId:', userId);
        console.log('[Backend] userId type:', typeof userId);
        console.log('[Backend] userId length:', userId === null || userId === void 0 ? void 0 : userId.length);
        console.log('[Backend] Received data:', { name, bio, avatar: (avatar === null || avatar === void 0 ? void 0 : avatar.substring(0, 50)) + '...', website, location, username });
        if (!userId) {
            console.error('[Backend] Missing userId in request');
            return res.status(400).json({ message: 'Missing user ID' });
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const updateData = { updatedAt: new Date() };
        if (name !== undefined) {
            updateData.name = name;
            updateData.full_name = name; // Also update full_name for Atlas compatibility
        }
        if (bio !== undefined)
            updateData.bio = bio;
        if (avatar !== undefined) {
            updateData.avatar = avatar;
            updateData.avatar_url = avatar; // Also update avatar_url for Atlas compatibility
        }
        if (website !== undefined)
            updateData.website = website;
        if (location !== undefined)
            updateData.location = location;
        if (req.body.links !== undefined)
            updateData.links = req.body.links;
        console.log('[Backend] Updating with data:', Object.assign(Object.assign({}, updateData), { avatar: ((_a = updateData.avatar) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) + '...' }));
        // Try to find user first to determine ID format
        let user;
        let idQuery;
        try {
            user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
            idQuery = { _id: new mongodb_1.ObjectId(userId) };
        }
        catch (err) {
            console.log('[Backend] Error with ObjectId, trying string ID...');
            user = yield db.collection('users').findOne({ _id: userId });
            idQuery = { _id: userId };
        }
        // If still not found, try finding by username from JWT
        if (!user) {
            console.log('[Backend] Trying to find user by username from JWT...');
            const jwt = require('jsonwebtoken');
            const token = (_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(' ')[1];
            try {
                const decoded = jwt.decode(token);
                console.log('[Backend] Decoded JWT username:', decoded === null || decoded === void 0 ? void 0 : decoded.username);
                if (decoded === null || decoded === void 0 ? void 0 : decoded.username) {
                    user = yield db.collection('users').findOne({ username: decoded.username });
                    if (user) {
                        console.log('[Backend] Found user by username! User _id:', user._id, 'Type:', typeof user._id);
                        idQuery = { _id: user._id };
                    }
                }
            }
            catch (err) {
                console.error('[Backend] Error decoding JWT:', err);
            }
        }
        if (!user) {
            console.error('[Backend] User not found with either ObjectId or string ID');
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        // Handle username change with 15-day restriction
        if (username !== undefined && username !== user.username) {
            console.log('[Backend] Username change requested:', user.username, '->', username);
            // Validate username format - only letters, numbers, underscore, and period
            const usernameRegex = /^[a-zA-Z0-9_.]+$/;
            if (!usernameRegex.test(username)) {
                yield client.close();
                return res.status(400).json({
                    message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
                    error: 'INVALID_USERNAME_FORMAT'
                });
            }
            // Check username length (3-30 characters)
            if (username.length < 3 || username.length > 30) {
                yield client.close();
                return res.status(400).json({
                    message: 'Username must be between 3 and 30 characters',
                    error: 'INVALID_USERNAME_LENGTH'
                });
            }
            // Check if username is already taken
            const existingUser = yield db.collection('users').findOne({ username: username });
            if (existingUser) {
                // Generate username suggestions
                const suggestions = [];
                const baseUsername = username.replace(/[0-9]+$/, ''); // Remove trailing numbers
                // Try adding random numbers
                for (let i = 0; i < 5; i++) {
                    const randomNum = Math.floor(Math.random() * 9999) + 1;
                    const suggestion = `${baseUsername}${randomNum}`;
                    // Check if suggestion is available
                    const exists = yield db.collection('users').findOne({ username: suggestion });
                    if (!exists && suggestion.length <= 30) {
                        suggestions.push(suggestion);
                    }
                }
                // Try adding underscore and numbers
                if (suggestions.length < 5) {
                    for (let i = 0; i < 3; i++) {
                        const randomNum = Math.floor(Math.random() * 999) + 1;
                        const suggestion = `${baseUsername}_${randomNum}`;
                        const exists = yield db.collection('users').findOne({ username: suggestion });
                        if (!exists && suggestion.length <= 30 && !suggestions.includes(suggestion)) {
                            suggestions.push(suggestion);
                        }
                    }
                }
                yield client.close();
                return res.status(400).json({
                    message: 'Username is already taken',
                    error: 'USERNAME_TAKEN',
                    suggestions: suggestions.slice(0, 5) // Return up to 5 suggestions
                });
            }
            // Check last username change date
            const lastUsernameChange = user.last_username_change || user.createdAt || new Date(0);
            const daysSinceLastChange = (Date.now() - new Date(lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
            console.log('[Backend] Days since last username change:', daysSinceLastChange);
            if (daysSinceLastChange < 15) {
                const daysRemaining = Math.ceil(15 - daysSinceLastChange);
                yield client.close();
                return res.status(400).json({
                    message: `You can only change your username once every 15 days. Please wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`,
                    error: 'USERNAME_CHANGE_TOO_SOON',
                    daysRemaining
                });
            }
            // Allow username change
            updateData.username = username;
            updateData.last_username_change = new Date();
            console.log('[Backend] Username change allowed');
        }
        console.log('[Backend] Found user, updating with query:', idQuery);
        try {
            const result = yield db.collection('users').updateOne(idQuery, { $set: updateData });
            console.log('[Backend] Update result:', result.modifiedCount, 'documents modified');
            // Fetch updated user
            user = yield db.collection('users').findOne(idQuery);
            if (!user) {
                console.error('[Backend] User not found after update');
                yield client.close();
                return res.status(500).json({ message: 'Failed to retrieve updated user' });
            }
            console.log('[Backend] Updated user data:', {
                username: user === null || user === void 0 ? void 0 : user.username,
                name: user === null || user === void 0 ? void 0 : user.name,
                full_name: user === null || user === void 0 ? void 0 : user.full_name,
                bio: user === null || user === void 0 ? void 0 : user.bio,
                links: user === null || user === void 0 ? void 0 : user.links,
                avatar: (_c = user === null || user === void 0 ? void 0 : user.avatar) === null || _c === void 0 ? void 0 : _c.substring(0, 50),
                avatar_url: (_d = user === null || user === void 0 ? void 0 : user.avatar_url) === null || _d === void 0 ? void 0 : _d.substring(0, 50),
                website: user === null || user === void 0 ? void 0 : user.website,
                location: user === null || user === void 0 ? void 0 : user.location
            });
            yield client.close();
            // Add timestamp to avatar URLs for cache busting
            const timestamp = Date.now();
            const avatarUrl = (user === null || user === void 0 ? void 0 : user.avatar_url) || (user === null || user === void 0 ? void 0 : user.avatar) || '/placeholder-user.jpg';
            const avatarWithTimestamp = avatarUrl !== '/placeholder-user.jpg'
                ? (avatarUrl.includes('?') ? `${avatarUrl}&_t=${timestamp}` : `${avatarUrl}?_t=${timestamp}`)
                : avatarUrl;
            const responseData = {
                id: user === null || user === void 0 ? void 0 : user._id.toString(),
                username: user === null || user === void 0 ? void 0 : user.username,
                email: user === null || user === void 0 ? void 0 : user.email,
                name: (user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.full_name) || '',
                bio: (user === null || user === void 0 ? void 0 : user.bio) || '',
                links: (user === null || user === void 0 ? void 0 : user.links) || [],
                avatar: avatarWithTimestamp,
                avatar_url: avatarWithTimestamp,
                website: (user === null || user === void 0 ? void 0 : user.website) || '',
                location: (user === null || user === void 0 ? void 0 : user.location) || '',
                followers: (user === null || user === void 0 ? void 0 : user.followers_count) || (user === null || user === void 0 ? void 0 : user.followers) || 0,
                following: (user === null || user === void 0 ? void 0 : user.following_count) || (user === null || user === void 0 ? void 0 : user.following) || 0,
                verified: (user === null || user === void 0 ? void 0 : user.is_verified) || (user === null || user === void 0 ? void 0 : user.verified) || false,
                posts_count: (user === null || user === void 0 ? void 0 : user.posts_count) || 0
            };
            console.log('[Backend] ✅ Sending success response:', responseData);
            return res.json(responseData);
        }
        catch (updateError) {
            console.error('[Backend] Error updating user:', updateError);
            yield client.close();
            return res.status(500).json({ message: 'Failed to update profile' });
        }
    }
    catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update profile' });
    }
}));
// GET /api/users/search - Search users
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Search query required' });
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        const users = yield db.collection('users').find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } }
            ]
        }).limit(20).toArray();
        yield client.close();
        return res.json(users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.name || '',
            avatar: user.avatar || '/placeholder-user.jpg',
            verified: user.verified || false
        })));
    }
    catch (error) {
        console.error('Search users error:', error);
        return res.status(500).json({ message: error.message || 'Failed to search users' });
    }
}));
// POST /api/users/:userId/follow - Follow/Unfollow user (with private account support)
router.post('/:userId/follow', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        console.log('[FOLLOW] Request:', { currentUserId, userId });
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot follow yourself' });
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Get target user to check if private
        const targetUser = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!targetUser) {
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        const isPrivate = targetUser.is_private || false;
        console.log('[FOLLOW] Target user is private:', isPrivate);
        // Check if already following (use snake_case)
        const existingFollow = yield db.collection('follows').findOne({
            follower_id: new mongodb_1.ObjectId(currentUserId),
            following_id: new mongodb_1.ObjectId(userId)
        });
        if (existingFollow) {
            // UNFOLLOW - same for both private and public accounts
            console.log('[FOLLOW] Unfollowing user');
            yield db.collection('follows').deleteOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: new mongodb_1.ObjectId(userId)
            });
            // Remove any pending follow request if exists
            yield db.collection('followRequests').deleteMany({
                requester_id: new mongodb_1.ObjectId(currentUserId),
                requested_id: new mongodb_1.ObjectId(userId)
            });
            // Update user document counts
            yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $inc: { followers_count: -1 } });
            yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(currentUserId) }, { $inc: { following_count: -1 } });
            // Delete follow notification (non-blocking)
            setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const { deleteFollowNotification } = require('../lib/notifications');
                    yield deleteFollowNotification(userId, currentUserId);
                }
                catch (err) {
                    console.error('[UNFOLLOW] Notification deletion error:', err);
                }
            }));
            // Get updated count (ACCEPTED ONLY) - use snake_case
            const followerCount = yield db.collection('follows').countDocuments({
                following_id: new mongodb_1.ObjectId(userId),
                status: 'accepted'
            });
            yield client.close();
            // Invalidate profile cache for both users
            yield (0, redis_1.cacheInvalidate)(`profile:*`);
            return res.json({
                message: 'Unfollowed successfully',
                isFollowing: false,
                isPending: false,
                followRequestStatus: 'none',
                followerCount,
                isMutualFollow: false
            });
        }
        else {
            // CHECK FOR EXISTING FOLLOW REQUEST
            const existingRequest = yield db.collection('followRequests').findOne({
                requester_id: new mongodb_1.ObjectId(currentUserId),
                requested_id: new mongodb_1.ObjectId(userId),
                status: 'pending'
            });
            if (existingRequest) {
                // CANCEL PENDING REQUEST
                console.log('[FOLLOW] Canceling pending follow request');
                yield db.collection('followRequests').deleteOne({
                    _id: existingRequest._id
                });
                yield client.close();
                // Invalidate profile cache
                yield (0, redis_1.cacheInvalidate)(`profile:*`);
                return res.json({
                    message: 'Follow request canceled',
                    isFollowing: false,
                    isPending: false,
                    followRequestStatus: 'none',
                    followerCount: targetUser.followers_count || 0,
                    isMutualFollow: false
                });
            }
            // NEW FOLLOW/REQUEST
            if (isPrivate) {
                // PRIVATE ACCOUNT - Create follow request
                console.log('[FOLLOW] Creating follow request for private account');
                yield db.collection('followRequests').insertOne({
                    requester_id: new mongodb_1.ObjectId(currentUserId),
                    requested_id: new mongodb_1.ObjectId(userId),
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date()
                });
                yield client.close();
                // Send notification (non-blocking)
                setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        const { createNotification } = require('../lib/notifications');
                        yield createNotification({
                            userId: userId,
                            actorId: currentUserId,
                            type: 'follow_request',
                            content: 'requested to follow you'
                        });
                    }
                    catch (err) {
                        console.error('[FOLLOW] Notification error:', err);
                    }
                }));
                return res.json({
                    message: 'Follow request sent',
                    isFollowing: false,
                    isPending: true,
                    followRequestStatus: 'pending',
                    followerCount: targetUser.followers_count || 0,
                    isMutualFollow: false
                });
            }
            else {
                // PUBLIC ACCOUNT - Instant follow (use snake_case)
                console.log('[FOLLOW] Following public account instantly');
                yield db.collection('follows').insertOne({
                    follower_id: new mongodb_1.ObjectId(currentUserId),
                    following_id: new mongodb_1.ObjectId(userId),
                    status: 'accepted',
                    created_at: new Date()
                });
                // Update user document counts
                yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $inc: { followers_count: 1 } });
                yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(currentUserId) }, { $inc: { following_count: 1 } });
                // Get updated count (ACCEPTED ONLY) - use snake_case
                const followerCount = yield db.collection('follows').countDocuments({
                    following_id: new mongodb_1.ObjectId(userId),
                    status: 'accepted'
                });
                // Check if this creates a mutual follow (use snake_case)
                const reverseFollow = yield db.collection('follows').findOne({
                    follower_id: new mongodb_1.ObjectId(userId),
                    following_id: new mongodb_1.ObjectId(currentUserId)
                });
                yield client.close();
                // Invalidate profile cache
                yield (0, redis_1.cacheInvalidate)(`profile:*`);
                // Create notification (non-blocking)
                setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        const { notifyFollow } = require('../lib/notifications');
                        yield notifyFollow(userId, currentUserId);
                    }
                    catch (err) {
                        console.error('[FOLLOW] Notification error:', err);
                    }
                }));
                return res.json({
                    message: 'Followed successfully',
                    isFollowing: true,
                    isPending: false,
                    followRequestStatus: 'approved',
                    followerCount,
                    isMutualFollow: !!reverseFollow
                });
            }
        }
    }
    catch (error) {
        console.error('Follow error:', error);
        return res.status(500).json({ message: error.message || 'Failed to follow user' });
    }
}));
// GET /api/users/:userId/follow-status - Check follow status and mutual follow
router.get('/:userId/follow-status', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Check if current user follows target user
        const isFollowing = yield db.collection('follows').findOne({
            follower_id: new mongodb_1.ObjectId(currentUserId),
            following_id: new mongodb_1.ObjectId(userId)
        });
        // Check if target user follows current user
        const followsBack = yield db.collection('follows').findOne({
            follower_id: new mongodb_1.ObjectId(userId),
            following_id: new mongodb_1.ObjectId(currentUserId)
        });
        // Check for pending follow request
        const pendingRequest = yield db.collection('followRequests').findOne({
            requester_id: new mongodb_1.ObjectId(currentUserId),
            requested_id: new mongodb_1.ObjectId(userId),
            status: 'pending'
        });
        yield client.close();
        return res.json({
            isFollowing: !!isFollowing,
            isPending: !!pendingRequest,
            followsBack: !!followsBack,
            isMutualFollow: !!isFollowing && !!followsBack
        });
    }
    catch (error) {
        console.error('Follow status error:', error);
        return res.status(500).json({ message: error.message || 'Failed to check follow status' });
    }
}));
// DELETE /api/users/:userId/follow - Unfollow user
router.delete('/:userId/follow', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Remove from following
        yield db.collection('follows').deleteOne({
            follower_id: new mongodb_1.ObjectId(currentUserId),
            following_id: new mongodb_1.ObjectId(userId)
        });
        // Update counts
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(currentUserId) }, { $inc: { following: -1 } });
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $inc: { followers: -1 } });
        yield client.close();
        return res.json({ message: 'Unfollowed successfully' });
    }
    catch (error) {
        console.error('Unfollow error:', error);
        return res.status(500).json({ message: error.message || 'Failed to unfollow user' });
    }
}));
// GET /api/users/:userId/followers - Get user followers
router.get('/:userId/followers', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId; // From auth middleware
        console.log('[FOLLOWERS] Fetching followers for user:', userId);
        // Try cache first
        const cacheKey = `followers:${userId}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for followers: ${userId}`);
            return res.json(cached);
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Check if target user is private
        const targetUser = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!targetUser) {
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        const isPrivate = targetUser.is_private || false;
        const isOwnProfile = currentUserId && (currentUserId === userId ||
            currentUserId.toString() === userId.toString() ||
            new mongodb_1.ObjectId(currentUserId).equals(new mongodb_1.ObjectId(userId)));
        console.log('[FOLLOWERS] Privacy check:', {
            isPrivate,
            isOwnProfile,
            currentUserId: currentUserId === null || currentUserId === void 0 ? void 0 : currentUserId.toString(),
            userId: userId === null || userId === void 0 ? void 0 : userId.toString()
        });
        // If private account, check if current user is following
        if (isPrivate && !isOwnProfile) {
            if (!currentUserId) {
                yield client.close();
                return res.status(403).json({ message: 'This account is private' });
            }
            const isFollowing = yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: new mongodb_1.ObjectId(userId),
                status: 'accepted'
            });
            if (!isFollowing) {
                yield client.close();
                return res.status(403).json({ message: 'This account is private' });
            }
        }
        const follows = yield db.collection('follows').find({
            following_id: new mongodb_1.ObjectId(userId),
            status: 'accepted'
        }).toArray();
        console.log('[FOLLOWERS] Found', follows.length, 'follow records');
        const followerIds = follows.map(f => f.follower_id);
        const followers = yield db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray();
        console.log('[FOLLOWERS] Found', followers.length, 'user records');
        // Check which followers the current user is following back
        const currentUserFollowing = currentUserId ? yield db.collection('follows').find({
            follower_id: new mongodb_1.ObjectId(currentUserId),
            status: 'accepted'
        }).toArray() : [];
        const followingIds = new Set(currentUserFollowing.map(f => f.following_id.toString()));
        yield client.close();
        const result = followers.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || null,
            is_private: user.is_private || false,
            isFollowing: followingIds.has(user._id.toString())
        }));
        console.log('[FOLLOWERS] Returning', result.length, 'followers');
        const response = { data: result };
        // Cache for 10 minutes (600 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, response, 600);
        return res.json(response);
    }
    catch (error) {
        console.error('Get followers error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get followers' });
    }
}));
// DEBUG: Check follower data integrity
router.get('/:userId/followers/debug', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Get all follow records
        const follows = yield db.collection('follows').find({
            following_id: new mongodb_1.ObjectId(userId)
        }).toArray();
        // Get follower IDs
        const followerIds = follows.map(f => f.follower_id);
        // Get users
        const users = yield db.collection('users').find({
            _id: { $in: followerIds }
        }).toArray();
        // Get user's profile
        const userProfile = yield db.collection('users').findOne({
            _id: new mongodb_1.ObjectId(userId)
        });
        yield client.close();
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
            userProfileFollowersCount: (userProfile === null || userProfile === void 0 ? void 0 : userProfile.followers) || 0,
            userProfileFollowingCount: (userProfile === null || userProfile === void 0 ? void 0 : userProfile.following) || 0
        });
    }
    catch (error) {
        console.error('Debug followers error:', error);
        return res.status(500).json({ message: error.message });
    }
}));
// GET /api/users/:userId/following - Get user following
router.get('/:userId/following', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const currentUserId = req.userId; // From auth middleware
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Check if target user is private
        const targetUser = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!targetUser) {
            yield client.close();
            return res.status(404).json({ message: 'User not found' });
        }
        const isPrivate = targetUser.is_private || false;
        const isOwnProfile = currentUserId && (currentUserId === userId ||
            currentUserId.toString() === userId.toString() ||
            new mongodb_1.ObjectId(currentUserId).equals(new mongodb_1.ObjectId(userId)));
        console.log('[FOLLOWING] Privacy check:', {
            isPrivate,
            isOwnProfile,
            currentUserId: currentUserId === null || currentUserId === void 0 ? void 0 : currentUserId.toString(),
            userId: userId === null || userId === void 0 ? void 0 : userId.toString()
        });
        // If private account, check if current user is following
        if (isPrivate && !isOwnProfile) {
            if (!currentUserId) {
                yield client.close();
                return res.status(403).json({ message: 'This account is private' });
            }
            const isFollowing = yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: new mongodb_1.ObjectId(userId),
                status: 'accepted'
            });
            if (!isFollowing) {
                yield client.close();
                return res.status(403).json({ message: 'This account is private' });
            }
        }
        const follows = yield db.collection('follows').find({
            follower_id: new mongodb_1.ObjectId(userId),
            status: 'accepted'
        }).toArray();
        const followingIds = follows.map(f => f.following_id);
        const following = yield db.collection('users').find({
            _id: { $in: followingIds }
        }).toArray();
        // For following list, all users are already being followed (isFollowing = true)
        // This is because we're showing who the user is following
        yield client.close();
        const result = following.map(user => ({
            id: user._id.toString(),
            username: user.username,
            full_name: user.name || user.full_name || '',
            avatar_url: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            is_verified: user.is_verified || user.verified || false,
            badge_type: user.badge_type || null,
            is_private: user.is_private || false,
            isFollowing: true // Always true in following list
        }));
        return res.json({ data: result });
    }
    catch (error) {
        console.error('Get following error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get following' });
    }
}));
// DELETE /api/users/delete - Delete user account
router.delete('/delete', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Delete user
        yield db.collection('users').deleteOne({ _id: new mongodb_1.ObjectId(userId) });
        // Delete user's posts
        yield db.collection('posts').deleteMany({ userId: new mongodb_1.ObjectId(userId) });
        // Delete user's follows
        yield db.collection('follows').deleteMany({
            $or: [
                { follower_id: new mongodb_1.ObjectId(userId) },
                { following_id: new mongodb_1.ObjectId(userId) }
            ]
        });
        yield client.close();
        return res.json({ message: 'Account deleted successfully' });
    }
    catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({ message: error.message || 'Failed to delete account' });
    }
}));
// GET /api/users/blocked - Get blocked users
router.get('/blocked', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        const blocks = yield db.collection('blocked_users').find({
            userId: new mongodb_1.ObjectId(userId)
        }).toArray();
        const blockedIds = blocks.map(b => b.blockedUserId);
        const blockedUsers = yield db.collection('users').find({
            _id: { $in: blockedIds }
        }).toArray();
        return res.json({
            blocked: blockedUsers.map(user => ({
                id: user._id.toString(),
                username: user.username,
                name: user.full_name || user.name || '',
                avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
                verified: user.is_verified || user.verified || false
            }))
        });
    }
    catch (error) {
        console.error('Get blocked users error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get blocked users' });
    }
}));
// POST /api/users/:userId/block - Block/Unblock user
router.post('/:userId/block', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }
        const db = yield getDb();
        const targetUserId = new mongodb_1.ObjectId(userId);
        // Check if already blocked
        const existingBlock = yield db.collection('blocked_users').findOne({
            userId: new mongodb_1.ObjectId(currentUserId),
            blockedUserId: targetUserId
        });
        if (existingBlock) {
            // Unblock
            yield db.collection('blocked_users').deleteOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                blockedUserId: targetUserId
            });
            return res.json({ message: 'User unblocked', isBlocked: false });
        }
        else {
            // Block
            yield db.collection('blocked_users').insertOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                blockedUserId: targetUserId,
                createdAt: new Date()
            });
            // Also unfollow automatically
            yield db.collection('follows').deleteMany({
                $or: [
                    { follower_id: new mongodb_1.ObjectId(currentUserId), following_id: targetUserId },
                    { follower_id: targetUserId, following_id: new mongodb_1.ObjectId(currentUserId) }
                ]
            });
            return res.json({ message: 'User blocked', isBlocked: true });
        }
    }
    catch (error) {
        console.error('Block user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to block user' });
    }
}));
// GET /api/users/restricted - Get restricted users
router.get('/restricted', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        const restrictions = yield db.collection('restricted_users').find({
            userId: new mongodb_1.ObjectId(userId)
        }).toArray();
        const restrictedIds = restrictions.map(r => r.restrictedUserId);
        const restrictedUsers = yield db.collection('users').find({
            _id: { $in: restrictedIds }
        }).toArray();
        return res.json({
            restricted: restrictedUsers.map(user => ({
                id: user._id.toString(),
                username: user.username,
                name: user.full_name || user.name || '',
                avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
                verified: user.is_verified || user.verified || false
            }))
        });
    }
    catch (error) {
        console.error('Get restricted users error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get restricted users' });
    }
}));
// POST /api/users/:userId/restrict - Restrict/Unrestrict user
router.post('/:userId/restrict', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot restrict yourself' });
        }
        const db = yield getDb();
        const targetUserId = new mongodb_1.ObjectId(userId);
        // Check if already restricted
        const existingRestriction = yield db.collection('restricted_users').findOne({
            userId: new mongodb_1.ObjectId(currentUserId),
            restrictedUserId: targetUserId
        });
        if (existingRestriction) {
            // Unrestrict
            yield db.collection('restricted_users').deleteOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                restrictedUserId: targetUserId
            });
            return res.json({ message: 'User unrestricted', isRestricted: false });
        }
        else {
            // Restrict
            yield db.collection('restricted_users').insertOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                restrictedUserId: targetUserId,
                createdAt: new Date()
            });
            return res.json({ message: 'User restricted', isRestricted: true });
        }
    }
    catch (error) {
        console.error('Restrict user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to restrict user' });
    }
}));
// GET /api/users/:userId/posts - Get user's posts (supports both userId and username)
router.get('/:userId/posts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        // Try cache first
        const cacheKey = `user_posts:${userId}:${page}:${limit}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for user posts: ${userId} page ${page}`);
            return res.json(cached);
        }
        const client = yield mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db();
        // Check if userId is an ObjectId or username
        let userObjectId;
        let targetUser;
        if (mongodb_1.ObjectId.isValid(userId) && userId.length === 24) {
            // It's a valid ObjectId
            userObjectId = new mongodb_1.ObjectId(userId);
            targetUser = yield db.collection('users').findOne({ _id: userObjectId });
        }
        else {
            // It's a username, look up the user
            targetUser = yield db.collection('users').findOne({ username: userId });
            if (!targetUser) {
                yield client.close();
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            userObjectId = targetUser._id;
        }
        if (!targetUser) {
            yield client.close();
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Get current user ID from token (optional)
        let currentUserId = null;
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                currentUserId = decoded.userId;
            }
        }
        catch (err) {
            // Token is optional
        }
        // PRIVACY CHECK: If account is private and viewer is not following, return empty
        const isOwnProfile = currentUserId && currentUserId === userObjectId.toString();
        const isPrivate = targetUser.is_private || false;
        if (isPrivate && !isOwnProfile) {
            // Check if current user is following
            const isFollowing = currentUserId ? yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: userObjectId,
                status: 'accepted'
            }) : null;
            if (!isFollowing) {
                // Private account and not following - return empty
                yield client.close();
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
                });
            }
        }
        // Get total count
        const total = yield db.collection('posts').countDocuments({
            user_id: userObjectId,
            is_archived: { $ne: true }
        });
        // Get posts with user data
        const posts = yield db.collection('posts').aggregate([
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
        ]).toArray();
        // Get likes and comments count for each post
        const postsWithCounts = yield Promise.all(posts.map((post) => __awaiter(void 0, void 0, void 0, function* () {
            const likesCount = yield db.collection('likes').countDocuments({ post_id: post._id });
            const commentsCount = yield db.collection('comments').countDocuments({
                post_id: post._id,
                is_deleted: { $ne: true }
            });
            // Check if current user liked (if authenticated)
            let is_liked = false;
            if (req.userId) {
                const like = yield db.collection('likes').findOne({
                    user_id: new mongodb_1.ObjectId(req.userId),
                    post_id: post._id
                });
                is_liked = !!like;
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
            };
        })));
        yield client.close();
        const response = {
            success: true,
            data: postsWithCounts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        };
        // Cache for 3 minutes (180 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, response, 180);
        return res.json(response);
    }
    catch (error) {
        console.error('Get user posts error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get user posts' });
    }
}));
// POST /api/users/conversations - Create conversation with Instagram-style rules
router.post('/conversations', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { recipientId } = req.body;
        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient ID is required' });
        }
        if (currentUserId === recipientId) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' });
        }
        const db = yield getDb();
        // Get both users
        const [currentUser, recipient] = yield Promise.all([
            db.collection('users').findOne({ _id: new mongodb_1.ObjectId(currentUserId) }),
            db.collection('users').findOne({ _id: new mongodb_1.ObjectId(recipientId) })
        ]);
        if (!recipient) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check follow status
        const [userFollowsRecipient, recipientFollowsUser] = yield Promise.all([
            db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: new mongodb_1.ObjectId(recipientId)
            }),
            db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(recipientId),
                following_id: new mongodb_1.ObjectId(currentUserId)
            })
        ]);
        const currentUserIsPrivate = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.is_private) || false;
        const recipientIsPrivate = recipient.is_private || false;
        const isMutualFollow = !!userFollowsRecipient && !!recipientFollowsUser;
        // Instagram-style messaging rules:
        // 1. Both accounts public → can message
        // 2. Mutual followers → can message
        // 3. One follows but not mutual → goes to message requests
        // 4. Private account not following → cannot message (need follow request first)
        let canMessage = false;
        let isMessageRequest = false;
        let reason = '';
        if (isMutualFollow) {
            // Rule 1: Mutual followers can always message
            canMessage = true;
        }
        else if (!recipientIsPrivate && !currentUserIsPrivate) {
            // Rule 2: Both public accounts can message
            canMessage = true;
        }
        else if (userFollowsRecipient && !recipientFollowsUser) {
            // Rule 3: User follows recipient but not mutual → message request
            canMessage = true;
            isMessageRequest = true;
            reason = 'Message will go to recipient\'s message requests';
        }
        else if (!userFollowsRecipient && recipientIsPrivate) {
            // Rule 4: Recipient is private and user doesn't follow → need follow request first
            canMessage = false;
            reason = 'You need to follow this user first to send messages';
        }
        else {
            // Default: allow but as message request
            canMessage = true;
            isMessageRequest = true;
            reason = 'Message will go to recipient\'s message requests';
        }
        if (!canMessage) {
            return res.status(403).json({
                message: reason,
                canMessage: false,
                isMessageRequest: false
            });
        }
        // Return success - conversation will be created in Firebase
        return res.json({
            message: isMessageRequest ? reason : 'Can send message',
            canMessage: true,
            isMessageRequest,
            isMutualFollow,
            conversationId: `${[currentUserId, recipientId].sort().join('_')}`,
            recipientId
        });
    }
    catch (error) {
        console.error('Conversation creation error:', error);
        return res.status(500).json({ message: error.message || 'Failed to create conversation' });
    }
}));
// GET /api/users/message-requests - Get message requests
router.get('/message-requests', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        // Get message requests where user is recipient and not mutual followers
        const requests = yield db.collection('message_requests').find({
            recipientId: new mongodb_1.ObjectId(userId),
            status: 'pending'
        }).sort({ createdAt: -1 }).toArray();
        // Get sender details
        const senderIds = requests.map(r => r.senderId);
        const senders = yield db.collection('users').find({
            _id: { $in: senderIds }
        }).project({ password: 0 }).toArray();
        const sendersMap = new Map(senders.map(s => [s._id.toString(), s]));
        const formattedRequests = requests.map(req => {
            var _a, _b, _c, _d;
            return ({
                id: req._id.toString(),
                senderId: req.senderId.toString(),
                sender: {
                    _id: (_a = sendersMap.get(req.senderId.toString())) === null || _a === void 0 ? void 0 : _a._id.toString(),
                    username: (_b = sendersMap.get(req.senderId.toString())) === null || _b === void 0 ? void 0 : _b.username,
                    fullName: (_c = sendersMap.get(req.senderId.toString())) === null || _c === void 0 ? void 0 : _c.full_name,
                    profileImage: (_d = sendersMap.get(req.senderId.toString())) === null || _d === void 0 ? void 0 : _d.avatar_url
                },
                conversationId: req.conversationId,
                lastMessage: req.lastMessage,
                createdAt: req.createdAt
            });
        });
        return res.json({
            success: true,
            data: formattedRequests
        });
    }
    catch (error) {
        console.error('Get message requests error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get message requests' });
    }
}));
// POST /api/users/message-requests/:requestId/accept - Accept message request (auto follow back)
router.post('/message-requests/:requestId/accept', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { requestId } = req.params;
        const db = yield getDb();
        const request = yield db.collection('message_requests').findOne({
            _id: new mongodb_1.ObjectId(requestId),
            recipientId: new mongodb_1.ObjectId(userId)
        });
        if (!request) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        // Accept request
        yield db.collection('message_requests').updateOne({ _id: new mongodb_1.ObjectId(requestId) }, { $set: { status: 'accepted', acceptedAt: new Date() } });
        // Auto follow back
        const existingFollow = yield db.collection('follows').findOne({
            follower_id: new mongodb_1.ObjectId(userId),
            following_id: request.senderId
        });
        if (!existingFollow) {
            yield db.collection('follows').insertOne({
                follower_id: new mongodb_1.ObjectId(userId),
                following_id: request.senderId,
                createdAt: new Date()
            });
        }
        return res.json({
            success: true,
            message: 'Message request accepted and followed back'
        });
    }
    catch (error) {
        console.error('Accept message request error:', error);
        return res.status(500).json({ message: error.message || 'Failed to accept message request' });
    }
}));
// DELETE /api/users/message-requests/:requestId - Delete message request
router.delete('/message-requests/:requestId', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { requestId } = req.params;
        const db = yield getDb();
        const result = yield db.collection('message_requests').deleteOne({
            _id: new mongodb_1.ObjectId(requestId),
            recipientId: new mongodb_1.ObjectId(userId)
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        return res.json({
            success: true,
            message: 'Message request deleted'
        });
    }
    catch (error) {
        console.error('Delete message request error:', error);
        return res.status(500).json({ message: error.message || 'Failed to delete message request' });
    }
}));
// POST /api/users/message-requests/:requestId/block - Block user from message request
router.post('/message-requests/:requestId/block', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { requestId } = req.params;
        const db = yield getDb();
        const request = yield db.collection('message_requests').findOne({
            _id: new mongodb_1.ObjectId(requestId),
            recipientId: new mongodb_1.ObjectId(userId)
        });
        if (!request) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        // Block user
        yield db.collection('blocked_users').insertOne({
            userId: new mongodb_1.ObjectId(userId),
            blockedUserId: request.senderId,
            createdAt: new Date()
        });
        // Delete message request
        yield db.collection('message_requests').deleteOne({
            _id: new mongodb_1.ObjectId(requestId)
        });
        // Remove any follows
        yield db.collection('follows').deleteMany({
            $or: [
                { follower_id: new mongodb_1.ObjectId(userId), following_id: request.senderId },
                { follower_id: request.senderId, following_id: new mongodb_1.ObjectId(userId) }
            ]
        });
        return res.json({
            success: true,
            message: 'User blocked'
        });
    }
    catch (error) {
        console.error('Block user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to block user' });
    }
}));
// POST /api/users/message-requests/:requestId/report - Report user from message request
router.post('/message-requests/:requestId/report', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { requestId } = req.params;
        const { reason } = req.body;
        const db = yield getDb();
        const request = yield db.collection('message_requests').findOne({
            _id: new mongodb_1.ObjectId(requestId),
            recipientId: new mongodb_1.ObjectId(userId)
        });
        if (!request) {
            return res.status(404).json({ message: 'Message request not found' });
        }
        // Create report
        yield db.collection('reports').insertOne({
            reporterId: new mongodb_1.ObjectId(userId),
            reportedUserId: request.senderId,
            type: 'message_request',
            reason: reason || 'Inappropriate message',
            messageRequestId: new mongodb_1.ObjectId(requestId),
            createdAt: new Date(),
            status: 'pending'
        });
        // Delete message request
        yield db.collection('message_requests').deleteOne({
            _id: new mongodb_1.ObjectId(requestId)
        });
        return res.json({
            success: true,
            message: 'User reported'
        });
    }
    catch (error) {
        console.error('Report user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to report user' });
    }
}));
// PUT /api/users/privacy - Update account privacy
router.put('/privacy', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { isPrivate } = req.body;
        const db = yield getDb();
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: { is_private: !!isPrivate, updatedAt: new Date() } });
        return res.json({
            success: true,
            message: 'Privacy settings updated',
            isPrivate: !!isPrivate
        });
    }
    catch (error) {
        console.error('Update privacy error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update privacy' });
    }
}));
// GET /api/users/follow-requests - Get pending follow requests (received)
router.get('/follow-requests', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const db = yield getDb();
        const requests = yield db.collection('followRequests').find({
            requested_id: new mongodb_1.ObjectId(currentUserId),
            status: 'pending'
        }).sort({ created_at: -1 }).toArray();
        // Get requester details
        const requesterIds = requests.map(r => r.requester_id);
        const requesters = yield db.collection('users').find({
            _id: { $in: requesterIds }
        }).project({
            password: 0
        }).toArray();
        // Map requests with user data
        const formattedRequests = requests.map(req => {
            const requester = requesters.find(u => u._id.toString() === req.requester_id.toString());
            return {
                id: req._id.toString(),
                requester: {
                    id: requester === null || requester === void 0 ? void 0 : requester._id.toString(),
                    username: requester === null || requester === void 0 ? void 0 : requester.username,
                    full_name: (requester === null || requester === void 0 ? void 0 : requester.full_name) || (requester === null || requester === void 0 ? void 0 : requester.name),
                    avatar_url: (requester === null || requester === void 0 ? void 0 : requester.avatar_url) || (requester === null || requester === void 0 ? void 0 : requester.avatar) || '/placeholder-user.jpg',
                    is_verified: (requester === null || requester === void 0 ? void 0 : requester.is_verified) || false,
                    badge_type: requester === null || requester === void 0 ? void 0 : requester.badge_type
                },
                created_at: req.created_at,
                status: req.status
            };
        });
        return res.json({
            success: true,
            data: formattedRequests,
            count: formattedRequests.length
        });
    }
    catch (error) {
        console.error('Get follow requests error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get follow requests'
        });
    }
}));
// POST /api/users/follow-requests/:requestId/approve - Approve follow request
router.post('/follow-requests/:requestId/approve', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { requestId } = req.params;
        const db = yield getDb();
        // Find the request
        const request = yield db.collection('followRequests').findOne({
            _id: new mongodb_1.ObjectId(requestId),
            requested_id: new mongodb_1.ObjectId(currentUserId),
            status: 'pending'
        });
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Follow request not found or already processed'
            });
        }
        // Update request status
        yield db.collection('followRequests').updateOne({ _id: new mongodb_1.ObjectId(requestId) }, {
            $set: {
                status: 'approved',
                updated_at: new Date()
            }
        });
        // Create follow relationship
        yield db.collection('follows').insertOne({
            follower_id: request.requester_id,
            following_id: request.requested_id,
            status: 'accepted',
            createdAt: new Date()
        });
        // Update follower counts (ACCEPTED ONLY)
        const followerCount = yield db.collection('follows').countDocuments({
            following_id: new mongodb_1.ObjectId(currentUserId),
            status: 'accepted'
        });
        // Send notification
        try {
            const { notifyFollowRequestAccepted } = require('../lib/notifications');
            yield notifyFollowRequestAccepted(request.requester_id.toString(), currentUserId);
        }
        catch (err) {
            console.error('[FOLLOW REQUEST] Notification error:', err);
        }
        return res.json({
            success: true,
            message: 'Follow request approved',
            followerCount
        });
    }
    catch (error) {
        console.error('Approve follow request error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve follow request'
        });
    }
}));
// POST /api/users/follow-requests/:requestId/decline - Decline follow request
router.post('/follow-requests/:requestId/decline', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { requestId } = req.params;
        const db = yield getDb();
        // Find the request
        const request = yield db.collection('followRequests').findOne({
            _id: new mongodb_1.ObjectId(requestId),
            requested_id: new mongodb_1.ObjectId(currentUserId),
            status: 'pending'
        });
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Follow request not found or already processed'
            });
        }
        // Update request status to declined
        yield db.collection('followRequests').updateOne({ _id: new mongodb_1.ObjectId(requestId) }, {
            $set: {
                status: 'declined',
                updated_at: new Date()
            }
        });
        return res.json({
            success: true,
            message: 'Follow request declined'
        });
    }
    catch (error) {
        console.error('Decline follow request error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to decline follow request'
        });
    }
}));
// GET /api/users/:userId/follow-request-status - Check follow request status
router.get('/:userId/follow-request-status', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        const db = yield getDb();
        // Check for pending request
        const request = yield db.collection('followRequests').findOne({
            requester_id: new mongodb_1.ObjectId(currentUserId),
            requested_id: new mongodb_1.ObjectId(userId),
            status: 'pending'
        });
        if (request) {
            return res.json({
                success: true,
                isPending: true,
                status: 'pending',
                requestId: request._id.toString()
            });
        }
        return res.json({
            success: true,
            isPending: false,
            status: 'none'
        });
    }
    catch (error) {
        console.error('Check follow request status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to check follow request status'
        });
    }
}));
// POST /api/users/push-token - Register push notification token
router.post('/push-token', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { token, platform } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'Push token is required' });
        }
        console.log('[PUSH TOKEN] Registering token for user:', userId, 'Platform:', platform);
        const db = yield getDb();
        // Update user's push token
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                pushToken: token,
                pushTokenPlatform: platform || 'unknown',
                pushTokenUpdatedAt: new Date()
            }
        });
        console.log('[PUSH TOKEN] ✅ Token registered successfully');
        return res.json({
            success: true,
            message: 'Push token registered successfully'
        });
    }
    catch (error) {
        console.error('[PUSH TOKEN] ❌ Error registering token:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to register push token'
        });
    }
}));
// POST /api/users/fcm-token - Register FCM token for push notifications
router.post('/fcm-token', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { fcmToken } = req.body;
        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' });
        }
        console.log('[FCM] Registering token for user:', userId);
        const db = yield getDb();
        // Update user's FCM token
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                fcmToken: fcmToken,
                fcmTokenUpdatedAt: new Date()
            }
        });
        console.log('[FCM] ✅ Token registered successfully');
        return res.json({
            success: true,
            message: 'FCM token registered successfully'
        });
    }
    catch (error) {
        console.error('[FCM] ❌ Error registering token:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to register FCM token'
        });
    }
}));
// DELETE /api/users/fcm-token - Unregister FCM token
router.delete('/fcm-token', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        console.log('[FCM] Unregistering token for user:', userId);
        const db = yield getDb();
        // Remove user's FCM token
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                fcmToken: null,
                fcmTokenUpdatedAt: new Date()
            }
        });
        console.log('[FCM] ✅ Token unregistered successfully');
        return res.json({
            success: true,
            message: 'FCM token unregistered successfully'
        });
    }
    catch (error) {
        console.error('[FCM] ❌ Error unregistering token:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to unregister FCM token'
        });
    }
}));
// DELETE /api/users/delete - Delete account and all data
router.delete('/delete', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { password } = req.body;
        const db = yield getDb();
        // 1. Verify user exists and password is correct
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordCorrect = yield bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Incorrect password' });
        }
        console.log(`[DELETE ACCOUNT] Starting cleanup for user: ${userId} (${user.username})`);
        const userObjectId = new mongodb_1.ObjectId(userId);
        // 2. Delete all user-generated content and interactions
        yield Promise.all([
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
        ]);
        // 3. Finally delete the user itself
        yield db.collection('users').deleteOne({ _id: userObjectId });
        console.log(`[DELETE ACCOUNT] Cleanup complete for user: ${userId}`);
        return res.json({ message: 'Account and all data deleted successfully' });
    }
    catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({ message: error.message || 'Failed to delete account' });
    }
}));
exports.default = router;
// POST /api/users/change-password - Change password
router.post('/change-password', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        const db = yield getDb();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Verify current password
        const bcrypt = require('bcryptjs');
        const isValid = yield bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        // Hash new password
        const hashedPassword = yield bcrypt.hash(newPassword, 10);
        // Update password
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                password: hashedPassword,
                updatedAt: new Date()
            }
        });
        return res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: error.message || 'Failed to change password' });
    }
}));
// GET /api/users/muted - Get muted users
router.get('/muted', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        // Get muted user IDs
        const mutedRecords = yield db.collection('muted').find({
            userId: new mongodb_1.ObjectId(userId)
        }).toArray();
        const mutedUserIds = mutedRecords.map(r => r.mutedUserId);
        // Get user details
        const users = yield db.collection('users').find({
            _id: { $in: mutedUserIds }
        }).project({
            password: 0
        }).toArray();
        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.full_name || user.name || '',
            avatar: user.avatar_url || user.avatar || '/placeholder-user.jpg',
            verified: user.is_verified || user.verified || false
        }));
        return res.json({ muted: formattedUsers });
    }
    catch (error) {
        console.error('Get muted users error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get muted users' });
    }
}));
// POST /api/users/:userId/mute - Mute/Unmute user
router.post('/:userId/mute', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUserId = req.userId;
        const { userId } = req.params;
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot mute yourself' });
        }
        const db = yield getDb();
        // Check if already muted
        const existingMute = yield db.collection('muted').findOne({
            userId: new mongodb_1.ObjectId(currentUserId),
            mutedUserId: new mongodb_1.ObjectId(userId)
        });
        if (existingMute) {
            // Unmute
            yield db.collection('muted').deleteOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                mutedUserId: new mongodb_1.ObjectId(userId)
            });
            return res.json({ message: 'User unmuted', isMuted: false });
        }
        else {
            // Mute
            yield db.collection('muted').insertOne({
                userId: new mongodb_1.ObjectId(currentUserId),
                mutedUserId: new mongodb_1.ObjectId(userId),
                createdAt: new Date()
            });
            return res.json({ message: 'User muted', isMuted: true });
        }
    }
    catch (error) {
        console.error('Mute user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to mute user' });
    }
}));
// GET /api/users/login-activity - Get login activity
router.get('/login-activity', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        const activity = yield db.collection('loginActivity').find({
            userId: new mongodb_1.ObjectId(userId)
        }).sort({ timestamp: -1 }).limit(10).toArray();
        const formattedActivity = activity.map(a => ({
            device: a.device || 'Unknown Device',
            location: a.location || 'Unknown Location',
            timestamp: a.timestamp,
            ipAddress: a.ipAddress
        }));
        return res.json({ activity: formattedActivity });
    }
    catch (error) {
        console.error('Get login activity error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get login activity' });
    }
}));
// PATCH /api/users/me - Update user profile (new endpoint)
router.patch('/me', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { name, username, email, bio, website, gender, birthday, location } = req.body;
        const db = yield getDb();
        const updateData = { updatedAt: new Date() };
        if (name !== undefined) {
            updateData.name = name;
            updateData.full_name = name;
        }
        if (username !== undefined) {
            // Check if username is taken
            const existingUser = yield db.collection('users').findOne({
                username,
                _id: { $ne: new mongodb_1.ObjectId(userId) }
            });
            if (existingUser) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
            updateData.username = username;
        }
        if (email !== undefined)
            updateData.email = email;
        if (bio !== undefined)
            updateData.bio = bio;
        if (website !== undefined)
            updateData.website = website;
        if (gender !== undefined)
            updateData.gender = gender;
        if (birthday !== undefined)
            updateData.birthday = birthday;
        if (location !== undefined)
            updateData.location = location;
        if (req.body.phone !== undefined)
            updateData.phone = req.body.phone;
        if (req.body.address !== undefined) {
            updateData.address = req.body.address;
            updateData.location = req.body.address; // Sync for compatibility
        }
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: updateData });
        const updatedUser = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) }, { projection: { password: 0 } });
        return res.json({
            id: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser._id.toString(),
            username: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.username,
            email: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.email,
            name: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.full_name) || (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.name) || '',
            bio: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.bio) || '',
            website: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.website) || '',
            gender: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.gender) || '',
            birthday: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.birthday) || '',
            location: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.location) || '',
            avatar: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.avatar_url) || (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.avatar) || '/placeholder-user.jpg',
            verified: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.is_verified) || (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.verified) || false,
            isAnonymousMode: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.isAnonymousMode) || false,
            anonymousPersona: (updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.anonymousPersona) || null
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update user' });
    }
}));
// POST /api/users/me/toggle-anonymous - Toggle anonymous mode
router.post('/me/toggle-anonymous', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield getDb();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const currentMode = user.isAnonymousMode || false;
        const newMode = !currentMode;
        const updateData = {
            isAnonymousMode: newMode,
            updatedAt: new Date()
        };
        // If turning ON and no persona exists, generate one
        if (newMode && !user.anonymousPersona) {
            updateData.anonymousPersona = (0, anonymous_utils_1.generateAnonymousPersona)();
        }
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: updateData });
        // Invalidate profile cache
        yield (0, redis_1.cacheInvalidate)(`userProfile:${userId}`);
        return res.json({
            success: true,
            isAnonymousMode: newMode,
            anonymousPersona: updateData.anonymousPersona || user.anonymousPersona,
            message: newMode ? 'Anonymous mode enabled' : 'Anonymous mode disabled'
        });
    }
    catch (error) {
        console.error('Toggle anonymous error:', error);
        return res.status(500).json({ message: error.message || 'Failed to toggle anonymous mode' });
    }
}));
// GET /api/users/:username/posts - Get user's posts (ONLY their own posts, not feed)
router.get('/:username/posts', authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username } = req.params;
        const currentUserId = req.userId;
        const db = yield getDb();
        // Find user by username
        const targetUser = yield db.collection('users').findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if viewing own profile
        const isOwnProfile = targetUser._id.toString() === currentUserId;
        // Check if account is private
        const isPrivate = targetUser.is_private || false;
        console.log('[PROFILE POSTS] User:', username, 'isPrivate:', isPrivate, 'isOwnProfile:', isOwnProfile);
        // If private account and not own profile, check if following
        if (isPrivate && !isOwnProfile) {
            const followRecord = yield db.collection('follows').findOne({
                follower_id: new mongodb_1.ObjectId(currentUserId),
                following_id: targetUser._id
            });
            console.log('[PROFILE POSTS] Follow record found:', !!followRecord);
            if (!followRecord) {
                // Not following private account - return empty posts
                console.log('[PROFILE POSTS] Blocking posts - private account, not following');
                return res.json({
                    posts: [],
                    count: 0,
                    message: 'This account is private'
                });
            }
        }
        console.log('[PROFILE POSTS] Allowing posts access');
        // Fetch ONLY this user's posts (not archived)
        const posts = yield db.collection('posts').find({
            user_id: targetUser._id,
            is_archived: { $ne: true }
        }).sort({ created_at: -1 }).toArray();
        // Fetch ONLY this user's reels (not deleted)
        const reels = yield db.collection('reels').find({
            user_id: targetUser._id,
            is_deleted: { $ne: true }
        }).sort({ created_at: -1 }).toArray();
        console.log('[PROFILE POSTS] Posts found:', posts.length);
        console.log('[PROFILE POSTS] Reels found:', reels.length);
        if (reels.length > 0) {
            console.log('[PROFILE POSTS] First reel:', JSON.stringify(reels[0], null, 2));
        }
        // Transform posts to include user info
        const transformedPosts = posts.map(post => ({
            id: post._id.toString(),
            user: (0, anonymous_utils_1.maskAnonymousUser)({
                id: targetUser._id.toString(),
                username: targetUser.username,
                avatar: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
                avatar_url: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
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
        }));
        // Transform reels to match post format
        const transformedReels = reels.map(reel => ({
            id: reel._id.toString(),
            user: {
                id: targetUser._id.toString(),
                username: targetUser.username,
                avatar: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
                avatar_url: targetUser.avatar_url || targetUser.avatar || '/placeholder-user.jpg',
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
        }));
        // Combine and sort by created_at (newest first)
        const allContent = [...transformedPosts, ...transformedReels].sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return res.json({
            posts: allContent,
            count: allContent.length
        });
    }
    catch (error) {
        console.error('Get user posts error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch user posts' });
    }
}));

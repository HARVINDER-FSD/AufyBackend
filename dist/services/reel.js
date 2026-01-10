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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReelService = void 0;
const database_1 = require("../lib/database");
const utils_1 = require("../lib/utils");
const mongodb_1 = require("mongodb");
class ReelService {
    // Create reel
    static createReel(userId, reelData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { video_url, thumbnail_url, title, description, duration } = reelData;
            if (!video_url) {
                throw utils_1.errors.badRequest("Video URL is required for reels");
            }
            if (title && title.length > 255) {
                throw utils_1.errors.badRequest("Title too long (max 255 characters)");
            }
            if (description && description.length > 2200) {
                throw utils_1.errors.badRequest("Description too long (max 2200 characters)");
            }
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const usersCollection = db.collection('users');
            const reelDoc = {
                user_id: new mongodb_1.ObjectId(userId),
                video_url,
                thumbnail_url: thumbnail_url || null,
                title: title || null,
                description: description || null,
                duration: duration || 0,
                view_count: 0,
                is_public: true,
                is_deleted: false,
                created_at: new Date(),
                updated_at: new Date()
            };
            const result = yield reelsCollection.insertOne(reelDoc);
            // Get user data
            const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
            if (!user) {
                throw utils_1.errors.notFound("User not found");
            }
            return {
                id: result.insertedId.toString(),
                user_id: userId,
                video_url,
                thumbnail_url: thumbnail_url || null,
                title: title || null,
                description: description || null,
                duration: duration || 0,
                view_count: 0,
                is_public: true,
                created_at: reelDoc.created_at,
                updated_at: reelDoc.updated_at,
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || false,
                },
                likes_count: 0,
                comments_count: 0,
                is_liked: false,
            };
        });
    }
    // Get reel by ID
    static getReelById(reelId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const usersCollection = db.collection('users');
            const likesCollection = db.collection('likes');
            const commentsCollection = db.collection('comments');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId),
                is_deleted: { $ne: true }
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            // Get user data
            const user = yield usersCollection.findOne({ _id: reel.user_id });
            if (!user) {
                throw utils_1.errors.notFound("User not found");
            }
            // Get likes and comments count
            const likesCount = yield likesCollection.countDocuments({ post_id: reel._id });
            const commentsCount = yield commentsCollection.countDocuments({
                post_id: reel._id,
                is_deleted: { $ne: true }
            });
            // Check if current user liked
            let is_liked = false;
            if (currentUserId) {
                const like = yield likesCollection.findOne({
                    user_id: new mongodb_1.ObjectId(currentUserId),
                    post_id: reel._id
                });
                is_liked = !!like;
            }
            return {
                id: reel._id.toString(),
                user_id: reel.user_id.toString(),
                video_url: reel.video_url,
                thumbnail_url: reel.thumbnail_url,
                title: reel.title,
                description: reel.description,
                duration: reel.duration,
                view_count: reel.view_count || 0,
                is_public: reel.is_public,
                created_at: reel.created_at,
                updated_at: reel.updated_at,
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || false,
                },
                likes_count: likesCount,
                comments_count: commentsCount,
                is_liked
            };
        });
    }
    // Get user's reels
    static getUserReels(userId_1, currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, currentUserId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const usersCollection = db.collection('users');
            const likesCollection = db.collection('likes');
            const commentsCollection = db.collection('comments');
            const matchQuery = {
                user_id: new mongodb_1.ObjectId(userId),
                is_deleted: { $ne: true }
            };
            const total = yield reelsCollection.countDocuments(matchQuery);
            const reels = yield reelsCollection.aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $lookup: {
                        from: 'likes',
                        let: { reelId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$post_id', '$$reelId'] } } }
                        ],
                        as: 'likes'
                    }
                },
                {
                    $lookup: {
                        from: 'comments',
                        let: { reelId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$post_id', '$$reelId'] },
                                    is_deleted: { $ne: true }
                                }
                            }
                        ],
                        as: 'comments'
                    }
                },
                {
                    $addFields: {
                        likes_count: { $size: '$likes' },
                        comments_count: { $size: '$comments' }
                    }
                },
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit },
                {
                    $project: {
                        likes: 0,
                        comments: 0
                    }
                }
            ]).toArray();
            const transformedReels = yield Promise.all(reels.map((reel) => __awaiter(this, void 0, void 0, function* () {
                let is_liked = false;
                if (currentUserId) {
                    const like = yield likesCollection.findOne({
                        user_id: new mongodb_1.ObjectId(currentUserId),
                        post_id: reel._id
                    });
                    is_liked = !!like;
                }
                return {
                    id: reel._id.toString(),
                    user_id: reel.user_id.toString(),
                    video_url: reel.video_url,
                    thumbnail_url: reel.thumbnail_url,
                    title: reel.title,
                    description: reel.description,
                    duration: reel.duration,
                    view_count: reel.view_count || 0,
                    is_public: reel.is_public,
                    created_at: reel.created_at,
                    updated_at: reel.updated_at,
                    user: {
                        id: reel.user._id.toString(),
                        username: reel.user.username,
                        full_name: reel.user.full_name,
                        avatar_url: reel.user.avatar_url,
                        is_verified: reel.user.is_verified || false,
                    },
                    likes_count: reel.likes_count,
                    comments_count: reel.comments_count,
                    is_liked
                };
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: transformedReels,
                pagination: paginationMeta,
            };
        });
    }
    // Get reels feed (discover/explore)
    static getReelsFeed(currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (currentUserId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            console.log('[ReelService] getReelsFeed called with:', { currentUserId, page, limit });
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const likesCollection = db.collection('likes');
            // Build match query - exclude current user's reels if userId provided
            // Note: Using is_archived instead of is_deleted to match actual schema
            const matchQuery = {
                is_archived: { $ne: true }
            };
            if (currentUserId) {
                matchQuery.user_id = { $ne: new mongodb_1.ObjectId(currentUserId) };
            }
            console.log('[ReelService] Match query:', matchQuery);
            // Get total count
            const total = yield reelsCollection.countDocuments(matchQuery);
            console.log('[ReelService] Total reels found with filters:', total);
            // Aggregate reels with user info, likes, and comments count
            const reels = yield reelsCollection.aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $lookup: {
                        from: 'likes',
                        let: { reelId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$post_id', '$$reelId'] } } }
                        ],
                        as: 'likes'
                    }
                },
                {
                    $lookup: {
                        from: 'comments',
                        let: { reelId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$post_id', '$$reelId'] },
                                    is_deleted: { $ne: true }
                                }
                            }
                        ],
                        as: 'comments'
                    }
                },
                {
                    $addFields: {
                        likes_count: { $size: '$likes' },
                        comments_count: { $size: '$comments' },
                        // Scoring algorithm for feed ranking
                        score: {
                            $add: [
                                // Recency factor (newer = higher score)
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                { $subtract: [new Date(), '$created_at'] },
                                                3600000 // milliseconds to hours
                                            ]
                                        },
                                        -0.1
                                    ]
                                },
                                // View count factor
                                { $multiply: [{ $divide: [{ $ifNull: ['$view_count', 0] }, 1000] }, 0.3] },
                                // Likes factor
                                { $multiply: [{ $size: '$likes' }, 0.5] },
                                // Comments factor
                                { $multiply: [{ $size: '$comments' }, 0.3] }
                            ]
                        }
                    }
                },
                { $sort: { score: -1, created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit },
                {
                    $project: {
                        likes: 0,
                        comments: 0
                    }
                }
            ]).toArray();
            // Transform to Reel type and check if current user liked each reel
            const transformedReels = yield Promise.all(reels.map((reel) => __awaiter(this, void 0, void 0, function* () {
                let is_liked = false;
                let is_following = false;
                if (currentUserId) {
                    const like = yield likesCollection.findOne({
                        user_id: new mongodb_1.ObjectId(currentUserId),
                        post_id: reel._id
                    });
                    is_liked = !!like;
                    // Check if current user is following the reel creator
                    const followsCollection = db.collection('follows');
                    const follow = yield followsCollection.findOne({
                        follower_id: new mongodb_1.ObjectId(currentUserId),
                        following_id: reel.user._id
                    });
                    is_following = !!follow;
                }
                return {
                    id: reel._id.toString(),
                    user_id: reel.user_id.toString(),
                    video_url: reel.video_url,
                    thumbnail_url: reel.thumbnail_url,
                    title: reel.title || null,
                    description: reel.caption || reel.description || '',
                    duration: reel.duration || 0,
                    view_count: reel.views_count || reel.view_count || 0,
                    is_public: true, // Default to true since field doesn't exist in schema
                    created_at: reel.created_at,
                    updated_at: reel.updated_at,
                    user: {
                        id: reel.user._id.toString(),
                        username: reel.user.username,
                        full_name: reel.user.full_name,
                        avatar_url: reel.user.avatar_url,
                        is_verified: reel.user.is_verified || false,
                        is_following: is_following, // Add follow state to user object
                    },
                    likes_count: reel.likes_count,
                    comments_count: reel.comments_count,
                    is_liked,
                    is_following, // Add follow state to reel object
                };
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            console.log('[ReelService] Returning', transformedReels.length, 'reels');
            return {
                success: true,
                data: transformedReels,
                pagination: paginationMeta,
            };
        });
    }
    // Delete reel
    static deleteReel(reelId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId)
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            if (reel.user_id.toString() !== userId) {
                throw utils_1.errors.forbidden("You can only delete your own reels");
            }
            // Soft delete
            yield reelsCollection.updateOne({ _id: new mongodb_1.ObjectId(reelId) }, {
                $set: {
                    is_deleted: true,
                    updated_at: new Date()
                }
            });
            // Clear cache
            yield database_1.cache.del(`reel:${reelId}`);
        });
    }
    // Like reel
    static likeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const likesCollection = db.collection('likes');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId),
                is_public: true,
                is_deleted: { $ne: true }
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            const existingLike = yield likesCollection.findOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId)
            });
            if (existingLike) {
                throw utils_1.errors.conflict("Reel already liked");
            }
            yield likesCollection.insertOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId),
                created_at: new Date()
            });
            yield database_1.cache.del(`reel:${reelId}`);
        });
    }
    // Unlike reel
    static unlikeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const result = yield likesCollection.deleteOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId)
            });
            if (result.deletedCount === 0) {
                throw utils_1.errors.notFound("Like not found");
            }
            yield database_1.cache.del(`reel:${reelId}`);
        });
    }
    // Toggle like reel (like if not liked, unlike if already liked)
    static toggleLikeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const likesCollection = db.collection('likes');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId)
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            const existingLike = yield likesCollection.findOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId)
            });
            let liked;
            if (existingLike) {
                // Unlike
                yield likesCollection.deleteOne({
                    user_id: new mongodb_1.ObjectId(userId),
                    post_id: new mongodb_1.ObjectId(reelId)
                });
                liked = false;
            }
            else {
                // Like
                yield likesCollection.insertOne({
                    user_id: new mongodb_1.ObjectId(userId),
                    post_id: new mongodb_1.ObjectId(reelId),
                    created_at: new Date()
                });
                liked = true;
            }
            // Get updated like count
            const likeCount = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
            yield database_1.cache.del(`reel:${reelId}`);
            return { liked, likes: likeCount };
        });
    }
    // Increment share count
    static incrementShareCount(reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId)
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            yield reelsCollection.updateOne({ _id: new mongodb_1.ObjectId(reelId) }, {
                $inc: { shares_count: 1 },
                $set: { updated_at: new Date() }
            });
            yield database_1.cache.del(`reel:${reelId}`);
        });
    }
    // Get reel likes
    static getReelLikes(reelId_1) {
        return __awaiter(this, arguments, void 0, function* (reelId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const total = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
            const likes = yield likesCollection.aggregate([
                { $match: { post_id: new mongodb_1.ObjectId(reelId) } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit },
                {
                    $project: {
                        id: '$user._id',
                        username: '$user.username',
                        full_name: '$user.full_name',
                        avatar_url: '$user.avatar_url',
                        is_verified: '$user.is_verified',
                        liked_at: '$created_at'
                    }
                }
            ]).toArray();
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: likes,
                pagination: paginationMeta,
            };
        });
    }
}
exports.ReelService = ReelService;

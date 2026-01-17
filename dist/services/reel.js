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
                is_archived: false,
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
                thumbnail_url: thumbnail_url || '',
                title: title || '',
                description: description || '',
                duration: duration || 0,
                view_count: 0,
                is_public: true,
                created_at: new Date(),
                updated_at: new Date(),
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url || '',
                    is_verified: user.is_verified || false,
                    is_following: false
                },
                likes_count: 0,
                comments_count: 0,
                is_liked: false,
                is_following: false
            };
        });
    }
    // Get reels feed (discover/explore)
    static getReelsFeed(currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (currentUserId, page = 1, limit = 20) {
            try {
                const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
                const offset = utils_1.pagination.getOffset(validPage, validLimit);
                const db = yield (0, database_1.getDatabase)();
                const reelsCollection = db.collection('reels');
                // Build match query
                const matchQuery = {
                    is_archived: { $ne: true },
                    is_deleted: { $ne: true }
                };
                if (currentUserId && mongodb_1.ObjectId.isValid(currentUserId)) {
                    matchQuery.user_id = { $ne: new mongodb_1.ObjectId(currentUserId) };
                }
                // Get total count
                const total = yield reelsCollection.countDocuments(matchQuery);
                // Simple aggregation
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
                    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                    { $sort: { created_at: -1 } },
                    { $skip: offset },
                    { $limit: validLimit },
                    {
                        $project: {
                            _id: 1,
                            user_id: 1,
                            video_url: 1,
                            thumbnail_url: 1,
                            title: 1,
                            description: 1,
                            duration: 1,
                            view_count: 1,
                            is_public: 1,
                            created_at: 1,
                            updated_at: 1,
                            user: {
                                _id: '$user._id',
                                username: '$user.username',
                                full_name: '$user.full_name',
                                avatar_url: '$user.avatar_url'
                            }
                        }
                    }
                ]).toArray();
                const transformedReels = reels.map((reel) => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: reel._id.toString(),
                        user_id: reel.user_id.toString(),
                        video_url: reel.video_url,
                        thumbnail_url: reel.thumbnail_url || '',
                        title: reel.title || '',
                        description: reel.description || '',
                        duration: reel.duration || 0,
                        view_count: reel.view_count || 0,
                        is_public: reel.is_public || true,
                        created_at: reel.created_at,
                        updated_at: reel.updated_at,
                        user: {
                            id: ((_b = (_a = reel.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || '',
                            username: ((_c = reel.user) === null || _c === void 0 ? void 0 : _c.username) || '',
                            full_name: ((_d = reel.user) === null || _d === void 0 ? void 0 : _d.full_name) || '',
                            avatar_url: ((_e = reel.user) === null || _e === void 0 ? void 0 : _e.avatar_url) || '',
                            is_verified: false,
                            is_following: false
                        },
                        likes_count: 0,
                        comments_count: 0,
                        is_liked: false,
                        is_following: false
                    });
                });
                return {
                    success: true,
                    data: transformedReels,
                    pagination: {
                        page: validPage,
                        limit: validLimit,
                        total,
                        totalPages: Math.ceil(total / validLimit),
                        hasNext: validPage < Math.ceil(total / validLimit),
                        hasPrev: validPage > 1
                    }
                };
            }
            catch (error) {
                console.error('[ReelService] getReelsFeed error:', error);
                throw error;
            }
        });
    }
    // Get user's reels
    static getUserReels(userId_1, currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, currentUserId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
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
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit }
            ]).toArray();
            const transformedReels = reels.map((reel) => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: reel._id.toString(),
                    user_id: reel.user_id.toString(),
                    video_url: reel.video_url,
                    thumbnail_url: reel.thumbnail_url || '',
                    title: reel.title || '',
                    description: reel.description || '',
                    duration: reel.duration || 0,
                    view_count: reel.view_count || 0,
                    is_public: reel.is_public || true,
                    created_at: reel.created_at,
                    updated_at: reel.updated_at,
                    user: {
                        id: ((_b = (_a = reel.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || '',
                        username: ((_c = reel.user) === null || _c === void 0 ? void 0 : _c.username) || '',
                        full_name: ((_d = reel.user) === null || _d === void 0 ? void 0 : _d.full_name) || '',
                        avatar_url: ((_e = reel.user) === null || _e === void 0 ? void 0 : _e.avatar_url) || '',
                        is_verified: false,
                        is_following: false
                    },
                    likes_count: 0,
                    comments_count: 0,
                    is_liked: false,
                    is_following: false
                });
            });
            return {
                success: true,
                data: transformedReels,
                pagination: {
                    page: validPage,
                    limit: validLimit,
                    total,
                    totalPages: Math.ceil(total / validLimit),
                    hasNext: validPage < Math.ceil(total / validLimit),
                    hasPrev: validPage > 1
                }
            };
        });
    }
    // Get reel by ID
    static getReelById(reelId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const reel = yield reelsCollection.findOne({
                _id: new mongodb_1.ObjectId(reelId),
                is_deleted: { $ne: true }
            });
            if (!reel) {
                throw utils_1.errors.notFound("Reel not found");
            }
            // Get user info
            const usersCollection = db.collection('users');
            const user = yield usersCollection.findOne({ _id: reel.user_id });
            return {
                id: reel._id.toString(),
                user_id: reel.user_id.toString(),
                video_url: reel.video_url,
                thumbnail_url: reel.thumbnail_url || '',
                title: reel.title || '',
                description: reel.description || '',
                duration: reel.duration || 0,
                view_count: reel.view_count || 0,
                is_public: reel.is_public || true,
                created_at: reel.created_at,
                updated_at: reel.updated_at,
                user: {
                    id: ((_a = user === null || user === void 0 ? void 0 : user._id) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                    username: (user === null || user === void 0 ? void 0 : user.username) || '',
                    full_name: (user === null || user === void 0 ? void 0 : user.full_name) || '',
                    avatar_url: (user === null || user === void 0 ? void 0 : user.avatar_url) || '',
                    is_verified: (user === null || user === void 0 ? void 0 : user.is_verified) || false,
                    is_following: false
                },
                likes_count: 0,
                comments_count: 0,
                is_liked: false,
                is_following: false
            };
        });
    }
    // Like reel
    static likeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const reelsCollection = db.collection('reels');
            const existingLike = yield likesCollection.findOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId)
            });
            if (existingLike) {
                return { liked: true, likes_count: 0 };
            }
            yield likesCollection.insertOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId),
                created_at: new Date()
            });
            const likeCount = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
            return { liked: true, likes_count: likeCount };
        });
    }
    // Unlike reel
    static unlikeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            yield likesCollection.deleteOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(reelId)
            });
            const likeCount = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
            return { liked: false, likes_count: likeCount };
        });
    }
    // Delete reel (soft delete)
    static deleteReel(reelId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            const result = yield reelsCollection.updateOne({ _id: new mongodb_1.ObjectId(reelId), user_id: new mongodb_1.ObjectId(userId) }, { $set: { is_deleted: true, updated_at: new Date() } });
            if (result.matchedCount === 0) {
                throw utils_1.errors.notFound('Reel not found or you are not the owner');
            }
        });
    }
    // Toggle like/unlike reel
    static toggleLikeReel(userId, reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const existing = yield likesCollection.findOne({ user_id: new mongodb_1.ObjectId(userId), post_id: new mongodb_1.ObjectId(reelId) });
            if (existing) {
                // unlike
                yield likesCollection.deleteOne({ _id: existing._id });
                const count = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
                return { liked: false, likes: count };
            }
            else {
                // like
                yield likesCollection.insertOne({ user_id: new mongodb_1.ObjectId(userId), post_id: new mongodb_1.ObjectId(reelId), created_at: new Date() });
                const count = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
                return { liked: true, likes: count };
            }
        });
    }
    // Increment share count (soft counter)
    static incrementShareCount(reelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const reelsCollection = db.collection('reels');
            // Use $inc on a field that may not exist yet
            yield reelsCollection.updateOne({ _id: new mongodb_1.ObjectId(reelId) }, { $inc: { share_count: 1 }, $set: { updated_at: new Date() } });
        });
    }
    // Get reel likes with pagination
    static getReelLikes(reelId_1) {
        return __awaiter(this, arguments, void 0, function* (reelId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const total = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(reelId) });
            const likes = yield likesCollection.aggregate([
                { $match: { post_id: new mongodb_1.ObjectId(reelId) } },
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit },
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
                    $project: {
                        id: '$user._id',
                        username: '$user.username',
                        full_name: '$user.full_name',
                        avatar_url: '$user.avatar_url',
                        liked_at: '$created_at'
                    }
                }
            ]).toArray();
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return { success: true, data: likes, pagination: paginationMeta };
        });
    }
}
exports.ReelService = ReelService;

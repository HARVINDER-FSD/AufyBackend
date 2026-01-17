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
exports.PostService = void 0;
const database_1 = require("../lib/database");
const utils_1 = require("../lib/utils");
const mongodb_1 = require("mongodb");
const anonymous_utils_1 = require("../lib/anonymous-utils");
class PostService {
    // Create new post
    static createPost(userId, postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { content, media_urls, media_type, location } = postData;
            // Validate post data
            if (!content && (!media_urls || media_urls.length === 0)) {
                throw utils_1.errors.badRequest("Post must have content or media");
            }
            if (content && content.length > 2200) {
                throw utils_1.errors.badRequest("Post content too long (max 2200 characters)");
            }
            if (media_urls && media_urls.length > 10) {
                throw utils_1.errors.badRequest("Maximum 10 media files per post");
            }
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const usersCollection = db.collection('users');
            const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
            if (!user) {
                throw utils_1.errors.notFound("User not found");
            }
            const postDoc = {
                user_id: new mongodb_1.ObjectId(userId),
                content: content || null,
                media_urls: media_urls || null,
                media_type: media_type || 'text',
                location: location || null,
                is_archived: false,
                is_anonymous: user.isAnonymousMode === true,
                created_at: new Date(),
                updated_at: new Date()
            };
            const result = yield postsCollection.insertOne(postDoc);
            const postWithUser = {
                id: result.insertedId.toString(),
                user_id: userId,
                content: postDoc.content,
                media_urls: postDoc.media_urls,
                media_type: postDoc.media_type,
                location: postDoc.location,
                is_archived: postDoc.is_archived,
                created_at: postDoc.created_at,
                updated_at: postDoc.updated_at,
                user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: postDoc.is_anonymous })),
                likes_count: 0,
                comments_count: 0,
                is_liked: false,
            };
            return postWithUser;
        });
    }
    // Get post by ID
    static getPostById(postId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const usersCollection = db.collection('users');
            const likesCollection = db.collection('likes');
            const commentsCollection = db.collection('comments');
            const post = yield postsCollection.findOne({
                _id: new mongodb_1.ObjectId(postId),
                is_archived: { $ne: true }
            });
            if (!post) {
                throw utils_1.errors.notFound("Post not found");
            }
            // Get user data
            const user = yield usersCollection.findOne({ _id: post.user_id });
            if (!user) {
                throw utils_1.errors.notFound("User not found");
            }
            // Get likes and comments count
            const likesCount = yield likesCollection.countDocuments({ post_id: post._id });
            const commentsCount = yield commentsCollection.countDocuments({
                post_id: post._id,
                is_deleted: { $ne: true }
            });
            // Check if current user liked
            let is_liked = false;
            if (currentUserId) {
                const like = yield likesCollection.findOne({
                    user_id: new mongodb_1.ObjectId(currentUserId),
                    post_id: post._id
                });
                is_liked = !!like;
            }
            return {
                id: post._id.toString(),
                user_id: post.user_id.toString(),
                content: post.content,
                media_urls: post.media_urls,
                media_type: post.media_type,
                location: post.location,
                is_archived: post.is_archived,
                created_at: post.created_at,
                updated_at: post.updated_at,
                user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, user), { is_anonymous: post.is_anonymous })),
                likes_count: likesCount,
                comments_count: commentsCount,
                is_liked
            };
        });
    }
    // Get user's posts
    static getUserPosts(userId_1, currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, currentUserId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const usersCollection = db.collection('users');
            const likesCollection = db.collection('likes');
            const commentsCollection = db.collection('comments');
            const matchQuery = {
                user_id: new mongodb_1.ObjectId(userId),
                is_archived: { $ne: true }
            };
            const total = yield postsCollection.countDocuments(matchQuery);
            const posts = yield postsCollection.aggregate([
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
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit }
            ]).toArray();
            const transformedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                const likesCount = yield likesCollection.countDocuments({ post_id: post._id });
                const commentsCount = yield commentsCollection.countDocuments({
                    post_id: post._id,
                    is_deleted: { $ne: true }
                });
                let is_liked = false;
                if (currentUserId) {
                    const like = yield likesCollection.findOne({
                        user_id: new mongodb_1.ObjectId(currentUserId),
                        post_id: post._id
                    });
                    is_liked = !!like;
                }
                return {
                    id: post._id.toString(),
                    user_id: post.user_id.toString(),
                    content: post.content,
                    media_urls: post.media_urls,
                    media_type: post.media_type,
                    location: post.location,
                    is_archived: post.is_archived,
                    created_at: post.created_at,
                    updated_at: post.updated_at,
                    user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, post.user), { is_anonymous: post.is_anonymous })),
                    likes_count: likesCount,
                    comments_count: commentsCount,
                    is_liked
                };
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: transformedPosts,
                pagination: paginationMeta,
            };
        });
    }
    // Get feed posts
    static getFeedPosts(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const followsCollection = db.collection('follows');
            const likesCollection = db.collection('likes');
            const commentsCollection = db.collection('comments');
            // Get users that current user follows (check both field formats)
            const follows = yield followsCollection.find({
                $or: [
                    { follower_id: new mongodb_1.ObjectId(userId) },
                    { followerId: new mongodb_1.ObjectId(userId) }
                ],
                status: 'accepted' // Only accepted follows
            }).toArray();
            const followingIds = follows.map(f => f.following_id || f.followingId);
            followingIds.push(new mongodb_1.ObjectId(userId)); // Include own posts
            const matchQuery = {
                user_id: { $in: followingIds },
                is_archived: { $ne: true }
            };
            const total = yield postsCollection.countDocuments(matchQuery);
            const posts = yield postsCollection.aggregate([
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
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: validLimit }
            ]).toArray();
            const transformedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                const likesCount = yield likesCollection.countDocuments({ post_id: post._id });
                const commentsCount = yield commentsCollection.countDocuments({
                    post_id: post._id,
                    is_deleted: { $ne: true }
                });
                const like = yield likesCollection.findOne({
                    user_id: new mongodb_1.ObjectId(userId),
                    post_id: post._id
                });
                // Get reaction summary for this post
                const reactionSummary = yield likesCollection.aggregate([
                    { $match: { post_id: post._id } },
                    {
                        $group: {
                            _id: '$reaction',
                            count: { $sum: 1 }
                        }
                    }
                ]).toArray();
                // Convert to object format: { "❤️": 10, "😍": 5, ... }
                const reactions = {};
                reactionSummary.forEach((item) => {
                    if (item._id) {
                        reactions[item._id] = item.count;
                    }
                });
                // Get users who liked (for "liked by" display)
                const recentLikes = yield likesCollection.aggregate([
                    { $match: { post_id: post._id } },
                    { $sort: { created_at: -1 } },
                    { $limit: 3 },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'user_id',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    { $unwind: '$user' },
                    { $project: { 'user.username': 1 } }
                ]).toArray();
                const likedBy = recentLikes.map((like) => like.user.username);
                return {
                    id: post._id.toString(),
                    user_id: post.user_id.toString(),
                    content: post.content,
                    media_urls: post.media_urls,
                    media_type: post.media_type,
                    location: post.location,
                    is_archived: post.is_archived,
                    created_at: post.created_at,
                    updated_at: post.updated_at,
                    user: (0, anonymous_utils_1.maskAnonymousUser)(Object.assign(Object.assign({}, post.user), { is_anonymous: post.is_anonymous })),
                    likes_count: likesCount,
                    comments_count: commentsCount,
                    liked: !!like, // Changed from is_liked to liked
                    is_liked: !!like, // Keep both for compatibility
                    userReaction: (like === null || like === void 0 ? void 0 : like.reaction) || null, // User's current reaction
                    reactions, // Summary of all reactions
                    likedBy, // Top 3 usernames who liked
                };
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: transformedPosts,
                pagination: paginationMeta,
            };
        });
    }
    // Update post
    static updatePost(postId, userId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const allowedFields = ["content", "location"];
            const updateFields = Object.keys(updates).filter((key) => allowedFields.includes(key));
            if (updateFields.length === 0) {
                throw utils_1.errors.badRequest("No valid fields to update");
            }
            if (updates.content && updates.content.length > 2200) {
                throw utils_1.errors.badRequest("Post content too long (max 2200 characters)");
            }
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const usersCollection = db.collection('users');
            const updateDoc = {
                updated_at: new Date()
            };
            updateFields.forEach(field => {
                updateDoc[field] = updates[field];
            });
            const result = yield postsCollection.findOneAndUpdate({
                _id: new mongodb_1.ObjectId(postId),
                user_id: new mongodb_1.ObjectId(userId),
                is_archived: { $ne: true }
            }, { $set: updateDoc }, { returnDocument: 'after' });
            if (!result) {
                throw utils_1.errors.notFound("Post not found or you don't have permission to update it");
            }
            const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
            return {
                id: result._id.toString(),
                user_id: result.user_id.toString(),
                content: result.content,
                media_urls: result.media_urls,
                media_type: result.media_type,
                location: result.location,
                is_archived: result.is_archived,
                created_at: result.created_at,
                updated_at: result.updated_at,
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified || false,
                    badge_type: user.badge_type || user.verification_type || null,
                },
                likes_count: 0,
                comments_count: 0,
                is_liked: false
            };
        });
    }
    // Delete post
    static deletePost(postId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const post = yield postsCollection.findOne({
                _id: new mongodb_1.ObjectId(postId),
                is_archived: { $ne: true }
            });
            if (!post) {
                throw utils_1.errors.notFound("Post not found");
            }
            if (post.user_id.toString() !== userId) {
                throw utils_1.errors.forbidden("You don't have permission to delete this post. Only the post owner can delete it.");
            }
            yield postsCollection.updateOne({ _id: new mongodb_1.ObjectId(postId) }, { $set: { is_archived: true, updated_at: new Date() } });
        });
    }
    // Like post
    static likePost(userId, postId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const postsCollection = db.collection('posts');
            const likesCollection = db.collection('likes');
            const post = yield postsCollection.findOne({
                _id: new mongodb_1.ObjectId(postId),
                is_archived: { $ne: true }
            });
            if (!post) {
                throw utils_1.errors.notFound("Post not found");
            }
            const existingLike = yield likesCollection.findOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId)
            });
            if (existingLike) {
                throw utils_1.errors.conflict("Post already liked");
            }
            yield likesCollection.insertOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId),
                created_at: new Date()
            });
        });
    }
    // Unlike post
    static unlikePost(userId, postId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const result = yield likesCollection.deleteOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: new mongodb_1.ObjectId(postId)
            });
            if (result.deletedCount === 0) {
                throw utils_1.errors.notFound("Like not found");
            }
        });
    }
    // Get post likes
    static getPostLikes(postId_1) {
        return __awaiter(this, arguments, void 0, function* (postId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const db = yield (0, database_1.getDatabase)();
            const likesCollection = db.collection('likes');
            const total = yield likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(postId) });
            const likes = yield likesCollection.aggregate([
                { $match: { post_id: new mongodb_1.ObjectId(postId) } },
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
exports.PostService = PostService;

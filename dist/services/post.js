"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostService = void 0;
const database_1 = require("../lib/database");
const utils_1 = require("../lib/utils");
const mongodb_1 = require("mongodb");
class PostService {
    // Create new post
    static async createPost(userId, postData) {
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
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const usersCollection = db.collection('users');
        const postDoc = {
            user_id: new mongodb_1.ObjectId(userId),
            content: content || null,
            media_urls: media_urls || null,
            media_type: media_type || 'text',
            location: location || null,
            is_archived: false,
            created_at: new Date(),
            updated_at: new Date()
        };
        const result = await postsCollection.insertOne(postDoc);
        // Get user data for the post
        console.log('Looking up user with ID:', userId);
        console.log('ObjectId:', new mongodb_1.ObjectId(userId));
        const user = await usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
        console.log('User found:', !!user);
        if (!user) {
            console.error('User not found! Searched for ID:', userId);
            // Try to find any user to debug
            const anyUser = await usersCollection.findOne({});
            console.log('Sample user in DB:', anyUser ? { id: anyUser._id, username: anyUser.username } : 'No users found');
            throw utils_1.errors.notFound("User not found");
        }
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
        return postWithUser;
    }
    // Get post by ID
    static async getPostById(postId, currentUserId) {
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const usersCollection = db.collection('users');
        const likesCollection = db.collection('likes');
        const commentsCollection = db.collection('comments');
        const post = await postsCollection.findOne({
            _id: new mongodb_1.ObjectId(postId),
            is_archived: { $ne: true }
        });
        if (!post) {
            throw utils_1.errors.notFound("Post not found");
        }
        // Get user data
        const user = await usersCollection.findOne({ _id: post.user_id });
        if (!user) {
            throw utils_1.errors.notFound("User not found");
        }
        // Get likes and comments count
        const likesCount = await likesCollection.countDocuments({ post_id: post._id });
        const commentsCount = await commentsCollection.countDocuments({
            post_id: post._id,
            is_deleted: { $ne: true }
        });
        // Check if current user liked
        let is_liked = false;
        if (currentUserId) {
            const like = await likesCollection.findOne({
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
    }
    // Get user's posts
    static async getUserPosts(userId, currentUserId, page = 1, limit = 20) {
        const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
        const offset = utils_1.pagination.getOffset(validPage, validLimit);
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const usersCollection = db.collection('users');
        const likesCollection = db.collection('likes');
        const commentsCollection = db.collection('comments');
        const matchQuery = {
            user_id: new mongodb_1.ObjectId(userId),
            is_archived: { $ne: true }
        };
        const total = await postsCollection.countDocuments(matchQuery);
        const posts = await postsCollection.aggregate([
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
        const transformedPosts = await Promise.all(posts.map(async (post) => {
            const likesCount = await likesCollection.countDocuments({ post_id: post._id });
            const commentsCount = await commentsCollection.countDocuments({
                post_id: post._id,
                is_deleted: { $ne: true }
            });
            let is_liked = false;
            if (currentUserId) {
                const like = await likesCollection.findOne({
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
                user: {
                    id: post.user._id.toString(),
                    username: post.user.username,
                    full_name: post.user.full_name,
                    avatar_url: post.user.avatar_url,
                    is_verified: post.user.is_verified || false,
                },
                likes_count: likesCount,
                comments_count: commentsCount,
                is_liked
            };
        }));
        const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
        return {
            success: true,
            data: transformedPosts,
            pagination: paginationMeta,
        };
    }
    // Get feed posts
    static async getFeedPosts(userId, page = 1, limit = 20) {
        const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
        const offset = utils_1.pagination.getOffset(validPage, validLimit);
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const followsCollection = db.collection('follows');
        const likesCollection = db.collection('likes');
        const commentsCollection = db.collection('comments');
        // Get users that current user follows
        const follows = await followsCollection.find({
            follower_id: new mongodb_1.ObjectId(userId)
        }).toArray();
        const followingIds = follows.map(f => f.following_id);
        followingIds.push(new mongodb_1.ObjectId(userId)); // Include own posts
        const matchQuery = {
            user_id: { $in: followingIds },
            is_archived: { $ne: true }
        };
        const total = await postsCollection.countDocuments(matchQuery);
        const posts = await postsCollection.aggregate([
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
        const transformedPosts = await Promise.all(posts.map(async (post) => {
            const likesCount = await likesCollection.countDocuments({ post_id: post._id });
            const commentsCount = await commentsCollection.countDocuments({
                post_id: post._id,
                is_deleted: { $ne: true }
            });
            const like = await likesCollection.findOne({
                user_id: new mongodb_1.ObjectId(userId),
                post_id: post._id
            });
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
                user: {
                    id: post.user._id.toString(),
                    username: post.user.username,
                    full_name: post.user.full_name,
                    avatar_url: post.user.avatar_url,
                    is_verified: post.user.is_verified || false,
                },
                likes_count: likesCount,
                comments_count: commentsCount,
                is_liked: !!like
            };
        }));
        const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
        return {
            success: true,
            data: transformedPosts,
            pagination: paginationMeta,
        };
    }
    // Update post
    static async updatePost(postId, userId, updates) {
        const allowedFields = ["content", "location"];
        const updateFields = Object.keys(updates).filter((key) => allowedFields.includes(key));
        if (updateFields.length === 0) {
            throw utils_1.errors.badRequest("No valid fields to update");
        }
        if (updates.content && updates.content.length > 2200) {
            throw utils_1.errors.badRequest("Post content too long (max 2200 characters)");
        }
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const usersCollection = db.collection('users');
        const updateDoc = {
            updated_at: new Date()
        };
        updateFields.forEach(field => {
            updateDoc[field] = updates[field];
        });
        const result = await postsCollection.findOneAndUpdate({
            _id: new mongodb_1.ObjectId(postId),
            user_id: new mongodb_1.ObjectId(userId),
            is_archived: { $ne: true }
        }, { $set: updateDoc }, { returnDocument: 'after' });
        if (!result) {
            throw utils_1.errors.notFound("Post not found or you don't have permission to update it");
        }
        const user = await usersCollection.findOne({ _id: new mongodb_1.ObjectId(userId) });
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
            },
            likes_count: 0,
            comments_count: 0,
            is_liked: false
        };
    }
    // Delete post
    static async deletePost(postId, userId) {
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const post = await postsCollection.findOne({
            _id: new mongodb_1.ObjectId(postId),
            is_archived: { $ne: true }
        });
        if (!post) {
            throw utils_1.errors.notFound("Post not found");
        }
        if (post.user_id.toString() !== userId) {
            throw utils_1.errors.forbidden("You don't have permission to delete this post. Only the post owner can delete it.");
        }
        await postsCollection.updateOne({ _id: new mongodb_1.ObjectId(postId) }, { $set: { is_archived: true, updated_at: new Date() } });
    }
    // Like post
    static async likePost(userId, postId) {
        const db = await (0, database_1.getDatabase)();
        const postsCollection = db.collection('posts');
        const likesCollection = db.collection('likes');
        const post = await postsCollection.findOne({
            _id: new mongodb_1.ObjectId(postId),
            is_archived: { $ne: true }
        });
        if (!post) {
            throw utils_1.errors.notFound("Post not found");
        }
        const existingLike = await likesCollection.findOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId)
        });
        if (existingLike) {
            throw utils_1.errors.conflict("Post already liked");
        }
        await likesCollection.insertOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId),
            created_at: new Date()
        });
    }
    // Unlike post
    static async unlikePost(userId, postId) {
        const db = await (0, database_1.getDatabase)();
        const likesCollection = db.collection('likes');
        const result = await likesCollection.deleteOne({
            user_id: new mongodb_1.ObjectId(userId),
            post_id: new mongodb_1.ObjectId(postId)
        });
        if (result.deletedCount === 0) {
            throw utils_1.errors.notFound("Like not found");
        }
    }
    // Get post likes
    static async getPostLikes(postId, page = 1, limit = 20) {
        const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
        const offset = utils_1.pagination.getOffset(validPage, validLimit);
        const db = await (0, database_1.getDatabase)();
        const likesCollection = db.collection('likes');
        const total = await likesCollection.countDocuments({ post_id: new mongodb_1.ObjectId(postId) });
        const likes = await likesCollection.aggregate([
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
    }
}
exports.PostService = PostService;

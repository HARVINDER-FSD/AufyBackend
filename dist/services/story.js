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
exports.StoryService = void 0;
const story_1 = __importDefault(require("../models/story"));
const user_1 = __importDefault(require("../models/user"));
const story_view_1 = __importDefault(require("../models/story-view"));
const follow_1 = __importDefault(require("../models/follow"));
const storage_1 = require("../lib/storage");
const utils_1 = require("../lib/utils");
const config_1 = require("../lib/config");
const database_1 = require("../lib/database");
const mongoose_1 = __importDefault(require("mongoose"));
class StoryService {
    // Create story
    static createStory(userId, storyData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { media_url, media_type, content } = storyData;
            if (!media_url) {
                throw utils_1.errors.badRequest("Media URL is required for stories");
            }
            if (!["image", "video"].includes(media_type)) {
                throw utils_1.errors.badRequest("Media type must be 'image' or 'video'");
            }
            if (content && content.length > 500) {
                throw utils_1.errors.badRequest("Story content too long (max 500 characters)");
            }
            const storyDoc = yield story_1.default.create({
                user_id: userId,
                media_url,
                media_type,
                caption: content,
                // expires_at is handled by pre-save hook in model
            });
            // Get user data
            const user = yield user_1.default.findById(userId).select('username full_name avatar_url is_verified');
            const storyWithUser = {
                id: storyDoc._id.toString(),
                user_id: storyDoc.user_id.toString(),
                media_url: storyDoc.media_url,
                media_type: storyDoc.media_type,
                content: storyDoc.caption,
                expires_at: storyDoc.expires_at,
                is_archived: storyDoc.is_deleted,
                created_at: storyDoc.created_at,
                user: user ? {
                    id: user._id.toString(),
                    username: user.username,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url,
                    is_verified: user.is_verified,
                    email: user.email,
                    is_private: user.is_private,
                    is_active: user.is_active,
                    created_at: user.created_at,
                    updated_at: user.updated_at
                } : undefined,
                is_viewed: false,
            };
            // Clear user stories cache
            yield database_1.cache.del(utils_1.cacheKeys.userStories(userId));
            yield database_1.cache.invalidatePattern(`${config_1.config.redis.keyPrefix}stories:*`);
            return storyWithUser;
        });
    }
    // Get user stories
    static getUserStories(userId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cacheKey = utils_1.cacheKeys.userStories(userId);
            const cachedStories = yield database_1.cache.get(cacheKey);
            if (cachedStories && !currentUserId) {
                return cachedStories;
            }
            // Find stories
            const storiesDocs = yield story_1.default.find({
                user_id: userId,
                expires_at: { $gt: new Date() },
                is_deleted: false
            }).sort({ created_at: -1 });
            // Get user info (assumed same for all stories)
            const user = yield user_1.default.findById(userId).select('username full_name avatar_url is_verified');
            if (!user || !user.is_active) {
                return [];
            }
            const stories = yield Promise.all(storiesDocs.map((storyDoc) => __awaiter(this, void 0, void 0, function* () {
                const story = {
                    id: storyDoc._id.toString(),
                    user_id: storyDoc.user_id.toString(),
                    media_url: storyDoc.media_url,
                    media_type: storyDoc.media_type,
                    content: storyDoc.caption,
                    expires_at: storyDoc.expires_at,
                    is_archived: storyDoc.is_deleted,
                    created_at: storyDoc.created_at,
                    user: {
                        id: user._id.toString(),
                        username: user.username,
                        full_name: user.full_name,
                        avatar_url: user.avatar_url,
                        is_verified: user.is_verified,
                        email: user.email,
                        is_private: user.is_private,
                        is_active: user.is_active,
                        created_at: user.created_at,
                        updated_at: user.updated_at
                    },
                };
                // Check if current user has viewed this story
                if (currentUserId) {
                    const view = yield story_view_1.default.findOne({
                        story_id: storyDoc._id,
                        viewer_id: currentUserId
                    });
                    story.is_viewed = !!view;
                }
                return story;
            })));
            // Cache stories (without view status)
            if (!currentUserId) {
                yield database_1.cache.set(cacheKey, stories, config_1.config.redis.ttl.story);
            }
            return stories;
        });
    }
    // Get stories feed (stories from followed users)
    static getStoriesFeed(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get following list
            const following = yield follow_1.default.find({
                follower_id: userId,
                status: 'active'
            }).select('following_id');
            const followingIds = following.map(f => f.following_id);
            // Also include own stories
            followingIds.push(new mongoose_1.default.Types.ObjectId(userId));
            // Find users who have active stories
            // We can do an aggregation or just find stories where user_id is in followingIds
            const activeStories = yield story_1.default.aggregate([
                {
                    $match: {
                        user_id: { $in: followingIds },
                        expires_at: { $gt: new Date() },
                        is_deleted: false
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        count: { $sum: 1 }
                    }
                }
            ]);
            const activeUserIds = activeStories.map(s => s._id);
            const userStoriesPromises = activeUserIds.map((uid) => __awaiter(this, void 0, void 0, function* () {
                const stories = yield this.getUserStories(uid.toString(), userId);
                if (stories.length === 0)
                    return null;
                // Stories already contain user info, so we can extract it from the first story
                const user = stories[0].user;
                return {
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        avatar_url: user.avatar_url,
                        is_verified: user.is_verified
                    },
                    stories,
                };
            }));
            const userStories = yield Promise.all(userStoriesPromises);
            return userStories.filter((item) => item !== null);
        });
    }
    // View story
    static viewStory(storyId, viewerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if story exists and is not expired
            const story = yield story_1.default.findOne({
                _id: storyId,
                expires_at: { $gt: new Date() },
                is_deleted: false
            });
            if (!story) {
                throw utils_1.errors.notFound("Story not found or expired");
            }
            // Don't record view if it's the story owner
            if (story.user_id.toString() === viewerId) {
                return;
            }
            // Insert view record (ignore if already exists handled by unique index)
            try {
                yield story_view_1.default.create({
                    story_id: storyId,
                    viewer_id: viewerId
                });
                // Increment view count on story
                story.views_count = (story.views_count || 0) + 1;
                yield story.save();
            }
            catch (error) {
                if (error.code !== 11000) { // 11000 is duplicate key error
                    throw error;
                }
            }
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userStories(story.user_id.toString()));
        });
    }
    // Get story views
    static getStoryViews(storyId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify story ownership
            const story = yield story_1.default.findById(storyId);
            if (!story) {
                throw utils_1.errors.notFound("Story not found");
            }
            if (story.user_id.toString() !== userId) {
                throw utils_1.errors.forbidden("You can only view your own story views");
            }
            const views = yield story_view_1.default.find({ story_id: storyId })
                .sort({ viewed_at: -1 })
                .populate('viewer_id', 'username full_name avatar_url is_verified');
            return views.map((view) => {
                const viewer = view.viewer_id; // populated
                if (!viewer)
                    return null;
                return {
                    id: viewer._id.toString(),
                    username: viewer.username,
                    full_name: viewer.full_name,
                    avatar_url: viewer.avatar_url,
                    is_verified: viewer.is_verified,
                    viewed_at: view.viewed_at,
                };
            }).filter(v => v !== null);
        });
    }
    // Delete story
    static deleteStory(storyId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const story = yield story_1.default.findById(storyId);
            if (!story) {
                throw utils_1.errors.notFound("Story not found");
            }
            // Verify ownership
            if (story.user_id.toString() !== userId) {
                throw utils_1.errors.forbidden("You don't have permission to delete this story. Only the story owner can delete it.");
            }
            // Soft delete
            story.is_deleted = true;
            yield story.save();
            // Delete media file from S3
            try {
                const urlParts = story.media_url.split("/");
                const key = urlParts.slice(-3).join("/");
                yield storage_1.StorageService.deleteFile(key);
            }
            catch (error) {
                console.error("Failed to delete story media:", error);
            }
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userStories(userId));
            yield database_1.cache.invalidatePattern(`${config_1.config.redis.keyPrefix}stories:*`);
        });
    }
    // Archive expired stories (cleanup job)
    static archiveExpiredStories() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield story_1.default.updateMany({ expires_at: { $lte: new Date() }, is_deleted: false }, { $set: { is_deleted: true } } // Assuming archive means soft delete here, or maybe we should leave them as expired?
            // Original SQL: UPDATE stories SET is_archived = true WHERE expires_at <= NOW() AND is_archived = false
            // My Model has is_deleted, not is_archived field.
            // If I assume is_deleted == is_archived
            );
            // Clear all stories cache
            yield database_1.cache.invalidatePattern(`${config_1.config.redis.keyPrefix}stories:*`);
            return result.modifiedCount;
        });
    }
}
exports.StoryService = StoryService;

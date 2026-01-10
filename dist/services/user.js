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
exports.UserService = void 0;
const database_1 = require("../lib/database");
const utils_1 = require("../lib/utils");
const config_1 = require("../lib/config");
const user_1 = __importDefault(require("../models/user"));
const follow_1 = __importDefault(require("../models/follow"));
const post_1 = __importDefault(require("../models/post"));
// Type assertions to fix Mongoose model type issues
const User = user_1.default;
const Follow = follow_1.default;
const Post = post_1.default;
class UserService {
    // Search users
    static searchUsers(searchTerm_1, currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (searchTerm, currentUserId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const searchRegex = new RegExp(searchTerm, 'i');
            const searchFilter = {
                $or: [
                    { username: searchRegex },
                    { full_name: searchRegex }
                ],
                is_active: true
            };
            if (currentUserId) {
                searchFilter._id = { $ne: currentUserId };
            }
            const total = yield User.countDocuments(searchFilter).exec();
            const users = yield User.find(searchFilter)
                .select('id username email full_name bio avatar_url is_verified is_private created_at')
                .sort({ is_verified: -1, created_at: -1 })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: users,
                pagination: paginationMeta,
            };
        });
    }
    // Update user profile
    static updateProfile(userId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const allowedFields = ["username", "full_name", "bio", "avatar_url", "phone", "website", "location", "is_private"];
            // Only update allowed fields
            const filteredUpdates = {};
            Object.keys(updates).forEach((field) => {
                if (allowedFields.includes(field)) {
                    filteredUpdates[field] = updates[field];
                }
            });
            // Update user in database
            yield User.findByIdAndUpdate(userId, Object.assign(Object.assign({}, filteredUpdates), { updated_at: new Date() })).exec();
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.user(userId));
            return {
                success: true,
                message: 'Profile updated successfully'
            };
        });
    }
    // Get user profile
    static getUserProfile(userId, currentUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cacheKey = `${utils_1.cacheKeys.user(userId)}:profile`;
            const cachedProfile = yield database_1.cache.get(cacheKey);
            if (cachedProfile && !currentUserId) {
                return cachedProfile;
            }
            const user = yield User.findOne({ _id: userId, is_active: true }).lean().exec();
            if (!user) {
                throw utils_1.errors.notFound("User not found");
            }
            // Get counts
            const followersCount = yield Follow.countDocuments({ following_id: userId, status: 'active' }).exec();
            const followingCount = yield Follow.countDocuments({ follower_id: userId, status: 'active' }).exec();
            const postsCount = yield Post.countDocuments({ user_id: userId, is_archived: false }).exec();
            const profile = {
                id: user._id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                bio: user.bio,
                avatar_url: user.avatar_url,
                phone: user.phone,
                is_verified: user.is_verified,
                is_private: user.is_private,
                is_active: user.is_active,
                last_seen: user.last_seen,
                created_at: user.created_at,
                updated_at: user.updated_at,
                followers_count: followersCount,
                following_count: followingCount,
                posts_count: postsCount,
            };
            // Check follow status if current user is provided
            if (currentUserId && currentUserId !== userId) {
                const isFollowing = yield Follow.findOne({
                    follower_id: currentUserId,
                    following_id: userId
                }).lean().exec();
                const isFollowedBy = yield Follow.findOne({
                    follower_id: userId,
                    following_id: currentUserId
                }).lean().exec();
                profile.is_following = (isFollowing === null || isFollowing === void 0 ? void 0 : isFollowing.status) === "active";
                profile.is_followed_by = (isFollowedBy === null || isFollowedBy === void 0 ? void 0 : isFollowedBy.status) === "active";
            }
            // Cache the profile (without follow status for general caching)
            if (!currentUserId) {
                yield database_1.cache.set(cacheKey, profile, config_1.config.redis.ttl.user);
            }
            return profile;
        });
    }
    // Follow user
    static followUser(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (followerId === followingId) {
                throw utils_1.errors.badRequest("Cannot follow yourself");
            }
            // Check if target user exists
            const targetUser = yield User.findOne({ _id: followingId, is_active: true }).lean().exec();
            if (!targetUser) {
                throw utils_1.errors.notFound("User not found");
            }
            const isPrivate = targetUser.is_private;
            // Check if already following
            const existingFollow = yield Follow.findOne({
                follower_id: followerId,
                following_id: followingId
            }).lean().exec();
            if (existingFollow) {
                const currentStatus = existingFollow.status;
                if (currentStatus === "active") {
                    throw utils_1.errors.conflict("Already following this user");
                }
                else if (currentStatus === "pending") {
                    throw utils_1.errors.conflict("Follow request already sent");
                }
            }
            // Determine status based on privacy
            const status = isPrivate ? "pending" : "active";
            // Insert or update follow record
            yield Follow.findOneAndUpdate({ follower_id: followerId, following_id: followingId }, {
                follower_id: followerId,
                following_id: followingId,
                status,
                created_at: new Date()
            }, { upsert: true, new: true }).exec();
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userFollowers(followingId));
            yield database_1.cache.del(utils_1.cacheKeys.userFollowing(followerId));
            yield database_1.cache.del(`${utils_1.cacheKeys.user(followingId)}:profile`);
            yield database_1.cache.del(`${utils_1.cacheKeys.user(followerId)}:profile`);
            // TODO: Send notification if follow is active or pending
        });
    }
    // Unfollow user
    static unfollowUser(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield Follow.deleteOne({
                follower_id: followerId,
                following_id: followingId
            }).exec();
            if (result.deletedCount === 0) {
                throw utils_1.errors.notFound("Follow relationship not found");
            }
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userFollowers(followingId));
            yield database_1.cache.del(utils_1.cacheKeys.userFollowing(followerId));
            yield database_1.cache.del(`${utils_1.cacheKeys.user(followingId)}:profile`);
            yield database_1.cache.del(`${utils_1.cacheKeys.user(followerId)}:profile`);
        });
    }
    // Get followers
    static getFollowers(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const total = yield Follow.countDocuments({
                following_id: userId,
                status: 'active'
            }).exec();
            const follows = yield Follow.find({
                following_id: userId,
                status: 'active'
            })
                .sort({ created_at: -1 })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            const followerIds = follows.map((f) => f.follower_id);
            const users = yield User.find({
                _id: { $in: followerIds },
                is_active: true
            })
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            const followers = follows.map((follow) => {
                const user = users.find((u) => u._id.toString() === follow.follower_id.toString());
                return user ? Object.assign(Object.assign({}, user), { followed_at: follow.created_at }) : null;
            }).filter(Boolean);
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: followers,
                pagination: paginationMeta,
            };
        });
    }
    // Get following
    static getFollowing(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const total = yield Follow.countDocuments({
                follower_id: userId,
                status: 'active'
            }).exec();
            const follows = yield Follow.find({
                follower_id: userId,
                status: 'active'
            })
                .sort({ created_at: -1 })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            const followingIds = follows.map((f) => f.following_id);
            const users = yield User.find({
                _id: { $in: followingIds },
                is_active: true
            })
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            const following = follows.map((follow) => {
                const user = users.find((u) => u._id.toString() === follow.following_id.toString());
                return user ? Object.assign(Object.assign({}, user), { followed_at: follow.created_at }) : null;
            }).filter(Boolean);
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: following,
                pagination: paginationMeta,
            };
        });
    }
    // Accept follow request
    static acceptFollowRequest(userId, followerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield Follow.updateOne({
                follower_id: followerId,
                following_id: userId,
                status: "pending"
            }, { status: "active" }).exec();
            if (result.matchedCount === 0) {
                throw utils_1.errors.notFound("Follow request not found");
            }
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userFollowers(userId));
            yield database_1.cache.del(utils_1.cacheKeys.userFollowing(followerId));
            yield database_1.cache.del(`${utils_1.cacheKeys.user(userId)}:profile`);
            yield database_1.cache.del(`${utils_1.cacheKeys.user(followerId)}:profile`);
            // TODO: Send notification
        });
    }
    // Reject follow request
    static rejectFollowRequest(userId, followerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield Follow.deleteOne({
                follower_id: followerId,
                following_id: userId,
                status: "pending"
            }).exec();
            if (result.deletedCount === 0) {
                throw utils_1.errors.notFound("Follow request not found");
            }
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.userFollowers(userId));
            yield database_1.cache.del(utils_1.cacheKeys.userFollowing(followerId));
        });
    }
    // Get pending follow requests
    static getPendingFollowRequests(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const offset = utils_1.pagination.getOffset(validPage, validLimit);
            const total = yield Follow.countDocuments({
                following_id: userId,
                status: 'pending'
            }).exec();
            const follows = yield Follow.find({
                following_id: userId,
                status: 'pending'
            })
                .sort({ created_at: -1 })
                .skip(offset)
                .limit(validLimit)
                .lean()
                .exec();
            const requesterIds = follows.map((f) => f.follower_id);
            const users = yield User.find({
                _id: { $in: requesterIds },
                is_active: true
            })
                .select('id username full_name avatar_url is_verified')
                .lean()
                .exec();
            const requests = follows.map((follow) => {
                const user = users.find((u) => u._id.toString() === follow.follower_id.toString());
                return user ? Object.assign(Object.assign({}, user), { requested_at: follow.created_at }) : null;
            }).filter(Boolean);
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: requests,
                pagination: paginationMeta,
            };
        });
    }
}
exports.UserService = UserService;

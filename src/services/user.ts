import { cache } from "../lib/database"
import type { User, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"
import UserModel from "../models/user"
import FollowModel from "../models/follow"
import PostModel from "../models/post"
import { NotificationService } from "./notification"
import mongoose, { Model } from "mongoose"

const { ObjectId } = mongoose.Types;

// Type assertions to fix Mongoose model type issues
const User = UserModel as any as Model<any>
const Follow = FollowModel as any as Model<any>
const Post = PostModel as any as Model<any>

export class UserService {
  // Search users
  static async searchUsers(
    searchTerm: string,
    currentUserId?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const searchRegex = new RegExp(searchTerm, 'i')

    const searchFilter: any = {
      $or: [
        { username: searchRegex },
        { full_name: searchRegex }
      ],
      is_active: true
    }

    if (currentUserId) {
      searchFilter._id = { $ne: currentUserId }
    }

    const total = await User.countDocuments(searchFilter).exec()

    const users = await User.find(searchFilter)
      .select('id username email full_name bio avatar_url is_verified is_private created_at')
      .sort({ is_verified: -1, created_at: -1 })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: users as any[],
      pagination: paginationMeta,
    }
  }

  // Update user profile
  static async updateProfile(userId: string, updates: Partial<User>) {
    const allowedFields = ["username", "full_name", "bio", "avatar_url", "phone", "website", "location", "is_private"]

    // Only update allowed fields
    const filteredUpdates: any = {}
    Object.keys(updates).forEach((field) => {
      if (allowedFields.includes(field)) {
        filteredUpdates[field] = updates[field as keyof User]
      }
    })

    // Update user in database
    await User.findByIdAndUpdate(userId, {
      ...filteredUpdates,
      updated_at: new Date()
    }).exec()

    // Clear cache
    await cache.del(cacheKeys.user(userId))

    return {
      success: true,
      message: 'Profile updated successfully'
    }
  }

  // Get user profile
  static async getUserProfile(
    userId: string,
    currentUserId?: string,
  ): Promise<
    User & {
      followers_count: number
      following_count: number
      posts_count: number
      is_following?: boolean
      is_followed_by?: boolean
    }
  > {
    // Check cache for base profile first
    const cacheKey = `${cacheKeys.user(userId)}:profile`
    let profile: any = await cache.get(cacheKey)

    if (!profile) {
      const user: any = await User.findOne({ _id: userId, is_active: true }).lean().exec()

      if (!user) {
        throw errors.notFound("User not found")
      }

      // Get counts (expensive operations)
      const [followersCount, followingCount, postsCount] = await Promise.all([
        Follow.countDocuments({ following_id: userId, status: 'active' }).exec(),
        Follow.countDocuments({ follower_id: userId, status: 'active' }).exec(),
        Post.countDocuments({ user_id: userId, is_archived: false }).exec()
      ])

      profile = {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        phone: user.phone,
        is_verified: user.is_verified,
        badge_type: user.badge_type,
        verification_type: user.verification_type,
        isAnonymousMode: user.isAnonymousMode,
        anonymousPersona: user.anonymousPersona,
        is_private: user.is_private,
        is_active: user.is_active,
        last_seen: user.last_seen,
        created_at: user.created_at,
        updated_at: user.updated_at,
        followers_count: followersCount,
        following_count: followingCount,
        posts_count: postsCount,
      }

      // Cache base profile for 60 seconds
      await cache.set(cacheKey, profile, 60)
    }

    // Check follow status if current user is provided (always real-time)
    if (currentUserId && currentUserId !== userId) {
      const [isFollowing, isFollowedBy] = await Promise.all([
        Follow.findOne({
          follower_id: currentUserId,
          following_id: userId
        }).select('status').lean().exec() as Promise<any>,

        Follow.findOne({
          follower_id: userId,
          following_id: currentUserId
        }).select('status').lean().exec() as Promise<any>
      ])

      return {
        ...profile,
        is_following: isFollowing?.status === "active",
        is_followed_by: isFollowedBy?.status === "active"
      }
    }

    return profile
  }

  // Follow user
  static async followUser(followerId: string, followingId: string): Promise<any> {
    if (followerId === followingId) {
      throw errors.badRequest("Cannot follow yourself")
    }

    // 🛡️ BLOCK CHECK — prevent follow between blocked parties
    const { getDatabase } = require('../lib/database');
    const db_block = await getDatabase();
    const blockExists = await db_block.collection('blocked_users').findOne({
      $or: [
        { userId: new ObjectId(followerId), blockedUserId: new ObjectId(followingId) },
        { userId: new ObjectId(followingId), blockedUserId: new ObjectId(followerId) }
      ]
    });
    if (blockExists) {
      throw errors.notFound("User not found");
    }

    // Check if target user exists
    const targetUser: any = await User.findOne({ _id: followingId, is_active: true }).lean().exec()
    if (!targetUser) {
      throw errors.notFound("User not found")
    }

    const isPrivate = targetUser.is_private

    // Check if already following
    const existingFollow: any = await Follow.findOne({
      follower_id: followerId,
      following_id: followingId
    }).lean().exec()

    if (existingFollow) {
      const currentStatus = existingFollow.status
      if (currentStatus === "active") {
        throw errors.conflict("Already following this user")
      } else if (currentStatus === "pending") {
        throw errors.conflict("Follow request already sent")
      }
    }

    // Determine status based on privacy
    const status = isPrivate ? "pending" : "active"

    // Use the model's static method which handles everything (including counters via hooks)
    await (Follow as any).followUser(followerId, followingId, status);

    // Clear cache
    await cache.del(cacheKeys.userFollowers(followingId))
    await cache.del(cacheKeys.userFollowing(followerId))
    await cache.del(`${cacheKeys.user(followingId)}:profile`)
    await cache.del(`${cacheKeys.user(followerId)}:profile`)

    // Send notification
    if (status === 'active') {
      await NotificationService.notifyFollow(followerId, followingId)
    } else {
      await NotificationService.notifyFollowRequest(followerId, followingId)
    }

    return {
      status,
      is_following: status === 'active',
      is_pending: status === 'pending'
    }
  }

  // Unfollow user
  static async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const result = await (Follow as any).unfollowUser(followerId, followingId);

    if (!result) {
      throw errors.notFound("Follow relationship not found")
    }

    // Clear cache
    await cache.del(cacheKeys.userFollowers(followingId))
    await cache.del(cacheKeys.userFollowing(followerId))
    await cache.del(`${cacheKeys.user(followingId)}:profile`)
    await cache.del(`${cacheKeys.user(followerId)}:profile`)
  }

  // Get followers
  static async getFollowers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User & { followed_at: Date }>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const total = await Follow.countDocuments({
      following_id: userId,
      status: 'active'
    }).exec()

    const follows = await Follow.find({
      following_id: userId,
      status: 'active'
    })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    const followerIds = follows.map((f: any) => f.follower_id)
    const users = await User.find({
      _id: { $in: followerIds },
      is_active: true
    })
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    const followers = follows.map((follow: any) => {
      const user = users.find((u: any) => u._id.toString() === follow.follower_id.toString())
      return user ? {
        ...user,
        followed_at: follow.created_at
      } : null
    }).filter(Boolean)

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: followers as any[],
      pagination: paginationMeta,
    }
  }

  // Get following
  static async getFollowing(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User & { followed_at: Date }>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const total = await Follow.countDocuments({
      follower_id: userId,
      status: 'active'
    }).exec()

    const follows = await Follow.find({
      follower_id: userId,
      status: 'active'
    })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    const followingIds = follows.map((f: any) => f.following_id)
    const users = await User.find({
      _id: { $in: followingIds },
      is_active: true
    })
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    const following = follows.map((follow: any) => {
      const user = users.find((u: any) => u._id.toString() === follow.following_id.toString())
      return user ? {
        ...user,
        followed_at: follow.created_at
      } : null
    }).filter(Boolean)

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: following as any[],
      pagination: paginationMeta,
    }
  }

  // Accept follow request
  static async acceptFollowRequest(userId: string, followerId: string): Promise<void> {
    const follow = await Follow.findOne({
      follower_id: new ObjectId(followerId),
      following_id: new ObjectId(userId),
      status: "pending"
    }).exec();

    if (!follow) {
      throw errors.notFound("Follow request not found")
    }

    follow.status = "active";
    await follow.save();

    // Send notification
    await NotificationService.notifyFollow(followerId, userId);

    // Clear cache
    await cache.del(cacheKeys.userFollowers(userId))
    await cache.del(cacheKeys.userFollowing(followerId))
    await cache.del(`${cacheKeys.user(userId)}:profile`)
    await cache.del(`${cacheKeys.user(followerId)}:profile`)
  }

  // Reject follow request
  static async rejectFollowRequest(userId: string, followerId: string): Promise<void> {
    const result = await Follow.findOneAndDelete({
      follower_id: new ObjectId(followerId),
      following_id: new ObjectId(userId),
      status: "pending"
    }).exec();

    if (!result) {
      throw errors.notFound("Follow request not found")
    }

    // Clear cache
    await cache.del(cacheKeys.userFollowers(userId))
    await cache.del(cacheKeys.userFollowing(followerId))
  }

  // Get pending follow requests
  static async getPendingFollowRequests(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User & { requested_at: Date }>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const total = await Follow.countDocuments({
      following_id: new ObjectId(userId),
      status: 'pending'
    }).exec()

    const follows = await Follow.find({
      following_id: new ObjectId(userId),
      status: 'pending'
    })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    const requesterIds = follows.map((f: any) => f.follower_id)
    const users = await User.find({
      _id: { $in: requesterIds },
      is_active: true
    })
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    const requests = follows.map((follow: any) => {
      const user = users.find((u: any) => u._id.toString() === follow.follower_id.toString())
      return user ? {
        ...user,
        requested_at: follow.created_at
      } : null
    }).filter(Boolean)

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: requests as any[],
      pagination: paginationMeta,
    }
  }
}

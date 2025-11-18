import { query, cache } from "../lib/database"
import type { User, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"

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

    const searchQuery = `%${searchTerm.toLowerCase()}%`

    const result = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.bio, u.avatar_url,
              u.is_verified, u.is_private, u.created_at,
              COUNT(*) OVER() as total_count
       FROM users u
       WHERE (LOWER(u.username) LIKE $1 OR LOWER(u.full_name) LIKE $1)
         AND u.is_active = true
         AND ($2::uuid IS NULL OR u.id != $2)
       ORDER BY 
         CASE WHEN LOWER(u.username) = LOWER($3) THEN 1 ELSE 2 END,
         u.is_verified DESC,
         u.created_at DESC
       LIMIT $4 OFFSET $5`,
      [searchQuery, currentUserId, searchTerm, validLimit, offset],
    )

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      bio: row.bio,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      is_private: row.is_private,
      created_at: row.created_at,
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: users,
      pagination: paginationMeta,
    }
  }

  // Update user profile
  static async updateProfile(userId: string, updates: Partial<User>) {
    const allowedFields = ["username", "full_name", "bio", "avatar_url", "phone", "website", "location", "is_private"]
    const updateFields = Object.keys(updates).filter((key) => allowedFields.includes(key))
    
    // Only update allowed fields
    const filteredUpdates: Partial<User> = {}
    updateFields.forEach((field) => {
      filteredUpdates[field as keyof User] = updates[field as keyof User]
    })
    
    // Update user in database
    await query(
      `UPDATE users SET ${updateFields.map((field) => `${field} = ?`).join(', ')}, updated_at = NOW() 
       WHERE id = ?`,
      [...updateFields.map((field) => filteredUpdates[field as keyof User]), userId]
    )
    
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
    // Check cache first
    const cacheKey = `${cacheKeys.user(userId)}:profile`
    const cachedProfile = await cache.get(cacheKey)

    if (cachedProfile && !currentUserId) {
      return cachedProfile
    }

    const result = await query(
      `SELECT u.id, u.username, u.email, u.full_name, u.bio, u.avatar_url, u.phone,
              u.is_verified, u.is_private, u.is_active, u.last_seen, u.created_at, u.updated_at,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id AND status = 'active') as followers_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id = u.id AND status = 'active') as following_count,
              (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND is_archived = false) as posts_count
       FROM users u
       WHERE u.id = $1 AND u.is_active = true`,
      [userId],
    )

    if (result.rows.length === 0) {
      throw errors.notFound("User not found")
    }

    const user = result.rows[0]
    const profile = {
      id: user.id,
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
      followers_count: Number.parseInt(user.followers_count),
      following_count: Number.parseInt(user.following_count),
      posts_count: Number.parseInt(user.posts_count),
    }

    // Check follow status if current user is provided
    if (currentUserId && currentUserId !== userId) {
      const followStatus = await query(
        `SELECT 
           (SELECT status FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
           (SELECT status FROM follows WHERE follower_id = $2 AND following_id = $1) as is_followed_by`,
        [currentUserId, userId],
      )

      if (followStatus.rows.length > 0) {
        profile.is_following = followStatus.rows[0].is_following === "active"
        profile.is_followed_by = followStatus.rows[0].is_followed_by === "active"
      }
    }

    // Cache the profile (without follow status for general caching)
    if (!currentUserId) {
      await cache.set(cacheKey, profile, config.redis.ttl.user)
    }

    return profile
  }

  // Follow user
  static async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw errors.badRequest("Cannot follow yourself")
    }

    // Check if target user exists
    const targetUser = await query("SELECT id, is_private FROM users WHERE id = $1 AND is_active = true", [followingId])
    if (targetUser.rows.length === 0) {
      throw errors.notFound("User not found")
    }

    const isPrivate = targetUser.rows[0].is_private

    // Check if already following
    const existingFollow = await query("SELECT id, status FROM follows WHERE follower_id = $1 AND following_id = $2", [
      followerId,
      followingId,
    ])

    if (existingFollow.rows.length > 0) {
      const currentStatus = existingFollow.rows[0].status
      if (currentStatus === "active") {
        throw errors.conflict("Already following this user")
      } else if (currentStatus === "pending") {
        throw errors.conflict("Follow request already sent")
      }
    }

    // Determine status based on privacy
    const status = isPrivate ? "pending" : "active"

    // Insert or update follow record
    await query(
      `INSERT INTO follows (follower_id, following_id, status) 
       VALUES ($1, $2, $3)
       ON CONFLICT (follower_id, following_id) 
       DO UPDATE SET status = $3, created_at = NOW()`,
      [followerId, followingId, status],
    )

    // Clear cache
    await cache.del(cacheKeys.userFollowers(followingId))
    await cache.del(cacheKeys.userFollowing(followerId))
    await cache.del(`${cacheKeys.user(followingId)}:profile`)
    await cache.del(`${cacheKeys.user(followerId)}:profile`)

    // TODO: Send notification if follow is active or pending
  }

  // Unfollow user
  static async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const result = await query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [
      followerId,
      followingId,
    ])

    if (result.rowCount === 0) {
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

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              f.created_at as followed_at,
              COUNT(*) OVER() as total_count
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1 AND f.status = 'active' AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, validLimit, offset],
    )

    const followers = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      followed_at: row.followed_at,
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: followers,
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

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              f.created_at as followed_at,
              COUNT(*) OVER() as total_count
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1 AND f.status = 'active' AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, validLimit, offset],
    )

    const following = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      followed_at: row.followed_at,
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: following,
      pagination: paginationMeta,
    }
  }

  // Accept follow request
  static async acceptFollowRequest(userId: string, followerId: string): Promise<void> {
    const result = await query(
      "UPDATE follows SET status = $1 WHERE follower_id = $2 AND following_id = $3 AND status = $4",
      ["active", followerId, userId, "pending"],
    )

    if (result.rowCount === 0) {
      throw errors.notFound("Follow request not found")
    }

    // Clear cache
    await cache.del(cacheKeys.userFollowers(userId))
    await cache.del(cacheKeys.userFollowing(followerId))
    await cache.del(`${cacheKeys.user(userId)}:profile`)
    await cache.del(`${cacheKeys.user(followerId)}:profile`)

    // TODO: Send notification
  }

  // Reject follow request
  static async rejectFollowRequest(userId: string, followerId: string): Promise<void> {
    const result = await query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 AND status = $3", [
      followerId,
      userId,
      "pending",
    ])

    if (result.rowCount === 0) {
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

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              f.created_at as requested_at,
              COUNT(*) OVER() as total_count
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1 AND f.status = 'pending' AND u.is_active = true
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, validLimit, offset],
    )

    const requests = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      requested_at: row.requested_at,
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: requests,
      pagination: paginationMeta,
    }
  }
}

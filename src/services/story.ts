import { query, cache, transaction } from "../lib/database"
import { StorageService } from "../lib/storage"
import type { Story, CreateStoryRequest } from "../lib/types"
import { errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"

export class StoryService {
  // Create story
  static async createStory(userId: string, storyData: CreateStoryRequest): Promise<Story> {
    const { media_url, media_type, content } = storyData

    if (!media_url) {
      throw errors.badRequest("Media URL is required for stories")
    }

    if (!["image", "video"].includes(media_type)) {
      throw errors.badRequest("Media type must be 'image' or 'video'")
    }

    if (content && content.length > 500) {
      throw errors.badRequest("Story content too long (max 500 characters)")
    }

    const result = await query(
      `INSERT INTO stories (user_id, media_url, media_type, content) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, user_id, media_url, media_type, content, expires_at, is_archived, created_at`,
      [userId, media_url, media_type, content],
    )

    const story = result.rows[0]

    // Get user data
    const userResult = await query("SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1", [
      userId,
    ])

    const storyWithUser: Story = {
      ...story,
      user: userResult.rows[0],
      is_viewed: false,
    }

    // Clear user stories cache
    await cache.del(cacheKeys.userStories(userId))
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)

    return storyWithUser
  }

  // Get user stories
  static async getUserStories(userId: string, currentUserId?: string): Promise<Story[]> {
    // Check cache first
    const cacheKey = cacheKeys.userStories(userId)
    const cachedStories = await cache.get(cacheKey)
    if (cachedStories && !currentUserId) {
      return cachedStories
    }

    const result = await query(
      `SELECT s.id, s.user_id, s.media_url, s.media_type, s.content, 
              s.expires_at, s.is_archived, s.created_at,
              u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.expires_at > NOW() AND s.is_archived = false AND u.is_active = true
       ORDER BY s.created_at DESC`,
      [userId],
    )

    const stories = await Promise.all(
      result.rows.map(async (row) => {
        const story: Story = {
          id: row.id,
          user_id: row.user_id,
          media_url: row.media_url,
          media_type: row.media_type,
          content: row.content,
          expires_at: row.expires_at,
          is_archived: row.is_archived,
          created_at: row.created_at,
          user: {
            id: row.user_id,
            username: row.username,
            full_name: row.full_name,
            avatar_url: row.avatar_url,
            is_verified: row.is_verified,
          },
        }

        // Check if current user has viewed this story
        if (currentUserId) {
          const viewResult = await query("SELECT id FROM story_views WHERE story_id = $1 AND viewer_id = $2", [
            story.id,
            currentUserId,
          ])
          story.is_viewed = viewResult.rows.length > 0
        }

        return story
      }),
    )

    // Cache stories (without view status)
    if (!currentUserId) {
      await cache.set(cacheKey, stories, config.redis.ttl.story)
    }

    return stories
  }

  // Get stories feed (stories from followed users)
  static async getStoriesFeed(userId: string): Promise<Array<{ user: any; stories: Story[] }>> {
    const result = await query(
      `SELECT DISTINCT s.user_id,
              u.id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE (s.user_id = $1 OR s.user_id IN (
         SELECT following_id FROM follows 
         WHERE follower_id = $1 AND status = 'active'
       ))
       AND s.expires_at > NOW() AND s.is_archived = false AND u.is_active = true
       ORDER BY u.username`,
      [userId],
    )

    const userStoriesPromises = result.rows.map(async (row) => {
      const stories = await this.getUserStories(row.user_id, userId)
      return {
        user: {
          id: row.id,
          username: row.username,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          is_verified: row.is_verified,
        },
        stories,
      }
    })

    const userStories = await Promise.all(userStoriesPromises)
    return userStories.filter((item) => item.stories.length > 0)
  }

  // View story
  static async viewStory(storyId: string, viewerId: string): Promise<void> {
    // Check if story exists and is not expired
    const storyResult = await query(
      "SELECT id, user_id FROM stories WHERE id = $1 AND expires_at > NOW() AND is_archived = false",
      [storyId],
    )

    if (storyResult.rows.length === 0) {
      throw errors.notFound("Story not found or expired")
    }

    const story = storyResult.rows[0]

    // Don't record view if it's the story owner
    if (story.user_id === viewerId) {
      return
    }

    // Insert view record (ignore if already exists)
    await query(
      `INSERT INTO story_views (story_id, viewer_id) 
       VALUES ($1, $2) 
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [storyId, viewerId],
    )

    // Clear cache
    await cache.del(cacheKeys.userStories(story.user_id))
  }

  // Get story views
  static async getStoryViews(storyId: string, userId: string): Promise<Array<any>> {
    // Verify story ownership
    const storyResult = await query("SELECT user_id FROM stories WHERE id = $1", [storyId])
    if (storyResult.rows.length === 0 || storyResult.rows[0].user_id !== userId) {
      throw errors.forbidden("You can only view your own story views")
    }

    const result = await query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.is_verified,
              sv.viewed_at
       FROM story_views sv
       JOIN users u ON sv.viewer_id = u.id
       WHERE sv.story_id = $1 AND u.is_active = true
       ORDER BY sv.viewed_at DESC`,
      [storyId],
    )

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      viewed_at: row.viewed_at,
    }))
  }

  // Delete story
  static async deleteStory(storyId: string, userId: string): Promise<void> {
    // First, check if story exists
    const storyCheck = await query("SELECT id, user_id, media_url FROM stories WHERE id = $1", [storyId])

    if (storyCheck.rows.length === 0) {
      throw errors.notFound("Story not found")
    }

    const story = storyCheck.rows[0]

    // Verify ownership - only the story owner can delete it
    if (story.user_id !== userId) {
      throw errors.forbidden("You don't have permission to delete this story. Only the story owner can delete it.")
    }

    await transaction(async (client) => {
      // Archive the story (soft delete)
      await client.query("UPDATE stories SET is_archived = true WHERE id = $1 AND user_id = $2", [storyId, userId])

      // Delete associated views
      await client.query("DELETE FROM story_views WHERE story_id = $1", [storyId])
    })

    // Delete media file from S3 (extract key from URL)
    try {
      const urlParts = story.media_url.split("/")
      const key = urlParts.slice(-3).join("/") // Extract stories/userId/filename
      await StorageService.deleteFile(key)
    } catch (error) {
      console.error("Failed to delete story media:", error)
    }

    // Clear cache
    await cache.del(cacheKeys.userStories(userId))
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)
  }

  // Archive expired stories (cleanup job)
  static async archiveExpiredStories(): Promise<number> {
    const result = await query(
      "UPDATE stories SET is_archived = true WHERE expires_at <= NOW() AND is_archived = false",
    )

    // Clear all stories cache
    await cache.invalidatePattern(`${config.redis.keyPrefix}stories:*`)

    return result.rowCount || 0
  }
}

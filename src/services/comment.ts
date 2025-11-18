import { query, cache, transaction } from "../lib/database"
import type { Comment, CreateCommentRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { config } from "../lib/config"

export class CommentService {
  // Create comment
  static async createComment(userId: string, postId: string, commentData: CreateCommentRequest): Promise<Comment> {
    const { content, parent_comment_id } = commentData

    if (!content || content.trim().length === 0) {
      throw errors.badRequest("Comment content is required")
    }

    if (content.length > 1000) {
      throw errors.badRequest("Comment too long (max 1000 characters)")
    }

    // Check if post exists
    const postExists = await query("SELECT id FROM posts WHERE id = $1 AND is_archived = false", [postId])
    if (postExists.rows.length === 0) {
      throw errors.notFound("Post not found")
    }

    // Check if parent comment exists (if provided)
    if (parent_comment_id) {
      const parentExists = await query(
        "SELECT id FROM comments WHERE id = $1 AND post_id = $2 AND is_deleted = false",
        [parent_comment_id, postId],
      )
      if (parentExists.rows.length === 0) {
        throw errors.notFound("Parent comment not found")
      }
    }

    const result = await transaction(async (client) => {
      // Insert comment
      const commentResult = await client.query(
        `INSERT INTO comments (user_id, post_id, parent_comment_id, content) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, user_id, post_id, parent_comment_id, content, is_deleted, created_at, updated_at`,
        [userId, postId, parent_comment_id, content.trim()],
      )

      return commentResult.rows[0]
    })

    // Get user data
    const userResult = await query("SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1", [
      userId,
    ])

    const comment: Comment = {
      ...result,
      user: userResult.rows[0],
    }

    // Update cached post comment count
    const cachedPost = await cache.get(cacheKeys.post(postId))
    if (cachedPost) {
      cachedPost.comments_count = (cachedPost.comments_count || 0) + 1
      await cache.set(cacheKeys.post(postId), cachedPost, config.redis.ttl.post)
    }

    // Clear comments cache
    await cache.del(cacheKeys.postComments(postId))

    // TODO: Send notification to post owner and parent comment owner

    return comment
  }

  // Get post comments
  static async getPostComments(
    postId: string,
    page = 1,
    limit = 20,
    sortBy: "newest" | "oldest" = "newest",
  ): Promise<PaginatedResponse<Comment>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const orderBy = sortBy === "newest" ? "c.created_at DESC" : "c.created_at ASC"

    const result = await query(
      `SELECT c.id, c.user_id, c.post_id, c.parent_comment_id, c.content, 
              c.is_deleted, c.created_at, c.updated_at,
              u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
              COUNT(*) OVER() as total_count
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1 AND c.parent_comment_id IS NULL AND c.is_deleted = false AND u.is_active = true
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [postId, validLimit, offset],
    )

    const comments = await Promise.all(
      result.rows.map(async (row) => {
        const comment: Comment = {
          id: row.id,
          user_id: row.user_id,
          post_id: row.post_id,
          parent_comment_id: row.parent_comment_id,
          content: row.content,
          is_deleted: row.is_deleted,
          created_at: row.created_at,
          updated_at: row.updated_at,
          user: {
            id: row.user_id,
            username: row.username,
            full_name: row.full_name,
            avatar_url: row.avatar_url,
            is_verified: row.is_verified,
          },
        }

        // Get replies for this comment
        const repliesResult = await query(
          `SELECT c.id, c.user_id, c.post_id, c.parent_comment_id, c.content, 
                  c.is_deleted, c.created_at, c.updated_at,
                  u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified
           FROM comments c
           JOIN users u ON c.user_id = u.id
           WHERE c.parent_comment_id = $1 AND c.is_deleted = false AND u.is_active = true
           ORDER BY c.created_at ASC
           LIMIT 3`,
          [comment.id],
        )

        comment.replies = repliesResult.rows.map((replyRow) => ({
          id: replyRow.id,
          user_id: replyRow.user_id,
          post_id: replyRow.post_id,
          parent_comment_id: replyRow.parent_comment_id,
          content: replyRow.content,
          is_deleted: replyRow.is_deleted,
          created_at: replyRow.created_at,
          updated_at: replyRow.updated_at,
          user: {
            id: replyRow.user_id,
            username: replyRow.username,
            full_name: replyRow.full_name,
            avatar_url: replyRow.avatar_url,
            is_verified: replyRow.is_verified,
          },
        }))

        return comment
      }),
    )

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: comments,
      pagination: paginationMeta,
    }
  }

  // Get comment replies
  static async getCommentReplies(commentId: string, page = 1, limit = 20): Promise<PaginatedResponse<Comment>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const result = await query(
      `SELECT c.id, c.user_id, c.post_id, c.parent_comment_id, c.content, 
              c.is_deleted, c.created_at, c.updated_at,
              u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified,
              COUNT(*) OVER() as total_count
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.parent_comment_id = $1 AND c.is_deleted = false AND u.is_active = true
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [commentId, validLimit, offset],
    )

    const replies = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      post_id: row.post_id,
      parent_comment_id: row.parent_comment_id,
      content: row.content,
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified,
      },
    }))

    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count) : 0
    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: replies,
      pagination: paginationMeta,
    }
  }

  // Update comment
  static async updateComment(commentId: string, userId: string, content: string): Promise<Comment> {
    if (!content || content.trim().length === 0) {
      throw errors.badRequest("Comment content is required")
    }

    if (content.length > 1000) {
      throw errors.badRequest("Comment too long (max 1000 characters)")
    }

    const result = await query(
      `UPDATE comments SET content = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3 AND is_deleted = false
       RETURNING id, user_id, post_id, parent_comment_id, content, is_deleted, created_at, updated_at`,
      [content.trim(), commentId, userId],
    )

    if (result.rows.length === 0) {
      throw errors.notFound("Comment not found or you don't have permission to update it")
    }

    const comment = result.rows[0]

    // Get user data
    const userResult = await query("SELECT id, username, full_name, avatar_url, is_verified FROM users WHERE id = $1", [
      userId,
    ])

    const updatedComment: Comment = {
      ...comment,
      user: userResult.rows[0],
    }

    // Clear comments cache
    await cache.del(cacheKeys.postComments(comment.post_id))

    return updatedComment
  }

  // Delete comment
  static async deleteComment(commentId: string, userId: string): Promise<void> {
    // First, check if comment exists
    const commentCheck = await query("SELECT id, user_id, post_id, is_deleted FROM comments WHERE id = $1", [commentId])

    if (commentCheck.rows.length === 0) {
      throw errors.notFound("Comment not found")
    }

    const comment = commentCheck.rows[0]

    // Check if already deleted
    if (comment.is_deleted) {
      throw errors.notFound("Comment has already been deleted")
    }

    // Verify ownership - only the comment owner can delete it
    if (comment.user_id !== userId) {
      throw errors.forbidden("You don't have permission to delete this comment. Only the comment owner can delete it.")
    }

    const result = await transaction(async (client) => {
      // Soft delete the comment
      const deleteResult = await client.query(
        "UPDATE comments SET is_deleted = true WHERE id = $1 AND user_id = $2 AND is_deleted = false",
        [commentId, userId],
      )

      if (deleteResult.rowCount === 0) {
        throw errors.notFound("Failed to delete comment")
      }

      return comment.post_id
    })

    if (result) {
      // Update cached post comment count
      const cachedPost = await cache.get(cacheKeys.post(result))
      if (cachedPost) {
        cachedPost.comments_count = Math.max(0, (cachedPost.comments_count || 0) - 1)
        await cache.set(cacheKeys.post(result), cachedPost, config.redis.ttl.post)
      }

      // Clear comments cache
      await cache.del(cacheKeys.postComments(result))
    }
  }

  // Get comment by ID
  static async getCommentById(commentId: string): Promise<Comment> {
    const result = await query(
      `SELECT c.id, c.user_id, c.post_id, c.parent_comment_id, c.content, 
              c.is_deleted, c.created_at, c.updated_at,
              u.id as user_id, u.username, u.full_name, u.avatar_url, u.is_verified
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1 AND c.is_deleted = false AND u.is_active = true`,
      [commentId],
    )

    if (result.rows.length === 0) {
      throw errors.notFound("Comment not found")
    }

    const row = result.rows[0]
    return {
      id: row.id,
      user_id: row.user_id,
      post_id: row.post_id,
      parent_comment_id: row.parent_comment_id,
      content: row.content,
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_verified: row.is_verified,
      },
    }
  }
}

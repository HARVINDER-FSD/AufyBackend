import { cache } from "../lib/database"
import type { Comment, CreateCommentRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { maskAnonymousUser } from "../lib/anonymous-utils"
import { config } from "../lib/config"
import CommentModel from "../models/comment"
import PostModel from "../models/post"
import UserModel from "../models/user"
import type { Model } from "mongoose"

// Type assertions to fix Mongoose model type issues
const Comment = CommentModel as any as Model<any>
const Post = PostModel as any as Model<any>
const User = UserModel as any as Model<any>

export class CommentService {
  // Create comment
  static async createComment(userId: string, postId: string, commentData: CreateCommentRequest): Promise<Comment> {
    try {
      const { content, parent_comment_id } = commentData

      console.log('[COMMENT CREATE] Starting:', { userId, postId, content: content?.substring(0, 50) })

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error("Comment content is required")
      }

      if (content.length > 2200) {
        throw new Error("Comment too long (max 2200 characters)")
      }

      // Check if post exists
      console.log('[COMMENT CREATE] Checking if post exists...')
      const postExists = await Post.findById(postId).lean().exec()
      if (!postExists) {
        throw new Error("Post not found")
      }
      console.log('[COMMENT CREATE] Post found')

      // Check if parent comment exists (if provided)
      if (parent_comment_id) {
        console.log('[COMMENT CREATE] Checking parent comment...')
        const parentExists = await Comment.findById(parent_comment_id).lean().exec()
        if (!parentExists) {
          throw new Error("Parent comment not found")
        }
      }

      // Get user data
      console.log('[COMMENT CREATE] Fetching user data...')
      const user: any = await User.findById(userId)
        .select('username full_name avatar_url is_verified badge_type isAnonymousMode anonymousPersona')
        .lean()
        .exec()

      if (!user) {
        throw errors.notFound('User not found')
      }

      // Create comment
      console.log('[COMMENT CREATE] Creating comment...')
      const newComment = await Comment.create({
        user_id: userId,
        post_id: postId,
        parent_comment_id: parent_comment_id || null,
        content: content.trim(),
        is_deleted: false,
        is_anonymous: user.isAnonymousMode === true,
        likes_count: 0,
        replies_count: 0,
      })
      console.log('[COMMENT CREATE] Comment created:', newComment._id)


      const comment: any = {
        id: newComment._id.toString(),
        _id: newComment._id,
        user_id: newComment.user_id,
        post_id: newComment.post_id,
        content: newComment.content,
        parent_comment_id: newComment.parent_comment_id,
        likes_count: newComment.likes_count || 0,
        replies_count: newComment.replies_count || 0,
        is_deleted: newComment.is_deleted,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
        user: maskAnonymousUser({ ...user, is_anonymous: newComment.is_anonymous })
      }

      console.log('[COMMENT CREATE] Success!')
      return comment
    } catch (error: any) {
      console.error('[COMMENT CREATE] Error:', error)
      throw error
    }
  }

  // Get post comments
  static async getPostComments(
    postId: string,
    page = 1,
    limit = 20,
    sortBy: "newest" | "oldest" = "newest",
  ): Promise<PaginatedResponse<Comment>> {
    // Validate and sanitize pagination params
    const validPage = Math.max(1, Math.floor(page))
    const validLimit = Math.min(100, Math.max(1, Math.floor(limit)))
    const offset = (validPage - 1) * validLimit

    const sortOrder = sortBy === "newest" ? -1 : 1

    const total = await Comment.countDocuments({
      post_id: postId,
      parent_comment_id: null,
      is_deleted: false
    }).exec()

    const comments = await Comment.find({
      post_id: postId,
      parent_comment_id: null,
      is_deleted: false
    })
      .sort({ created_at: sortOrder })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    // Get users for main comments
    const userIds = comments.map((c: any) => c.user_id)
    const users = await User.find({ _id: { $in: userIds } })
      .select('id username full_name avatar_url is_verified badge_type')
      .lean()
      .exec()

    // Get all comment IDs to fetch replies in batch
    const commentIds = comments.map((c: any) => c._id)
    
    // Fetch all replies for these comments in one query
    const allReplies = await Comment.find({
      parent_comment_id: { $in: commentIds },
      is_deleted: false
    })
      .sort({ created_at: 1 })
      .lean()
      .exec()

    // Get all user IDs from replies
    const replyUserIds = [...new Set(allReplies.map((r: any) => r.user_id.toString()))]
    const replyUsers = await User.find({ _id: { $in: replyUserIds } })
      .select('id username full_name avatar_url is_verified badge_type')
      .lean()
      .exec()

    const commentsWithData = comments.map((comment: any) => {
      const user = users.find((u: any) => u._id.toString() === comment.user_id.toString())
      
      // Filter replies for this comment (limit to 3 per comment as before)
      const commentReplies = allReplies
        .filter((r: any) => r.parent_comment_id.toString() === comment._id.toString())
        .slice(0, 3)
      
      const repliesWithUsers = commentReplies.map((reply: any) => {
        const replyUser = replyUsers.find((u: any) => u._id.toString() === reply.user_id.toString())
        return {
          ...reply,
          user: maskAnonymousUser({ ...replyUser, is_anonymous: reply.is_anonymous })
        }
      })

      return {
        ...comment,
        user: maskAnonymousUser({ ...user, is_anonymous: comment.is_anonymous }),
        replies: repliesWithUsers
      }
    })

    const totalPages = Math.ceil(total / validLimit)

    return {
      success: true,
      data: commentsWithData as any[],
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasNext: validPage < totalPages,
        hasPrev: validPage > 1,
      },
    }
  }

  // Get comment replies
  static async getCommentReplies(commentId: string, page = 1, limit = 20): Promise<PaginatedResponse<Comment>> {
    const { page: validPage, limit: validLimit } = pagination.validateParams(page.toString(), limit.toString())
    const offset = pagination.getOffset(validPage, validLimit)

    const total = await Comment.countDocuments({
      parent_comment_id: commentId,
      is_deleted: false
    }).exec()

    const replies = await Comment.find({
      parent_comment_id: commentId,
      is_deleted: false
    })
      .sort({ created_at: 1 })
      .skip(offset)
      .limit(validLimit)
      .lean()
      .exec()

    const userIds = replies.map((r: any) => r.user_id)
    const users = await User.find({ _id: { $in: userIds }, is_active: true })
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    const repliesWithUsers = replies.map((reply: any) => {
      const user = users.find((u: any) => u._id.toString() === reply.user_id.toString())
      return {
        ...reply,
        user: maskAnonymousUser({ ...user, is_anonymous: reply.is_anonymous })
      }
    })

    const paginationMeta = pagination.getMetadata(validPage, validLimit, total)

    return {
      success: true,
      data: repliesWithUsers as any[],
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

    const comment: any = await Comment.findOneAndUpdate(
      {
        _id: commentId,
        user_id: userId,
        is_deleted: false
      },
      {
        content: content.trim(),
        updated_at: new Date()
      },
      { new: true }
    ).lean().exec()

    if (!comment) {
      throw errors.notFound("Comment not found or you don't have permission to update it")
    }

    // Get user data
    const user: any = await User.findById(userId)
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    const updatedComment: any = {
      ...comment,
      user: maskAnonymousUser({ ...user, is_anonymous: comment.is_anonymous })
    }

    // Clear comments cache
    await cache.del(cacheKeys.postComments(comment.post_id))

    return updatedComment
  }

  // Delete comment
  static async deleteComment(commentId: string, userId: string): Promise<void> {
    // First, check if comment exists
    const comment: any = await Comment.findById(commentId).lean().exec()

    if (!comment) {
      throw errors.notFound("Comment not found")
    }

    // Check if already deleted
    if (comment.is_deleted) {
      throw errors.notFound("Comment has already been deleted")
    }

    // Verify ownership - only the comment owner can delete it
    if (comment.user_id.toString() !== userId) {
      throw errors.forbidden("You don't have permission to delete this comment. Only the comment owner can delete it.")
    }

    // Soft delete the comment
    const result = await Comment.updateOne(
      {
        _id: commentId,
        user_id: userId,
        is_deleted: false
      },
      {
        is_deleted: true
      }
    ).exec()

    if (result.matchedCount === 0) {
      throw errors.notFound("Failed to delete comment")
    }

    // Update cached post comment count
    const cachedPost = await cache.get(cacheKeys.post(comment.post_id))
    if (cachedPost) {
      cachedPost.comments_count = Math.max(0, (cachedPost.comments_count || 0) - 1)
      await cache.set(cacheKeys.post(comment.post_id), cachedPost, config.redis.ttl.post)
    }

    // Clear comments cache
    await cache.del(cacheKeys.postComments(comment.post_id))
  }

  // Get comment by ID
  static async getCommentById(commentId: string): Promise<Comment> {
    const comment: any = await Comment.findOne({
      _id: commentId,
      is_deleted: false
    }).lean().exec()

    if (!comment) {
      throw errors.notFound("Comment not found")
    }

    const user: any = await User.findOne({
      _id: comment.user_id,
      is_active: true
    })
      .select('id username full_name avatar_url is_verified')
      .lean()
      .exec()

    if (!user) {
      throw errors.notFound("Comment user not found")
    }

    return {
      ...comment,
      user: maskAnonymousUser({ ...user, is_anonymous: comment.is_anonymous })
    }
  }
}

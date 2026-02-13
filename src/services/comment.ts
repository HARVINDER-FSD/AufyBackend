import { cache } from "../lib/database"
import type { Comment, CreateCommentRequest, PaginatedResponse } from "../lib/types"
import { pagination, errors, cacheKeys } from "../lib/utils"
import { maskAnonymousUser } from "../lib/anonymous-utils"
import { config } from "../lib/config"
import CommentModel from "../models/comment"
import PostModel from "../models/post"
import UserModel from "../models/user"
import ReelModel from "../models/reel"
import LikeModel from "../models/like"
import type { Model } from "mongoose"
import { addJob, QUEUE_NAMES } from "../lib/queue"
import { ModerationService } from "./moderation"

// Type assertions to fix Mongoose model type issues
const Comment = CommentModel as any as Model<any>
const Post = PostModel as any as Model<any>
const User = UserModel as any as Model<any>
const Reel = ReelModel as any as Model<any>
const Like = LikeModel as any as Model<any>

export class CommentService {
  // Create comment
  static async createComment(userId: string, postId: string, commentData: CreateCommentRequest): Promise<Comment> {
    try {
      const { content, parent_comment_id, is_anonymous } = commentData

      console.log('[COMMENT CREATE] Starting:', { userId, postId, content: content?.substring(0, 50) })

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error("Comment content is required")
      }

      if (content.length > 2200) {
        throw new Error("Comment too long (max 2200 characters)")
      }

      // Moderation Check (Safety)
      if (is_anonymous) {
        await ModerationService.checkContent(content);
      }

      // Check if post or reel exists
      console.log('[COMMENT CREATE] Checking if post/reel exists...')
      let targetType = 'post';
      let targetEntity: any = await Post.findById(postId).lean().exec();
      
      if (!targetEntity) {
        targetEntity = await Reel.findById(postId).lean().exec();
        if (targetEntity) {
          targetType = 'reel';
        }
      }

      if (!targetEntity) {
        throw new Error("Post or Reel not found")
      }
      console.log(`[COMMENT CREATE] ${targetType} found`)

      // Check if parent comment exists (if provided)
      let finalParentId = parent_comment_id || null;
      if (parent_comment_id) {
        console.log('[COMMENT CREATE] Checking parent comment...')
        const parentExists: any = await Comment.findById(parent_comment_id).lean().exec()
        if (!parentExists) {
          throw new Error("Parent comment not found")
        }
        
        // Check for nesting depth - Flatten if necessary (max 1 level depth: Comment -> Reply)
        if (parentExists.parent_comment_id) {
            console.log('[COMMENT CREATE] Flattening nested reply...');
            finalParentId = parentExists.parent_comment_id.toString();
        }
      }

      // --- MENTIONS EXTRACTION LOGIC ---
      const mentionRegex = /@(\w+)/g;
      const mentionedUsernames = [...new Set((content.match(mentionRegex) || []).map(m => m.substring(1)))];
      
      let validMentions: string[] = [];
      let mentionedUserIds: string[] = [];

      if (mentionedUsernames.length > 0) {
          // Verify users exist
          const foundUsers = await User.find({ username: { $in: mentionedUsernames } })
              .select('_id username')
              .lean()
              .exec();
          
          validMentions = foundUsers.map((u: any) => u.username);
          mentionedUserIds = foundUsers.map((u: any) => u._id.toString());
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
      const isAnonymous = is_anonymous !== undefined ? is_anonymous : (user.isAnonymousMode === true);

      const newComment = await Comment.create({
        user_id: userId,
        post_id: postId,
        parent_comment_id: finalParentId,
        content: content.trim(),
        is_deleted: false,
        is_anonymous: isAnonymous,
        likes_count: 0,
        replies_count: 0,
        mentions: validMentions // Store validated mentions
      })
      console.log('[COMMENT CREATE] Comment created:', newComment._id)

      // Increment comments count on Post or Reel
      if (targetType === 'reel') {
        await Reel.updateOne({ _id: postId }, { $inc: { comments_count: 1 } });
      } else {
        await Post.updateOne({ _id: postId }, { $inc: { comments_count: 1 } });
      }
      
      // Increment replies count on parent comment if applicable
      if (finalParentId) {
        await Comment.updateOne({ _id: finalParentId }, { $inc: { replies_count: 1 } });
      }

      const comment: any = {
        id: newComment._id.toString(),
        _id: newComment._id,
        user_id: newComment.user_id,
        post_id: newComment.post_id,
        content: newComment.content,
        parent_comment_id: newComment.parent_comment_id,
        likes_count: newComment.likes_count || 0,
        replies_count: newComment.replies_count || 0,
        mentions: newComment.mentions || [],
        is_deleted: newComment.is_deleted,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
        user: maskAnonymousUser({ ...user, is_anonymous: newComment.is_anonymous }) as any
      }

      // Send Notification (if not own post)
      try {
        const postOwnerId = (targetEntity as any).user_id?.toString()
        if (postOwnerId && postOwnerId !== userId) {
          const entityName = targetType === 'reel' ? 'reel' : 'post';
          await addJob(QUEUE_NAMES.NOTIFICATIONS, 'comment-notification', {
            recipientId: postOwnerId,
            title: 'New Comment 💬',
            body: isAnonymous ? `A Ghost User 👻 commented on your ${entityName}.` : `${user.username} commented on your ${entityName}.`,
            data: { 
              postId, 
              commentId: newComment._id.toString(),
              type: 'comment',
              actorId: userId
            }
          })
        }

        // --- NOTIFY REPLY TO PARENT COMMENT ---
        if (parent_comment_id) {
            const parentComment: any = await Comment.findById(parent_comment_id).lean().exec();
            if (parentComment && parentComment.user_id.toString() !== userId && parentComment.user_id.toString() !== postOwnerId) {
                 // Only notify if parent author is different from current user AND different from post owner (who already got a notification)
                 await addJob(QUEUE_NAMES.NOTIFICATIONS, 'reply-notification', {
                    recipientId: parentComment.user_id.toString(),
                    title: 'New Reply ↩️',
                    body: isAnonymous ? `A Ghost User replied to your comment.` : `${user.username} replied to your comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                    data: {
                        postId,
                        commentId: newComment._id.toString(),
                        type: 'reply',
                        actorId: userId
                    }
                });
            }
        }

        // --- NOTIFY MENTIONED USERS ---
        for (const mentionedUserId of mentionedUserIds) {
            // Don't notify if user mentions themselves (weird but possible)
            if (mentionedUserId !== userId) {
                await addJob(QUEUE_NAMES.NOTIFICATIONS, 'mention-notification', {
                    recipientId: mentionedUserId,
                    title: 'You were mentioned 📣',
                    body: isAnonymous ? `A Ghost User mentioned you in a comment.` : `${user.username} mentioned you: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                    data: {
                        postId,
                        commentId: newComment._id.toString(),
                        type: 'mention',
                        actorId: userId
                    }
                });
            }
        }
      } catch (err) {
        console.error('[COMMENT CREATE] Notification error:', err)
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
    currentUserId: string | null = null
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

    // Fetch likes if user is logged in
    let likedCommentIds = new Set<string>();
    if (currentUserId) {
        const allFetchedCommentIds = [...commentIds, ...allReplies.map((r: any) => r._id)];
        const likes = await Like.find({
            user_id: currentUserId,
            post_id: { $in: allFetchedCommentIds },
            content_type: 'Comment'
        }).select('post_id').lean().exec();
        
        likes.forEach((l: any) => likedCommentIds.add(l.post_id.toString()));
    }

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
          user: maskAnonymousUser({ ...replyUser, is_anonymous: reply.is_anonymous }),
          isLiked: likedCommentIds.has(reply._id.toString())
        }
      })

      return {
        ...comment,
        user: maskAnonymousUser({ ...user, is_anonymous: comment.is_anonymous }),
        replies: repliesWithUsers,
        isLiked: likedCommentIds.has(comment._id.toString())
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
  static async getCommentReplies(commentId: string, page = 1, limit = 20, currentUserId: string | null = null): Promise<PaginatedResponse<Comment>> {
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
      .select('id username full_name avatar_url is_verified badge_type')
      .lean()
      .exec()

    // Fetch likes if user is logged in
    let likedCommentIds = new Set<string>();
    if (currentUserId) {
        const replyIds = replies.map((r: any) => r._id);
        const likes = await Like.find({
            user_id: currentUserId,
            post_id: { $in: replyIds },
            content_type: 'Comment'
        }).select('post_id').lean().exec();
        
        likes.forEach((l: any) => likedCommentIds.add(l.post_id.toString()));
    }

    const repliesWithUsers = replies.map((reply: any) => {
      const user = users.find((u: any) => u._id.toString() === reply.user_id.toString())
      return {
        ...reply,
        user: maskAnonymousUser({ ...user, is_anonymous: reply.is_anonymous }),
        isLiked: likedCommentIds.has(reply._id.toString())
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
  static async getCommentById(commentId: string, currentUserId: string | null = null): Promise<Comment> {
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
      .select('id username full_name avatar_url is_verified badge_type')
      .lean()
      .exec()

    if (!user) {
      throw errors.notFound("Comment user not found")
    }

    let isLiked = false;
    if (currentUserId) {
        const like = await Like.findOne({
            user_id: currentUserId,
            post_id: commentId,
            content_type: 'Comment'
        }).lean().exec();
        isLiked = !!like;
    }

    return {
      ...comment,
      user: maskAnonymousUser({ ...user, is_anonymous: comment.is_anonymous }),
      isLiked
    }
  }

  // Like comment
  static async likeComment(userId: string, commentId: string): Promise<void> {
    const comment: any = await Comment.findById(commentId).lean().exec()
    if (!comment) {
      throw errors.notFound("Comment not found")
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      user_id: userId,
      post_id: commentId,
      content_type: 'Comment'
    })

    if (existingLike) {
      return // Already liked
    }

    // Create like
    await Like.create({
      user_id: userId,
      post_id: commentId,
      content_type: 'Comment'
    })

    // Increment like count
    await Comment.updateOne({ _id: commentId }, { $inc: { likes_count: 1 } })

    // Send notification
    try {
      if (comment.user_id.toString() !== userId) {
        const liker: any = await User.findById(userId).select('username full_name isAnonymousMode').lean().exec()
        
        // Don't notify if liker is anonymous? Or notify as Ghost?
        // Usually likes are public or semi-public. If user is in anonymous mode, maybe we mask it?
        // But for likes, maybe we just show "Someone liked your comment" or "Ghost liked"?
        // Let's use the standard notification pattern.
        
        const isAnonymous = liker.isAnonymousMode === true;
        const displayName = isAnonymous ? "A Ghost User" : (liker.full_name || liker.username);

        await addJob(QUEUE_NAMES.NOTIFICATIONS, 'like-notification', {
          recipientId: comment.user_id.toString(),
          title: 'New Like ❤️',
          body: `${displayName} liked your comment: "${comment.content.substring(0, 30)}..."`,
          data: {
            postId: comment.post_id.toString(), // Navigate to post
            commentId: comment._id.toString(),
            type: 'comment_like',
            actorId: userId
          }
        })
      }
    } catch (err) {
      console.error('[COMMENT LIKE] Notification error:', err)
    }
  }

  // Unlike comment
  static async unlikeComment(userId: string, commentId: string): Promise<void> {
    const result = await Like.deleteOne({
      user_id: userId,
      post_id: commentId,
      content_type: 'Comment'
    })

    if (result.deletedCount > 0) {
      await Comment.updateOne({ _id: commentId }, { $inc: { likes_count: -1 } })
    }
  }
}

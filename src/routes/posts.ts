import { Router } from "express"
import { PostService } from "../services/post"
import { CommentService } from "../services/comment"
import { authenticateToken, optionalAuth } from "../middleware/auth"
import { getDatabase } from "../lib/database"
import { ObjectId } from "mongodb"
import { cacheGet, cacheSet, cacheDel, cacheInvalidate } from "../lib/redis"

const router = Router()

// Get user feed
router.get("/feed", authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query
    const pageNum = Number.parseInt(page as string) || 1
    const limitNum = Number.parseInt(limit as string) || 20

    // Try cache first
    const cacheKey = `feed:${req.userId}:${pageNum}:${limitNum}`
    const cached = await cacheGet(cacheKey)
    if (cached) {
      console.log(`✅ Cache hit for feed page ${pageNum}`)
      return res.json(cached)
    }

    const result = await PostService.getFeedPosts(
      req.userId!,
      pageNum,
      limitNum,
    )

    // Cache for 2 minutes
    await cacheSet(cacheKey, result, 120)

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Create post
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { content, media_urls, media_type, location } = req.body

    // Use req.userId instead of req.user.userId
    const post = await PostService.createPost(req.userId!, {
      content,
      media_urls,
      media_type,
      location,
    })

    // Invalidate all caches when new post is created
    await cacheInvalidate(`feed:${req.userId}:*`)
    await cacheInvalidate(`user_posts:${req.userId}:*`)

    res.status(201).json({
      success: true,
      data: { post },
      message: "Post created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get post by ID
router.get("/:postId", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const post = await PostService.getPostById(postId, req.user?.userId)

    res.json({
      success: true,
      data: { post },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Update post
router.put("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const updates = req.body

    const post = await PostService.updatePost(postId, req.userId!, updates)

    res.json({
      success: true,
      data: { post },
      message: "Post updated successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete post
router.delete("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    await PostService.deletePost(postId, req.userId!)

    res.json({
      success: true,
      message: "Post deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Like post (toggle behavior with reactions)
router.post("/:postId/like", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const { reaction } = req.body // Get reaction from request body
    const userId = req.userId!
    
    const db = await getDatabase()
    const likesCollection = db.collection('likes')
    
    // Check if already liked
    const existingLike = await likesCollection.findOne({
      user_id: new ObjectId(userId),
      post_id: new ObjectId(postId)
    })
    
    let isLiked: boolean
    let userReaction: string | null = null
    
    if (existingLike && !reaction) {
      // Unlike - delete the like (only if no reaction provided)
      await likesCollection.deleteOne({
        user_id: new ObjectId(userId),
        post_id: new ObjectId(postId)
      })
      isLiked = false
      
      // Delete like notification
      try {
        const { deleteLikeNotification } = require('../lib/notifications');
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        if (post && post.user_id) {
          await deleteLikeNotification(post.user_id.toString(), userId, postId);
        }
      } catch (err) {
        console.error('[LIKE] Notification deletion error:', err);
      }
    } else if (existingLike && reaction) {
      // Update existing like with new reaction
      await likesCollection.updateOne(
        {
          user_id: new ObjectId(userId),
          post_id: new ObjectId(postId)
        },
        {
          $set: {
            reaction: reaction,
            updated_at: new Date()
          }
        }
      )
      isLiked = true
      userReaction = reaction
    } else {
      // Like - insert new like with reaction
      await likesCollection.insertOne({
        user_id: new ObjectId(userId),
        post_id: new ObjectId(postId),
        reaction: reaction || '❤️', // Default to heart if no reaction specified
        created_at: new Date()
      })
      isLiked = true
      userReaction = reaction || '❤️'
      
      // Create like notification (with deduplication)
      try {
        const { notifyLike } = require('../lib/notifications');
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        if (post && post.user_id && post.user_id.toString() !== userId) {
          await notifyLike(post.user_id.toString(), userId, postId);
        }
      } catch (err) {
        console.error('[LIKE] Notification creation error:', err);
      }
    }
    
    // Get updated like count
    const likeCount = await likesCollection.countDocuments({ post_id: new ObjectId(postId) })
    
    // Get users who liked (for "liked by" display)
    const recentLikes = await likesCollection.aggregate([
      { $match: { post_id: new ObjectId(postId) } },
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
    ]).toArray()
    
    const likedBy = recentLikes.map((like: any) => like.user.username)

    // Get reaction summary (count of each reaction type)
    const reactionSummary = await likesCollection.aggregate([
      { $match: { post_id: new ObjectId(postId) } },
      {
        $group: {
          _id: '$reaction',
          count: { $sum: 1 }
        }
      }
    ]).toArray()
    
    // Convert to object format: { "❤️": 10, "😍": 5, ... }
    const reactions: { [emoji: string]: number } = {}
    reactionSummary.forEach((item: any) => {
      if (item._id) {
        reactions[item._id] = item.count
      }
    })

    res.json({
      success: true,
      liked: isLiked,
      likeCount,
      likedBy,
      reaction: userReaction, // User's current reaction
      reactions, // Summary of all reactions on this post
      message: isLiked ? "Post liked successfully" : "Post unliked successfully",
    })
  } catch (error: any) {
    console.error('Like error:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Unlike post
router.delete("/:postId/like", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    await PostService.unlikePost(req.userId!, postId)

    res.json({
      success: true,
      message: "Post unliked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get post likes
router.get("/:postId/likes", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const { page, limit } = req.query

    const result = await PostService.getPostLikes(
      postId,
      Number.parseInt(page as string) || 1,
      Number.parseInt(limit as string) || 20,
    )

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get post comments
router.get("/:postId/comments", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const { page, limit, sort } = req.query

    const result = await CommentService.getPostComments(
      postId,
      Number.parseInt(page as string) || 1,
      Number.parseInt(limit as string) || 20,
      (sort as "newest" | "oldest") || "newest",
    )

    res.json(result)
  } catch (error: any) {
    console.error('[COMMENTS] Error fetching comments:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to fetch comments',
      data: [], // Return empty array as fallback
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }
    })
  }
})

// Create comment
router.post("/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const { content, parent_comment_id } = req.body

    const comment = await CommentService.createComment(req.userId!, postId, {
      content,
      parent_comment_id,
    })

    res.status(201).json({
      success: true,
      data: { comment },
      message: "Comment created successfully",
    })
  } catch (error: any) {
    console.error('[COMMENT CREATE] Error:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to create comment',
    })
  }
})

export default router

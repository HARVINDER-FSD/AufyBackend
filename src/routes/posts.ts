import { Router } from "express"
import { PostService } from "../services/post"
import { CommentService } from "../services/comment"
import { authenticateToken, optionalAuth } from "../middleware/auth"
import { getDatabase } from "../lib/database"
import { ObjectId } from "mongodb"
import { cacheGet, cacheSet, cacheDel, cacheInvalidate } from "../lib/redis"
import { validateBody } from "../middleware/validate"
import { paginate } from "../middleware/pagination"
import { addJob, QUEUE_NAMES } from "../lib/queue"
import Joi from "joi"
import { validateAgeAndContent } from "../middleware/content-filter"

const router = Router()

// Schemas
const createPostSchema = Joi.object({
  content: Joi.string().max(2000).required(),
  media_urls: Joi.array().items(Joi.string().uri()).max(10).optional(),
  media_type: Joi.string().valid('image', 'video', 'text', 'carousel').default('text'),
  location: Joi.object({
    name: Joi.string().allow(''),
    lat: Joi.number(),
    lng: Joi.number()
  }).optional()
})

const updatePostSchema = Joi.object({
  content: Joi.string().max(2000).optional(),
  location: Joi.object({
    name: Joi.string().allow(''),
    lat: Joi.number(),
    lng: Joi.number()
  }).optional()
})

const postReactionSchema = Joi.object({
  reaction: Joi.string().max(50).optional()
})

const createCommentSchema = Joi.object({
  content: Joi.string().max(1000).required(),
  parent_comment_id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional()
})

// Get user feed
router.get("/feed", authenticateToken, paginate, async (req, res) => {
  try {
    const { page, limit } = req.pagination; // Use req.pagination
    const pageNum = page || 1;
    const limitNum = limit || 20;

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
router.post("/", authenticateToken, validateAgeAndContent, validateBody(createPostSchema), async (req, res) => {
  try {
    const { content, media_urls, media_type, location } = req.body

    // Use req.userId instead of req.user.userId
    const post = await PostService.createPost(req.userId!, {
      content,
      media_urls,
      media_type,
      location,
    })

    // Invalidate local caches
    await cacheInvalidate(`feed:${req.userId}:*`)
    await cacheInvalidate(`user_posts:${req.userId}:*`)

    // Trigger background feed update for followers
    await addJob(QUEUE_NAMES.FEED_UPDATES, 'post-created', {
      userId: req.userId,
      type: 'new_post'
    });


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

// Get post by ID (only valid MongoDB ObjectId, avoid conflicting with /liked, /saved, etc.)
router.get("/:postId([0-9a-fA-F]{24})", optionalAuth, async (req, res) => {
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
router.put("/:postId", authenticateToken, validateAgeAndContent, validateBody(updatePostSchema), async (req, res) => {
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
router.post("/:postId/like", authenticateToken, validateBody(postReactionSchema), async (req, res) => {
  try {
    const { postId } = req.params
    const { reaction } = req.body // Get reaction from request body
    const userId = req.userId!

    let userObjectId: ObjectId
    let postObjectId: ObjectId
    try {
      userObjectId = new ObjectId(userId)
      postObjectId = new ObjectId(postId)
    } catch (err: any) {
      console.error('[LIKE] ObjectId conversion error:', err)
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      })
    }

    const db = await getDatabase()
    const likesCollection = db.collection('likes')

    const existingLike = await likesCollection.findOne({
      user_id: userObjectId,
      post_id: postObjectId
    })

    let isLiked: boolean
    let userReaction: string | null = null

    if (existingLike && !reaction) {
      await likesCollection.deleteOne({
        user_id: userObjectId,
        post_id: postObjectId
      })
      isLiked = false

      try {
        const { deleteLikeNotification } = require('../lib/notifications');
        const post = await db.collection('posts').findOne({ _id: postObjectId });
        if (post && post.user_id) {
          await deleteLikeNotification(post.user_id.toString(), userId, postId);
        }
      } catch (err) {
        console.error('[LIKE] Notification deletion error:', err);
      }
    } else if (existingLike && reaction) {
      await likesCollection.updateOne(
        {
          user_id: userObjectId,
          post_id: postObjectId
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
      const user = await db.collection('users').findOne({ _id: userObjectId });
      const isAnonymous = user?.isAnonymousMode === true;

      await likesCollection.insertOne({
        user_id: userObjectId,
        post_id: postObjectId,
        reaction: reaction || '❤️',
        is_anonymous: isAnonymous,
        created_at: new Date()
      })
      isLiked = true
      userReaction = reaction || '❤️'

      try {
        const post = await db.collection('posts').findOne({ _id: postObjectId });
        if (post && post.user_id && post.user_id.toString() !== userId) {
          const sender = await db.collection('users').findOne({ _id: userObjectId });

          await addJob(QUEUE_NAMES.NOTIFICATIONS, 'like-notification', {
            recipientId: post.user_id.toString(),
            title: 'New Like! ❤️',
            body: isAnonymous ? 'A Ghost User 👻 liked your post.' : `${sender?.username || 'Someone'} liked your post.`,
            data: { postId, type: 'like' }
          });
        }
      } catch (err) {
        console.error('[LIKE] Queue error:', err);
      }
    }


    const likeCount = await likesCollection.countDocuments({ post_id: postObjectId })

    const recentLikes = await likesCollection.aggregate([
      { $match: { post_id: postObjectId } },
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
      { $project: { 'user.username': 1, 'is_anonymous': 1 } }
    ]).toArray()

    const likedBy = recentLikes.map((like: any) => like.is_anonymous ? 'Ghost User' : like.user.username)

    const reactionSummary = await likesCollection.aggregate([
      { $match: { post_id: postObjectId } },
      {
        $group: {
          _id: '$reaction',
          count: { $sum: 1 }
        }
      }
    ]).toArray()

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

// Get user's liked posts
router.get("/liked", authenticateToken, async (req, res) => {
  try {
    let userId = req.userId!
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const db = await getDatabase()

    console.log('[Posts/Liked] Raw userId:', userId, 'Type:', typeof userId)

    // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
      console.log('[Posts/Liked] Converted to ObjectId:', userObjectId.toString())
    } catch (err) {
      console.error('[Posts/Liked] Failed to convert userId to ObjectId:', err)
      return res.json({
        success: true,
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      })
    }

    const likesFilter = {
      $or: [
        { user_id: userObjectId },
        { user_id: userId }
      ]
    }

    const total = await db.collection('likes').countDocuments(likesFilter)

    console.log('[Posts/Liked] Total liked posts:', total)

    const likedPosts = await db.collection('likes')
      .aggregate([
        { $match: likesFilter },
        {
          $addFields: {
            normalizedPostId: {
              $cond: [
                { $eq: [{ $type: '$post_id' }, 'objectId'] },
                '$post_id',
                {
                  $convert: {
                    input: '$post_id',
                    to: 'objectId',
                    onError: null,
                    onNull: null
                  }
                }
              ]
            }
          }
        },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'posts',
            localField: 'normalizedPostId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'post.user_id',
            foreignField: '_id',
            as: 'author'
          }
        },
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: '$post._id',
            content: '$post.content',
            media_urls: '$post.media_urls',
            media_type: '$post.media_type',
            createdAt: '$post.created_at',
            likesCount: '$post.likes_count',
            commentsCount: '$post.comments_count',
            sharesCount: '$post.shares_count',
            author: {
              _id: '$author._id',
              username: '$author.username',
              avatar: '$author.avatar'
            }
          }
        },
        { $match: { _id: { $ne: null } } }
      ]).toArray()

    console.log('[Posts/Liked] Found liked posts:', likedPosts.length)

    res.json({
      success: true,
      endpoint: '/api/posts/liked',
      version: 2,
      posts: likedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    })
  } catch (error: any) {
    console.error('[Posts/Liked] Error:', error)
    res.json({
      success: true,
      endpoint: '/api/posts/liked',
      version: 2,
      posts: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    })
  }
})

// Get user's saved posts
router.get("/saved", authenticateToken, async (req, res) => {
  try {
    let userId = req.userId!
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const db = await getDatabase()

    console.log('[Posts/Saved] Raw userId:', userId, 'Type:', typeof userId)

    // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
      console.log('[Posts/Saved] Converted to ObjectId:', userObjectId.toString())
    } catch (err) {
      console.error('[Posts/Saved] Failed to convert userId to ObjectId:', err)
      return res.json({
        success: true,
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      })
    }

    console.log('[Posts/Saved] Using userObjectId:', userObjectId.toString())

    // Debug: Check all bookmarks in collection
    try {
      const allBookmarks = await db.collection('bookmarks').find({}).limit(5).toArray()
      console.log('[Posts/Saved] Sample bookmarks in collection:', allBookmarks.map(b => ({
        user_id: b.user_id?.toString?.() || b.user_id,
        post_id: b.post_id?.toString?.() || b.post_id,
        created_at: b.created_at
      })))
    } catch (debugErr) {
      console.log('[Posts/Saved] Could not fetch sample bookmarks:', debugErr)
    }

    // Get total count of saved posts
    let total = 0
    try {
      total = await db.collection('bookmarks').countDocuments({
        user_id: userObjectId
      })
    } catch (countErr) {
      console.log('[Posts/Saved] Bookmarks collection may not exist yet, returning empty')
      total = 0
    }

    console.log('[Posts/Saved] Total saved posts:', total)

    // Get saved posts with full details
    let savedPosts: any[] = []
    if (total > 0) {
      try {
        savedPosts = await db.collection('bookmarks')
          .aggregate([
            { $match: { user_id: userObjectId } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'posts',
                localField: 'post_id',
                foreignField: '_id',
                as: 'post'
              }
            },
            { $unwind: { path: '$post', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'users',
                localField: 'post.user_id',
                foreignField: '_id',
                as: 'author'
              }
            },
            { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: '$post._id',
                content: '$post.content',
                media_urls: '$post.media_urls',
                media_type: '$post.media_type',
                createdAt: '$post.created_at',
                likesCount: '$post.likes_count',
                commentsCount: '$post.comments_count',
                sharesCount: '$post.shares_count',
                author: {
                  _id: '$author._id',
                  username: '$author.username',
                  avatar: '$author.avatar'
                }
              }
            },
            { $match: { _id: { $ne: null } } }
          ]).toArray()
      } catch (aggErr) {
        console.error('[Posts/Saved] Aggregation error:', aggErr)
        savedPosts = []
      }
    }

    console.log('[Posts/Saved] Found saved posts:', savedPosts.length)

    res.json({
      success: true,
      posts: savedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    })
  } catch (error: any) {
    console.error('[Posts/Saved] Error:', error)
    // Return empty results on error instead of 500
    res.json({
      success: true,
      posts: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
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

// Share post (track share count)
router.post("/:postId/share", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const userId = req.userId!

    let userObjectId: ObjectId
    let postObjectId: ObjectId
    try {
      userObjectId = new ObjectId(userId)
      postObjectId = new ObjectId(postId)
    } catch (err: any) {
      console.error('[SHARE] ObjectId conversion error:', err)
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      })
    }

    const db = await getDatabase()
    const sharesCollection = db.collection('shares')

    const existingShare = await sharesCollection.findOne({
      user_id: userObjectId,
      post_id: postObjectId
    })

    if (existingShare) {
      return res.json({
        success: true,
        message: "Post already shared",
        shared: true
      })
    }

    await sharesCollection.insertOne({
      user_id: userObjectId,
      post_id: postObjectId,
      created_at: new Date()
    })

    const shareCount = await sharesCollection.countDocuments({ post_id: postObjectId })

    res.json({
      success: true,
      message: "Post shared successfully",
      shared: true,
      shareCount
    })
  } catch (error: any) {
    console.error('Share error:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Bookmark post (toggle behavior)
router.post("/:postId/bookmark", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const userId = req.userId!

    const db = await getDatabase()
    const bookmarksCollection = db.collection('bookmarks')

    console.log('[Bookmark] userId:', userId, 'postId:', postId)

    // Convert to ObjectId
    let userObjectId: any
    let postObjectId: any
    try {
      userObjectId = new ObjectId(userId)
      postObjectId = new ObjectId(postId)
      console.log('[Bookmark] Converted - userObjectId:', userObjectId.toString(), 'postObjectId:', postObjectId.toString())
    } catch (err) {
      console.error('[Bookmark] ObjectId conversion error:', err)
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      })
    }

    // Check if already bookmarked
    const existingBookmark = await bookmarksCollection.findOne({
      user_id: userObjectId,
      post_id: postObjectId
    })

    console.log('[Bookmark] Existing bookmark:', existingBookmark ? 'Found' : 'Not found')

    let isBookmarked: boolean

    if (existingBookmark) {
      // Remove bookmark
      await bookmarksCollection.deleteOne({
        user_id: userObjectId,
        post_id: postObjectId
      })
      isBookmarked = false
      console.log('[Bookmark] Removed bookmark')
    } else {
      // Add bookmark
      const result = await bookmarksCollection.insertOne({
        user_id: userObjectId,
        post_id: postObjectId,
        created_at: new Date()
      })
      isBookmarked = true
      console.log('[Bookmark] Added bookmark, insertedId:', result.insertedId)
    }

    // Get updated bookmark count
    const bookmarkCount = await bookmarksCollection.countDocuments({ post_id: postObjectId })

    console.log('[Bookmark] Total bookmarks for this post:', bookmarkCount)

    res.json({
      success: true,
      bookmarked: isBookmarked,
      bookmarkCount,
      message: isBookmarked ? "Post bookmarked successfully" : "Post removed from bookmarks"
    })
  } catch (error: any) {
    console.error('[Bookmark] Error:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Check if post is bookmarked
router.get("/:postId/bookmark", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const userId = req.userId

    let userObjectId: ObjectId | null = null
    let postObjectId: ObjectId
    try {
      postObjectId = new ObjectId(postId)
      if (userId) {
        userObjectId = new ObjectId(userId)
      }
    } catch (err: any) {
      console.error('[BOOKMARK CHECK] ObjectId conversion error:', err)
      return res.json({
        success: true,
        bookmarked: false,
        bookmarkCount: 0
      })
    }

    const db = await getDatabase()
    const bookmarksCollection = db.collection('bookmarks')

    let isBookmarked = false
    let bookmarkCount = 0

    if (userObjectId) {
      const bookmark = await bookmarksCollection.findOne({
        user_id: userObjectId,
        post_id: postObjectId
      })
      isBookmarked = !!bookmark
    }

    bookmarkCount = await bookmarksCollection.countDocuments({ post_id: postObjectId })

    res.json({
      success: true,
      bookmarked: isBookmarked,
      bookmarkCount
    })
  } catch (error: any) {
    console.error('Check bookmark error:', error)
    res.json({
      success: true,
      bookmarked: false,
      bookmarkCount: 0
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
router.post("/:postId/comments", authenticateToken, validateAgeAndContent, validateBody(createCommentSchema), async (req, res) => {
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

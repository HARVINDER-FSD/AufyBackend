import { Router, Request, Response } from "express"
import { ReelService } from "../services/reel"
import { CommentService } from "../services/comment"
import { authenticateToken, optionalAuth } from "../middleware/auth"
import { validateAgeAndContent } from "../middleware/content-filter"

const router = Router()

// Get reels feed (discover)
router.get("/", optionalAuth, async (req: any, res: Response) => {
  try {
    const { page, limit, username } = req.query

    // If username is provided, get that user's reels
    if (username) {
      console.log('[Reels Route] Getting reels for username:', username)

      // First, find the user by username
      const { MongoClient } = require('mongodb')
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'
      const client = new MongoClient(MONGODB_URI)
      await client.connect()
      const db = client.db()

      const user = await db.collection('users').findOne({ username })
      await client.close()

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      console.log('[Reels Route] Found user:', user.username, 'ID:', user._id.toString())

      // Get reels for this specific user
      const currentUserId = req.userId || req.user?._id?.toString() || req.user?.id
      const result = await ReelService.getUserReels(
        user._id.toString(),
        currentUserId,
        Number.parseInt(page as string) || 1,
        Number.parseInt(limit as string) || 20,
      )

      console.log('[Reels Route] Returning', result.data.length, 'reels for user', username)
      return res.json(result)
    }

    // Use req.userId which is set by optionalAuth middleware
    const currentUserId = req.userId || req.user?._id?.toString() || req.user?.id

    console.log('[Reels Route] Auth debug:', {
      hasToken: !!req.headers.authorization,
      userId: req.userId,
      userIdFromUser: req.user?._id?.toString(),
      finalUserId: currentUserId
    })

    const result = await ReelService.getReelsFeed(
      currentUserId,
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

// Get user's liked reels
router.get("/liked", authenticateToken, async (req: any, res: Response) => {
  try {
    let userId = req.userId!
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const { getDatabase } = require('../lib/database')
    const { ObjectId } = require('mongodb')
    const db = await getDatabase()

    console.log('[Reels] Raw userId:', userId, 'Type:', typeof userId)

    // Convert to ObjectId if it's a valid hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
    } catch (err) {
      console.log('[Reels] Invalid ObjectId format, trying to find user by ID string')
      try {
        const user = await db.collection('users').findOne({ _id: userId as any })
        if (user) {
          userObjectId = user._id
        } else {
          return res.json({
            success: true,
            reels: [],
            pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
          })
        }
      } catch (findErr) {
        return res.json({
          success: true,
          reels: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
        })
      }
    }

    console.log('[Reels] Converted userId:', userObjectId)

    // Get total count of liked reels
    const total = await db.collection('reel_likes').countDocuments({
      user_id: userObjectId
    })

    // Get liked reels with full details
    const likedReels = await db.collection('reel_likes')
      .aggregate([
        { $match: { user_id: userObjectId } },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'reels',
            localField: 'reel_id',
            foreignField: '_id',
            as: 'reel'
          }
        },
        { $unwind: { path: '$reel', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'reel.user_id',
            foreignField: '_id',
            as: 'author'
          }
        },
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: '$reel._id',
            videoUrl: '$reel.video_url',
            thumbnail: '$reel.thumbnail_url',
            title: '$reel.title',
            description: '$reel.description',
            duration: '$reel.duration',
            createdAt: '$reel.created_at',
            likesCount: '$reel.likes_count',
            viewsCount: '$reel.views_count',
            commentsCount: '$reel.comments_count',
            sharesCount: '$reel.shares_count',
            author: {
              _id: '$author._id',
              username: '$author.username',
              avatar: '$author.avatar'
            }
          }
        },
        { $match: { _id: { $ne: null } } }
      ]).toArray()

    res.json({
      success: true,
      reels: likedReels,
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
    console.error('Error fetching liked reels:', error)
    // Return empty results on error instead of 500
    res.json({
      success: true,
      reels: [],
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

// Get user's reels
router.get("/user/:userId", optionalAuth, async (req: any, res: Response) => {
  try {
    const { userId } = req.params
    const { page, limit } = req.query

    // Use req.userId which is set by optionalAuth middleware
    const currentUserId = req.userId || req.user?._id?.toString() || req.user?.id

    const result = await ReelService.getUserReels(
      userId,
      currentUserId,
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

// Create reel
router.post("/", authenticateToken, validateAgeAndContent, async (req: any, res: Response) => {
  try {
    const { video_url, thumbnail_url, title, description, duration } = req.body

    const reel = await ReelService.createReel(req.userId!, {
      video_url,
      thumbnail_url,
      title,
      description,
      duration,
    })

    res.status(201).json({
      success: true,
      data: { reel },
      message: "Reel created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get reel by ID
router.get("/:reelId", optionalAuth, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    const reel = await ReelService.getReelById(reelId, req.user?.userId)

    res.json({
      success: true,
      data: { reel },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete reel
router.delete("/:reelId", authenticateToken, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    await ReelService.deleteReel(reelId, req.userId!)

    res.json({
      success: true,
      message: "Reel deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Toggle like reel (like/unlike)
router.post("/:reelId/like", authenticateToken, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    // Check if already liked, then toggle
    const result = await ReelService.toggleLikeReel(req.userId!, reelId)

    res.json({
      success: true,
      liked: result.liked,
      likes: result.likes,
      message: result.liked ? "Reel liked successfully" : "Reel unliked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Unlike reel (legacy endpoint)
router.delete("/:reelId/like", authenticateToken, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    await ReelService.unlikeReel(req.userId!, reelId)

    res.json({
      success: true,
      message: "Reel unliked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Share reel (track share count)
router.post("/:reelId/share", authenticateToken, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    await ReelService.incrementShareCount(reelId)

    res.json({
      success: true,
      message: "Share tracked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get reel likes
router.get("/:reelId/likes", optionalAuth, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    const { page, limit } = req.query

    const result = await ReelService.getReelLikes(
      reelId,
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

// Get reel comments
router.get("/:reelId/comments", optionalAuth, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    const { page, limit, sort } = req.query

    const result = await CommentService.getPostComments(
      reelId,
      Number.parseInt(page as string) || 1,
      Number.parseInt(limit as string) || 20,
      (sort as "newest" | "oldest") || "newest",
    )

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Create reel comment
router.post("/:reelId/comments", authenticateToken, async (req: any, res: Response) => {
  try {
    const { reelId } = req.params
    const { content, parent_comment_id } = req.body

    const comment = await CommentService.createComment(req.userId!, reelId, {
      content,
      parent_comment_id,
    })

    res.status(201).json({
      success: true,
      data: { comment },
      message: "Comment created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router

import { Router, Request } from "express"
import { PostService } from "../services/post"
import { ReelService } from "../services/reel"
import { authenticateToken } from "../middleware/auth"
import { getDatabase } from "../lib/database"

// Extend Express Request type
interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

const router = Router()

// Get trending posts
router.get("/trending", async (req, res) => {
  try {
    const { category = 'all', limit = 20 } = req.query
    const limitNum = Number.parseInt(limit as string) || 20

    const db = await getDatabase()

    // Get recent posts with most likes
    const posts = await db.collection('posts')
      .aggregate([
        {
          $match: {
            created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        },
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'post_id',
            as: 'likes'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'post_id',
            as: 'comments'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
        },
        {
          $addFields: {
            likes_count: { $size: '$likes' },
            comments_count: { $size: '$comments' },
            engagement_score: {
              $add: [
                { $multiply: [{ $size: '$likes' }, 2] },
                { $size: '$comments' }
              ]
            }
          }
        },
        {
          $sort: { engagement_score: -1, created_at: -1 }
        },
        {
          $limit: limitNum
        },
        {
          $project: {
            likes: 0,
            comments: 0,
            engagement_score: 0
          }
        }
      ])
      .toArray()

    // Get trending reels
    const reels = await db.collection('reels')
      .aggregate([
        {
          $match: {
            is_archived: { $ne: true },
            created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
        },
        {
          $addFields: {
            engagement_score: {
              $add: [
                { $ifNull: ['$view_count', 0] },
                { $multiply: [{ $ifNull: ['$likes_count', 0] }, 3] }
              ]
            }
          }
        },
        {
          $sort: { engagement_score: -1, created_at: -1 }
        },
        {
          $limit: Math.floor(limitNum / 2) // Half for reels
        },
        {
          $project: {
            engagement_score: 0
          }
        }
      ])
      .toArray()

    res.json({
      success: true,
      data: {
        posts,
        reels
      }
    })
  } catch (error: any) {
    console.error('Error fetching trending content:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trending content'
    })
  }
})

// Get suggested users
router.get("/suggested-users", async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const limitNum = Number.parseInt(limit as string) || 10

    const db = await getDatabase()

    // Get users with most followers (simple suggestion algorithm)
    const users = await db.collection('users')
      .aggregate([
        {
          $lookup: {
            from: 'follows',
            localField: '_id',
            foreignField: 'following_id',
            as: 'followers'
          }
        },
        {
          $addFields: {
            followers_count: { $size: '$followers' }
          }
        },
        {
          $match: {
            followers_count: { $gt: 0 }
          }
        },
        { $sort: { followers_count: -1 } },
        { $limit: limitNum },
        {
          $project: {
            followers: 0,
            password: 0,
            email: 0
          }
        }
      ])
      .toArray()

    res.json({
      success: true,
      data: {
        users
      }
    })
  } catch (error: any) {
    console.error('Error fetching suggested users:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suggested users',
      data: { users: [] }
    })
  }
})

// Get explore feed
router.get("/feed", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { page, limit } = req.query

    const result = await ReelService.getReelsFeed(
      req.user?.userId,
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

export default router

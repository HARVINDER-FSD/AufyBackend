import { Router } from "express"
import { authenticateToken } from "../middleware/auth"
import { getDatabase } from "../lib/database"
import { ObjectId } from "mongodb"

const router = Router()

// Get user's comments
router.get("/my-comments", authenticateToken, async (req: any, res) => {
  try {
    let userId = req.userId!
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const db = await getDatabase()

    console.log('[Comments] Raw userId:', userId, 'Type:', typeof userId)

    // Convert to ObjectId if it's a valid hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
    } catch (err) {
      console.log('[Comments] Invalid ObjectId format, trying to find user by ID string')
      try {
        const user = await db.collection('users').findOne({ _id: userId as any })
        if (user) {
          userObjectId = user._id
        } else {
          return res.json({
            success: true,
            comments: [],
            pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
          })
        }
      } catch (findErr) {
        return res.json({
          success: true,
          comments: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
        })
      }
    }

    console.log('[Comments] Converted userId:', userObjectId)

    // Get total count of user's comments
    const total = await db.collection('comments').countDocuments({
      user_id: userObjectId
    })

    // Get user's comments with post/reel details
    const comments = await db.collection('comments')
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
        {
          $lookup: {
            from: 'reels',
            localField: 'post_id',
            foreignField: '_id',
            as: 'reel'
          }
        },
        {
          $project: {
            _id: 1,
            text: '$content',
            postId: '$post_id',
            postTitle: {
              $cond: [
                { $gt: [{ $size: '$post' }, 0] },
                { $substr: [{ $arrayElemAt: ['$post.content', 0] }, 0, 50] },
                { $cond: [
                  { $gt: [{ $size: '$reel' }, 0] },
                  { $arrayElemAt: ['$reel.title', 0] },
                  'Post'
                ]}
              ]
            },
            createdAt: '$created_at',
            likesCount: { $ifNull: ['$likes_count', 0] }
          }
        }
      ]).toArray()

    res.json({
      success: true,
      comments,
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
    console.error('Error fetching user comments:', error)
    // Return empty results on error instead of 500
    res.json({
      success: true,
      comments: [],
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

// Delete comment
router.delete("/:commentId", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId!
    const { commentId } = req.params

    const db = await getDatabase()

    // Check if comment belongs to user
    const comment = await db.collection('comments').findOne({
      _id: new ObjectId(commentId),
      user_id: new ObjectId(userId)
    })

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or you do not have permission to delete it'
      })
    }

    // Delete the comment
    await db.collection('comments').deleteOne({
      _id: new ObjectId(commentId)
    })

    // Decrement comment count on post/reel
    if (comment.post_id) {
      await db.collection('posts').updateOne(
        { _id: new ObjectId(comment.post_id) },
        { $inc: { comments_count: -1 } }
      )

      await db.collection('reels').updateOne(
        { _id: new ObjectId(comment.post_id) },
        { $inc: { comments_count: -1 } }
      )
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting comment:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router

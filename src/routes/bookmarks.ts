import { Router } from "express"
import { authenticateToken } from "../middleware/auth"

const router = Router()

import { ObjectId } from "mongodb"
import { getDatabase } from "../lib/database"

// Get user bookmarks
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const db = await getDatabase()

    const total = await db.collection('bookmarks').countDocuments({ userId: new ObjectId(userId) })
    const bookmarks = await db.collection('bookmarks')
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'posts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' }
      ]).toArray()

    res.json({
      success: true,
      data: {
        bookmarks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Add bookmark
router.post("/:postId", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId
    const { postId } = req.params

    const db = await getDatabase()

    // Check if post exists
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) })
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" })
    }

    // Check if already bookmarked
    const existing = await db.collection('bookmarks').findOne({
      userId: new ObjectId(userId),
      postId: new ObjectId(postId)
    })

    if (existing) {
      return res.json({ success: true, message: "Already bookmarked" })
    }

    await db.collection('bookmarks').insertOne({
      userId: new ObjectId(userId),
      postId: new ObjectId(postId),
      createdAt: new Date()
    })

    res.json({
      success: true,
      message: "Post bookmarked successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Remove bookmark
router.delete("/:postId", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId
    const { postId } = req.params

    const db = await getDatabase()
    await db.collection('bookmarks').deleteOne({
      userId: new ObjectId(userId),
      postId: new ObjectId(postId)
    })

    res.json({
      success: true,
      message: "Bookmark removed successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})


export default router

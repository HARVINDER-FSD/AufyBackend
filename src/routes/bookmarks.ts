import { Router } from "express"
import { authenticateToken } from "../middleware/auth"

const router = Router()

import { ObjectId } from "mongodb"
import { getDatabase } from "../lib/database"

// Get user bookmarks
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId as string
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    if (!ObjectId.isValid(userId)) {
      console.error('[Bookmarks] Invalid userId for bookmarks:', userId)
      return res.json({
        success: true,
        data: {
          bookmarks: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      })
    }

    const db = await getDatabase()
    const userObjectId = new ObjectId(userId)

    const total = await db.collection('bookmarks').countDocuments({ userId: userObjectId })
    const bookmarks = await db.collection('bookmarks')
      .aggregate([
        { $match: { userId: userObjectId } },
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

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(postId)) {
      console.error('[Bookmarks] Invalid ID format for add bookmark:', { userId, postId })
      return res.status(400).json({
        success: false,
        error: "Invalid ID format"
      })
    }

    const userObjectId = new ObjectId(userId)
    const postObjectId = new ObjectId(postId)

    const db = await getDatabase()

    const post = await db.collection('posts').findOne({ _id: postObjectId })
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" })
    }

    const existing = await db.collection('bookmarks').findOne({
      userId: userObjectId,
      postId: postObjectId
    })

    if (existing) {
      return res.json({ success: true, message: "Already bookmarked" })
    }

    await db.collection('bookmarks').insertOne({
      userId: userObjectId,
      postId: postObjectId,
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

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(postId)) {
      console.error('[Bookmarks] Invalid ID format for remove bookmark:', { userId, postId })
      return res.status(400).json({
        success: false,
        error: "Invalid ID format"
      })
    }

    const userObjectId = new ObjectId(userId)
    const postObjectId = new ObjectId(postId)

    const db = await getDatabase()
    await db.collection('bookmarks').deleteOne({
      userId: userObjectId,
      postId: postObjectId
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

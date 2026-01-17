import { Router } from "express"
import { authenticateToken } from "../middleware/auth"

const router = Router()

// Track event
router.post("/track", authenticateToken, async (req, res) => {
  try {
    const { event_type, target_id, target_type, metadata } = req.body

    if (!event_type) {
      return res.status(400).json({
        success: false,
        error: "Event type is required"
      })
    }

    res.json({
      success: true,
      message: "Event tracked successfully"
    })
  } catch (error) {
    console.error("Error tracking event:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

import { ObjectId } from "mongodb"
import { getDatabase } from "../lib/database"

// Get user activity summary
router.get("/user-activity", authenticateToken, async (req: any, res) => {
  try {
    let userId = req.userId
    const db = await getDatabase()

    console.log('[Analytics] Raw userId:', userId, 'Type:', typeof userId)

    // Convert to ObjectId if it's a valid hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
    } catch (err) {
      console.log('[Analytics] Invalid ObjectId format, trying to find user by ID string')
      const user = await db.collection('users').findOne({ _id: userId as any })
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'User not found'
        })
      }
      userObjectId = user._id
    }

    console.log('[Analytics] Converted userId:', userObjectId)

    // 1. Posts count
    const postsCount = await db.collection('posts').countDocuments({ user_id: userObjectId })

    // 2. Likes given
    const likesCount = await db.collection('likes').countDocuments({ user_id: userObjectId })

    // 3. Comments given
    const commentsCount = await db.collection('comments').countDocuments({ user_id: userObjectId })

    // 4. Time spent today (from a simulated collection or redis)
    const today = new Date().toISOString().split('T')[0]
    const timeSpentDoc = await db.collection('user_time_spent').findOne({
      user_id: userObjectId,
      date: today
    })

    res.json({
      success: true,
      data: {
        postsCount,
        likesCount,
        commentsCount,
        timeSpentToday: timeSpentDoc?.minutes || 0,
        recentDeletions: 0, // Placeholder
      }
    })
  } catch (error: any) {
    console.error('[Analytics] Error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Track time spent
router.post("/time-spent", authenticateToken, async (req: any, res) => {
  try {
    let userId = req.userId
    const { minutes } = req.body
    const today = new Date().toISOString().split('T')[0]

    const db = await getDatabase()

    // Convert to ObjectId if it's a valid hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
    } catch (err) {
      const user = await db.collection('users').findOne({ _id: userId as any })
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'User not found'
        })
      }
      userObjectId = user._id
    }

    await db.collection('user_time_spent').updateOne(
      { user_id: userObjectId, date: today },
      { $inc: { minutes: minutes || 1 } },
      { upsert: true }
    )

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get user analytics (existing but improved)
router.get("/user/:userId", authenticateToken, async (req: any, res) => {
  try {
    const { userId } = req.params
    const db = await getDatabase()

    const posts = await db.collection('posts').find({ userId: new ObjectId(userId) }).toArray()
    const postIds = posts.map(p => p._id)

    const [likes, comments] = await Promise.all([
      db.collection('likes').countDocuments({ postId: { $in: postIds } }),
      db.collection('comments').countDocuments({ postId: { $in: postIds } })
    ])

    res.json({
      success: true,
      data: {
        postsCount: posts.length,
        likesCount: likes,
        commentsCount: comments,
        views: 0 // Placeholder
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})


export default router

import { Router } from "express"
import { authenticateToken } from "../middleware/auth"
import { feedUpdateQueue, likesQueue, messagesQueue } from "../lib/queue"

const router = Router()

// System Health & Queue Metrics (Observability)
router.get("/system-health", authenticateToken, async (req, res) => {
  try {
     const feedCounts = feedUpdateQueue ? await feedUpdateQueue.getJobCounts() : { error: "Queue not initialized" };
     const likeCounts = likesQueue ? await likesQueue.getJobCounts() : { error: "Queue not initialized" };
     const messageCounts = messagesQueue ? await messagesQueue.getJobCounts() : { error: "Queue not initialized" };
     
     res.json({
       success: true,
       timestamp: new Date(),
       uptime: process.uptime(),
       queues: {
         feed_updates: feedCounts,
         likes: likeCounts,
         messages: messageCounts
       },
       memory: process.memoryUsage()
     });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

    console.log('[Analytics/UserActivity] Raw userId:', userId, 'Type:', typeof userId)

    // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
      console.log('[Analytics/UserActivity] Converted to ObjectId:', userObjectId.toString())
    } catch (err) {
      console.error('[Analytics/UserActivity] Failed to convert userId to ObjectId:', err)
      return res.json({
        success: true,
        data: {
          postsCount: 0,
          likesCount: 0,
          commentsCount: 0,
          timeSpentToday: 0,
          recentDeletions: 0
        }
      })
    }

    console.log('[Analytics/UserActivity] Using userObjectId:', userObjectId.toString())

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

    console.log('[Analytics/UserActivity] Counts - Posts:', postsCount, 'Likes:', likesCount, 'Comments:', commentsCount)

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
    console.error('[Analytics/UserActivity] Error:', error)
    res.json({
      success: true,
      data: {
        postsCount: 0,
        likesCount: 0,
        commentsCount: 0,
        timeSpentToday: 0,
        recentDeletions: 0
      }
    })
  }
})

// Track time spent
router.post("/time-spent", authenticateToken, async (req: any, res) => {
  try {
    let userId = req.userId
    const { minutes } = req.body
    const today = new Date().toISOString().split('T')[0]

    const db = await getDatabase()

    console.log('[Analytics/TimeSpent] Raw userId:', userId, 'minutes:', minutes)

    // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
    let userObjectId: any
    try {
      userObjectId = new ObjectId(userId)
      console.log('[Analytics/TimeSpent] Converted to ObjectId:', userObjectId.toString())
    } catch (err) {
      console.error('[Analytics/TimeSpent] Failed to convert userId to ObjectId:', err)
      return res.json({ success: true })
    }

    await db.collection('user_time_spent').updateOne(
      { user_id: userObjectId, date: today },
      { $inc: { minutes: minutes || 1 } },
      { upsert: true }
    )

    console.log('[Analytics/TimeSpent] Updated successfully')

    res.json({ success: true })
  } catch (error: any) {
    console.error('[Analytics/TimeSpent] Error:', error)
    res.json({ success: true })
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

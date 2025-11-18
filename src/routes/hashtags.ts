import { Router } from "express"
import { getDatabase } from "../lib/database"

const router = Router()

// Get trending hashtags
router.get("/trending", async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const limitNum = Number.parseInt(limit as string) || 10

    const db = await getDatabase()
    
    // Aggregate hashtags from posts
    const hashtags = await db.collection('posts')
      .aggregate([
        {
          $match: {
            hashtags: { $exists: true, $ne: [] },
            created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        },
        { $unwind: '$hashtags' },
        {
          $group: {
            _id: '$hashtags',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limitNum },
        {
          $project: {
            tag: '$_id',
            count: 1,
            _id: 0
          }
        }
      ])
      .toArray()

    res.json({
      success: true,
      data: hashtags
    })
  } catch (error: any) {
    console.error('Error fetching trending hashtags:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch trending hashtags',
      data: [] // Return empty array on error
    })
  }
})

export default router

import { Router } from "express"
import { PostService } from "../services/post"
import { authenticateToken } from "../middleware/auth"
import { cacheGet, cacheSet, cacheDel } from "../lib/redis"

const router = Router()

// Get anonymous trending feed (creators only)
router.get("/anonymous", authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query
    const pageNum = Number.parseInt(page as string) || 1
    const limitNum = Number.parseInt(limit as string) || 20

    // Delegate to PostService which handles caching internally (raw data + personalized enrichment)
    const result = await PostService.getAnonymousTrendingFeed(
      req.userId!,
      pageNum,
      limitNum
    )

    res.json(result)
  } catch (error: any) {
    console.error('Feed API Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get user's personalized feed
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query
    const pageNum = Number.parseInt(page as string) || 1
    const limitNum = Number.parseInt(limit as string) || 20

    const result = await PostService.getFeedPosts(
      req.userId!,
      pageNum,
      limitNum,
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


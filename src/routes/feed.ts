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

    // No cache for now to ensure freshness during testing
    const result = await PostService.getAnonymousTrendingFeed(
      req.userId!,
      pageNum,
      limitNum
    )

    res.json(result)
  } catch (error: any) {
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

    // Cache for 2 minutes (120 seconds)
    await cacheSet(cacheKey, result, 120)

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router


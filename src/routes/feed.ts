import { Router } from "express"
import { PostService } from "../services/post"
import { authenticateToken } from "../middleware/auth"

const router = Router()

// Get user's personalized feed
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query

    const result = await PostService.getFeedPosts(
      req.userId!,
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


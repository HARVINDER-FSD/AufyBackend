import { Router } from "express"
import { ReelService } from "../services/reel"
import { CommentService } from "../services/comment"
import { authenticateToken, optionalAuth } from "../middleware/auth"

const router = Router()

// Get reels feed (discover)
router.get("/", optionalAuth, async (req, res) => {
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

// Get user's reels
router.get("/user/:userId", optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params
    const { page, limit } = req.query

    const result = await ReelService.getUserReels(
      userId,
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

// Create reel
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { video_url, thumbnail_url, title, description, duration } = req.body

    const reel = await ReelService.createReel(req.userId!, {
      video_url,
      thumbnail_url,
      title,
      description,
      duration,
    })

    res.status(201).json({
      success: true,
      data: { reel },
      message: "Reel created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get reel by ID
router.get("/:reelId", optionalAuth, async (req, res) => {
  try {
    const { reelId } = req.params
    const reel = await ReelService.getReelById(reelId, req.user?.userId)

    res.json({
      success: true,
      data: { reel },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete reel
router.delete("/:reelId", authenticateToken, async (req, res) => {
  try {
    const { reelId } = req.params
    await ReelService.deleteReel(reelId, req.userId!)

    res.json({
      success: true,
      message: "Reel deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Like reel
router.post("/:reelId/like", authenticateToken, async (req, res) => {
  try {
    const { reelId } = req.params
    await ReelService.likeReel(req.userId!, reelId)

    res.json({
      success: true,
      message: "Reel liked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Unlike reel
router.delete("/:reelId/like", authenticateToken, async (req, res) => {
  try {
    const { reelId } = req.params
    await ReelService.unlikeReel(req.userId!, reelId)

    res.json({
      success: true,
      message: "Reel unliked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get reel likes
router.get("/:reelId/likes", optionalAuth, async (req, res) => {
  try {
    const { reelId } = req.params
    const { page, limit } = req.query

    const result = await ReelService.getReelLikes(
      reelId,
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

// Get reel comments
router.get("/:reelId/comments", optionalAuth, async (req, res) => {
  try {
    const { reelId } = req.params
    const { page, limit, sort } = req.query

    const result = await CommentService.getPostComments(
      reelId,
      Number.parseInt(page as string) || 1,
      Number.parseInt(limit as string) || 20,
      (sort as "newest" | "oldest") || "newest",
    )

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Create reel comment
router.post("/:reelId/comments", authenticateToken, async (req, res) => {
  try {
    const { reelId } = req.params
    const { content, parent_comment_id } = req.body

    const comment = await CommentService.createComment(req.userId!, reelId, {
      content,
      parent_comment_id,
    })

    res.status(201).json({
      success: true,
      data: { comment },
      message: "Comment created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router

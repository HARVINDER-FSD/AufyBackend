import { Router } from "express"
import { PostService } from "../services/post"
import { CommentService } from "../services/comment"
import { authenticateToken, optionalAuth } from "../middleware/auth"

const router = Router()

// Get user feed
router.get("/feed", authenticateToken, async (req, res) => {
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

// Create post
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { content, media_urls, media_type, location } = req.body

    // Use req.userId instead of req.user.userId
    const post = await PostService.createPost(req.userId!, {
      content,
      media_urls,
      media_type,
      location,
    })

    res.status(201).json({
      success: true,
      data: { post },
      message: "Post created successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get post by ID
router.get("/:postId", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const post = await PostService.getPostById(postId, req.user?.userId)

    res.json({
      success: true,
      data: { post },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Update post
router.put("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const updates = req.body

    const post = await PostService.updatePost(postId, req.userId!, updates)

    res.json({
      success: true,
      data: { post },
      message: "Post updated successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete post
router.delete("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    await PostService.deletePost(postId, req.userId!)

    res.json({
      success: true,
      message: "Post deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Like post
router.post("/:postId/like", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    await PostService.likePost(req.userId!, postId)

    res.json({
      success: true,
      message: "Post liked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Unlike post
router.delete("/:postId/like", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    await PostService.unlikePost(req.userId!, postId)

    res.json({
      success: true,
      message: "Post unliked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get post likes
router.get("/:postId/likes", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const { page, limit } = req.query

    const result = await PostService.getPostLikes(
      postId,
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

// Get post comments
router.get("/:postId/comments", optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params
    const { page, limit, sort } = req.query

    const result = await CommentService.getPostComments(
      postId,
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

// Create comment
router.post("/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params
    const { content, parent_comment_id } = req.body

    const comment = await CommentService.createComment(req.userId!, postId, {
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

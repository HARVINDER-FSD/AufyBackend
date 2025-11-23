import { Router, Request, Response } from "express"
import { connectToDatabase } from "../lib/database"
import Story from "../models/story"
import { authenticateToken, optionalAuth } from "../middleware/auth"
import mongoose from "mongoose"

const router = Router()

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: any
  userId?: string
}

// Get stories feed - optional auth
router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    // Get active stories (not expired)
    const stories = await Story.find({
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .sort({ created_at: -1 })
      .limit(50)
      .lean()

    // Format stories for frontend (filter out stories with deleted users)
    const formattedStories = stories
      .filter((story: any) => story.user_id) // Only include stories with valid users
      .map((story: any) => ({
        id: story._id.toString(),
        user_id: story.user_id._id.toString(),
        username: story.user_id.username,
        full_name: story.user_id.full_name,
        avatar_url: story.user_id.avatar_url,
        is_verified: story.user_id.is_verified,
        media_url: story.media_url,
        media_type: story.media_type,
        caption: story.caption,
        created_at: story.created_at,
        expires_at: story.expires_at,
        texts: story.texts || [],
        stickers: story.stickers || [],
        filter: story.filter || 'none',
        music: story.music || null,
        views_count: story.views_count || 0
      }))

    res.json({
      success: true,
      data: formattedStories
    })
  } catch (error: any) {
    console.error('Error fetching stories:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stories'
    })
  }
})

// Create story
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const { media_url, media_type, caption, texts, stickers, filter, music } = req.body
    const userId = req.userId!

    if (!media_url || !media_type) {
      return res.status(400).json({
        success: false,
        error: 'Media URL and type are required'
      })
    }

    const story = await Story.create({
      user_id: new mongoose.Types.ObjectId(userId),
      media_url,
      media_type,
      caption: caption || null,
      texts: texts || [],
      stickers: stickers || [],
      filter: filter || 'none',
      music: music || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    })

    const populatedStory = await Story.findById(story._id)
      .populate('user_id', 'username full_name avatar_url is_verified')
      .lean()

    res.status(201).json({
      success: true,
      data: { story: populatedStory },
      message: "Story created successfully"
    })
  } catch (error: any) {
    console.error('Error creating story:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create story'
    })
  }
})

// Get user stories
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    await connectToDatabase()

    const { userId } = req.params

    const stories = await Story.find({
      user_id: new mongoose.Types.ObjectId(userId),
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .sort({ created_at: -1 })
      .lean()

    res.json({
      success: true,
      data: { stories }
    })
  } catch (error: any) {
    console.error('Error fetching user stories:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user stories'
    })
  }
})

// Delete story
router.delete("/:storyId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const { storyId } = req.params
    const userId = req.userId!

    const story = await Story.findById(storyId)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    if (story.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own stories'
      })
    }

    await Story.findByIdAndUpdate(storyId, { is_deleted: true })

    res.json({
      success: true,
      message: "Story deleted successfully"
    })
  } catch (error: any) {
    console.error('Error deleting story:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete story'
    })
  }
})

// View story
router.post("/:storyId/view", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const { storyId } = req.params
    const userId = req.userId!

    const story = await Story.findById(storyId)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    // Import StoryView model
    const StoryView = (await import('../models/story-view')).default

    // Create or update view record (upsert)
    await StoryView.findOneAndUpdate(
      { story_id: new mongoose.Types.ObjectId(storyId), viewer_id: new mongoose.Types.ObjectId(userId) },
      { viewed_at: new Date() },
      { upsert: true, new: true }
    )

    // Update view count
    const viewCount = await StoryView.countDocuments({ story_id: new mongoose.Types.ObjectId(storyId) })
    await Story.findByIdAndUpdate(storyId, { views_count: viewCount })

    res.json({
      success: true,
      message: "Story viewed",
      views_count: viewCount
    })
  } catch (error: any) {
    console.error('Error viewing story:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to view story'
    })
  }
})

// Get story viewers (detailed list)
router.get("/:storyId/viewers", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const { storyId } = req.params
    const userId = req.userId!

    const story = await Story.findById(storyId)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    if (story.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own story viewers'
      })
    }

    // Import StoryView model
    const StoryView = (await import('../models/story-view')).default

    // Get all viewers with user details
    const viewers = await StoryView.find({ story_id: new mongoose.Types.ObjectId(storyId) })
      .populate('viewer_id', 'username full_name avatar_url is_verified')
      .sort({ viewed_at: -1 })
      .lean()

    const formattedViewers = viewers
      .filter((view: any) => view.viewer_id) // Filter out deleted users
      .map((view: any) => ({
        id: view.viewer_id._id.toString(),
        username: view.viewer_id.username,
        full_name: view.viewer_id.full_name,
        avatar_url: view.viewer_id.avatar_url,
        is_verified: view.viewer_id.is_verified || false,
        viewed_at: view.viewed_at
      }))

    res.json({
      success: true,
      data: {
        viewers: formattedViewers,
        total_views: formattedViewers.length
      }
    })
  } catch (error: any) {
    console.error('Error fetching story viewers:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch story viewers'
    })
  }
})

// Get story views count (backward compatibility)
router.get("/:storyId/views", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const { storyId } = req.params
    const userId = req.userId!

    const story = await Story.findById(storyId)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    if (story.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own story views'
      })
    }

    res.json({
      success: true,
      data: {
        views: story.views_count || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching story views:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch story views'
    })
  }
})

export default router

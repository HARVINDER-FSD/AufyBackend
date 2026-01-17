import { Router, Request, Response } from "express"
import { connectToDatabase } from "../lib/database"
import StoryModel from "../models/story"
import { authenticateToken, optionalAuth } from "../middleware/auth"
import mongoose, { Model } from "mongoose"
import { validateAgeAndContent } from "../middleware/content-filter"

// Type the Story model properly
const Story = StoryModel as Model<any>

const router = Router()

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: any
  userId?: string
}

// Get stories feed - with privacy filtering
router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await connectToDatabase()

    const currentUserId = req.userId

    // Get following list if user is authenticated
    let followingIds: any[] = []
    if (currentUserId) {
      const { MongoClient, ObjectId } = require('mongodb')
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'
      const client = await MongoClient.connect(MONGODB_URI)
      const db = client.db()

      const follows = await db.collection('follows').find({
        followerId: new ObjectId(currentUserId)
      }).toArray()

      followingIds = follows.map((f: any) => f.followingId.toString())
      await client.close()
    }

    // Get active stories (not expired)
    const stories = await Story.find({
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified is_private')
      .sort({ created_at: -1 })
      .limit(50)
      .lean()

    // Apply privacy filter - STRICT MODE (only following + own)
    const filteredStories = stories.filter((story: any) => {
      if (!story.user_id) return false

      const storyUserId = story.user_id._id.toString()

      // Always show own stories
      if (currentUserId && storyUserId === currentUserId) return true

      // Show ONLY if following the user (Instagram behavior)
      if (followingIds.includes(storyUserId)) return true

      // Hide all other stories (including public accounts)
      return false
    })

    // Format stories for frontend
    const formattedStories = filteredStories.map((story: any) => ({
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
router.post("/", authenticateToken, validateAgeAndContent, async (req: AuthRequest, res: Response) => {
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

// Get single story by ID
router.get("/:storyId", optionalAuth, async (req: Request, res: Response) => {
  try {
    await connectToDatabase()

    const { storyId } = req.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    const story: any = await Story.findOne({
      _id: new mongoose.Types.ObjectId(storyId),
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .lean()

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found or has expired'
      })
    }

    // Format story for frontend
    const formattedStory = {
      id: story._id.toString(),
      user_id: story.user_id._id.toString(),
      username: story.user_id.username,
      full_name: story.user_id.full_name,
      avatar_url: story.user_id.avatar_url,
      is_verified: story.user_id.is_verified || false,
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
    }

    res.json({
      success: true,
      data: formattedStory
    })
  } catch (error: any) {
    console.error('Error fetching story:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch story'
    })
  }
})

// Get user stories (active only)
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

// Get ALL user stories (including expired) - for creating memories
router.get("/user/:userId/all", async (req: Request, res: Response) => {
  try {
    await connectToDatabase()

    const { userId } = req.params

    // Get ALL stories (including expired), sorted by newest first
    const stories = await Story.find({
      user_id: new mongoose.Types.ObjectId(userId),
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .sort({ created_at: -1 })
      .lean()

    res.json({
      success: true,
      data: {
        stories,
        total: stories.length
      }
    })
  } catch (error: any) {
    console.error('Error fetching all user stories:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch all user stories'
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

    const story: any = await Story.findById(storyId)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      })
    }

    // Don't count view if viewer is the story owner
    if (story.user_id.toString() === userId) {
      return res.json({
        success: true,
        message: "Own story - view not counted",
        views_count: story.views_count || 0
      })
    }

    // Import StoryView model
    const StoryView: any = (await import('../models/story-view')).default

    // Create or update view record (upsert)
    await StoryView.findOneAndUpdate(
      { story_id: new mongoose.Types.ObjectId(storyId), viewer_id: new mongoose.Types.ObjectId(userId) },
      { viewed_at: new Date() },
      { upsert: true, new: true }
    )

    // Update view count (excluding owner)
    const viewCount = await StoryView.countDocuments({
      story_id: new mongoose.Types.ObjectId(storyId),
      viewer_id: { $ne: new mongoose.Types.ObjectId(story.user_id) }
    })
    await (Story as any).findByIdAndUpdate(storyId, { views_count: viewCount })

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
    const StoryView: any = (await import('../models/story-view')).default

    // Get all viewers with user details
    const viewers: any[] = await StoryView.find({ story_id: new mongoose.Types.ObjectId(storyId) })
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

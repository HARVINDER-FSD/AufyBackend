import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import Highlight from '../models/highlight'
import Story from '../models/story'
import mongoose from 'mongoose'

const router = Router()

interface AuthRequest extends Request {
  userId?: string
}

// Get user's highlights
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const highlights = await Highlight.find({ user_id: new mongoose.Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .lean()

    res.json({
      success: true,
      data: { highlights }
    })
  } catch (error: any) {
    console.error('Error fetching highlights:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch highlights'
    })
  }
})

// Get highlight details with stories
router.get('/:highlightId', async (req: Request, res: Response) => {
  try {
    const { highlightId } = req.params

    const highlight = await Highlight.findById(highlightId).lean()

    if (!highlight) {
      return res.status(404).json({
        success: false,
        error: 'Highlight not found'
      })
    }

    // Fetch all stories in the highlight
    const storyIds = highlight.stories.map((s: any) => s.story_id)
    const stories = await (Story as any).find({ _id: { $in: storyIds } })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .lean()

    // Merge story data with highlight metadata
    const enrichedStories = highlight.stories.map((hs: any) => {
      const story = stories.find((s: any) => s._id.toString() === hs.story_id.toString())
      return {
        ...story,
        is_remix: hs.is_remix,
        original_creator: hs.original_creator,
        added_at: hs.added_at
      }
    })

    res.json({
      success: true,
      data: {
        highlight: {
          ...highlight,
          stories: enrichedStories
        }
      }
    })
  } catch (error: any) {
    console.error('Error fetching highlight:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch highlight'
    })
  }
})

// Create new highlight
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { title, cover_image } = req.body

    if (!title || !cover_image) {
      return res.status(400).json({
        success: false,
        error: 'Title and cover image are required'
      })
    }

    const highlight = await Highlight.create({
      user_id: new mongoose.Types.ObjectId(userId),
      title,
      cover_image,
      stories: []
    })

    res.status(201).json({
      success: true,
      data: { highlight },
      message: 'Highlight created successfully'
    })
  } catch (error: any) {
    console.error('Error creating highlight:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create highlight'
    })
  }
})

// Add story to highlight (with remix support)
router.post('/:highlightId/add-story', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { highlightId } = req.params
    const { story_id, is_remix, original_creator } = req.body

    const highlight = await Highlight.findById(highlightId)

    if (!highlight) {
      return res.status(404).json({
        success: false,
        error: 'Highlight not found'
      })
    }

    // Check ownership
    if (highlight.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only add stories to your own highlights'
      })
    }

    // Check if story already in highlight
    const alreadyExists = highlight.stories.some(
      (s: any) => s.story_id.toString() === story_id
    )

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        error: 'Story already in highlight'
      })
    }

    // Add story
    highlight.stories.push({
      story_id: new mongoose.Types.ObjectId(story_id),
      is_remix: is_remix || false,
      original_creator: original_creator || null,
      added_at: new Date()
    } as any)

    highlight.updated_at = new Date()
    await highlight.save()

    res.json({
      success: true,
      message: 'Story added to highlight',
      data: { highlight }
    })
  } catch (error: any) {
    console.error('Error adding story to highlight:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add story to highlight'
    })
  }
})

// Remove story from highlight
router.delete('/:highlightId/remove-story/:storyId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { highlightId, storyId } = req.params

    const highlight = await Highlight.findById(highlightId)

    if (!highlight) {
      return res.status(404).json({
        success: false,
        error: 'Highlight not found'
      })
    }

    // Check ownership
    if (highlight.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only remove stories from your own highlights'
      })
    }

    const filteredStories = highlight.stories.filter(
      (s: any) => s.story_id.toString() !== storyId
    )
    
    highlight.stories = filteredStories as any
    highlight.updated_at = new Date()
    await highlight.save()

    res.json({
      success: true,
      message: 'Story removed from highlight'
    })
  } catch (error: any) {
    console.error('Error removing story from highlight:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove story from highlight'
    })
  }
})

// Delete highlight
router.delete('/:highlightId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { highlightId } = req.params

    const highlight = await Highlight.findById(highlightId)

    if (!highlight) {
      return res.status(404).json({
        success: false,
        error: 'Highlight not found'
      })
    }

    // Check ownership
    if (highlight.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own highlights'
      })
    }

    await Highlight.findByIdAndDelete(highlightId)

    res.json({
      success: true,
      message: 'Highlight deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting highlight:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete highlight'
    })
  }
})

export default router

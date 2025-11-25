import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import Story from '../models/story'
import CloseFriend from '../models/close-friend'
import mongoose from 'mongoose'

const router = Router()

interface AuthRequest extends Request {
  userId?: string
}

// Get close friends stories only
router.get('/close-friends', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Get user's close friends list
    const closeFriendDoc = await CloseFriend.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    if (!closeFriendDoc || closeFriendDoc.close_friend_ids.length === 0) {
      return res.json({
        success: true,
        data: []
      })
    }

    // Get stories from close friends that are marked as close-friends only
    const stories = await (Story as any).find({
      user_id: { $in: closeFriendDoc.close_friend_ids },
      is_close_friends: true,
      expires_at: { $gt: new Date() },
      is_deleted: false
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .sort({ created_at: -1 })
      .lean()

    const formattedStories = stories
      .filter((story: any) => story.user_id)
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
        views_count: story.views_count || 0,
        is_close_friends: true
      }))

    res.json({
      success: true,
      data: formattedStories
    })
  } catch (error: any) {
    console.error('Error fetching close friends stories:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch close friends stories'
    })
  }
})

// Create remixed story for highlight
router.post('/:storyId/remix', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { storyId } = req.params
    const { texts, stickers, filter } = req.body

    // Get original story
    const originalStory = await (Story as any).findById(storyId)
      .populate('user_id', 'username')
      .lean()

    if (!originalStory) {
      return res.status(404).json({
        success: false,
        error: 'Original story not found'
      })
    }

    // Check if user is close friend (can only remix close friends stories)
    const closeFriendDoc = await CloseFriend.findOne({
      user_id: originalStory.user_id._id,
      close_friend_ids: new mongoose.Types.ObjectId(userId)
    })

    if (!closeFriendDoc && originalStory.user_id._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only remix stories from your close friends'
      })
    }

    // Create remixed story (doesn't expire, for highlights)
    const remixedStory = await (Story as any).create({
      user_id: new mongoose.Types.ObjectId(userId),
      media_url: originalStory.media_url, // Same media (locked)
      media_type: originalStory.media_type,
      caption: null,
      texts: texts || [],
      stickers: stickers || [],
      filter: filter || 'none',
      music: null,
      is_remix: true,
      original_story_id: originalStory._id,
      original_creator_id: originalStory.user_id._id,
      original_creator_username: (originalStory.user_id as any).username,
      remix_changes: {
        texts: texts || [],
        stickers: stickers || [],
        filter: filter || 'none'
      },
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year (for highlights)
      is_deleted: false
    })

    res.status(201).json({
      success: true,
      data: { story: remixedStory },
      message: 'Story remixed successfully'
    })
  } catch (error: any) {
    console.error('Error remixing story:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remix story'
    })
  }
})

export default router

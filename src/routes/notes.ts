import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import Note from '../models/note'
import CloseFriend from '../models/close-friend'
import CrushList from '../models/crush-list'
import mongoose from 'mongoose'

const router = Router()

interface AuthRequest extends Request {
  userId?: string
}

// Get active notes from friends and crush list
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Get user's friends (following)
    const db = mongoose.connection.db
    const followsCollection = db?.collection('follows')
    const follows = await followsCollection?.find({ follower_id: new mongoose.Types.ObjectId(userId) }).toArray()
    const friendIds = follows?.map((f: any) => f.following_id) || []

    // Get crush list
    const crushList = await CrushList.findOne({ user_id: new mongoose.Types.ObjectId(userId) })
    const crushIds = crushList?.crush_ids || []

    // Combine friend and crush IDs
    const visibleUserIds = [...friendIds, ...crushIds]

    // Get active notes from these users
    const notes = await (Note as any).find({
      user_id: { $in: visibleUserIds },
      is_active: true,
      expires_at: { $gt: new Date() },
      hidden_from: { $ne: new mongoose.Types.ObjectId(userId) }
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .populate('reactions.user_id', 'username avatar_url')
      .sort({ created_at: -1 })
      .lean()

    res.json({
      success: true,
      data: { notes }
    })
  } catch (error: any) {
    console.error('Error fetching notes:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notes'
    })
  }
})

// Get user's active note
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const note = await (Note as any).findOne({
      user_id: new mongoose.Types.ObjectId(userId),
      is_active: true,
      expires_at: { $gt: new Date() }
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .populate('reactions.user_id', 'username avatar_url')
      .lean()

    res.json({
      success: true,
      data: { note }
    })
  } catch (error: any) {
    console.error('Error fetching user note:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user note'
    })
  }
})

// Create new note
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const {
      content,
      emoji,
      text_color,
      background_style,
      background_color,
      gradient_colors,
      emotion,
      visibility,
      hidden_from
    } = req.body

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      })
    }

    if (content.length > 60) {
      return res.status(400).json({
        success: false,
        error: 'Content must be 60 characters or less'
      })
    }

    // Deactivate any existing active notes
    await (Note as any).updateMany(
      { user_id: new mongoose.Types.ObjectId(userId), is_active: true },
      { is_active: false }
    )

    // Create new note
    const note = await (Note as any).create({
      user_id: new mongoose.Types.ObjectId(userId),
      content: content.trim(),
      emoji: emoji || null,
      text_color: text_color || '#FFFFFF',
      background_style: background_style || 'solid',
      background_color: background_color || '#6366f1',
      gradient_colors: gradient_colors || null,
      emotion: emotion || 'custom',
      visibility: visibility || 'friends',
      hidden_from: hidden_from || [],
      reactions: [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      is_active: true
    })

    const populatedNote = await (Note as any).findById(note._id)
      .populate('user_id', 'username full_name avatar_url is_verified')
      .lean()

    res.status(201).json({
      success: true,
      data: { note: populatedNote },
      message: 'Note created successfully'
    })
  } catch (error: any) {
    console.error('Error creating note:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create note'
    })
  }
})

// Update note
router.put('/:noteId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { noteId } = req.params
    const updateData = req.body

    const note = await Note.findById(noteId)

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      })
    }

    if (note.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own notes'
      })
    }

    // Update allowed fields
    const allowedFields = [
      'content', 'emoji', 'text_color', 'background_style',
      'background_color', 'gradient_colors', 'emotion',
      'visibility', 'hidden_from'
    ]

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        (note as any)[field] = updateData[field]
      }
    })

    await note.save()

    const populatedNote = await (Note as any).findById(note._id)
      .populate('user_id', 'username full_name avatar_url is_verified')
      .populate('reactions.user_id', 'username avatar_url')
      .lean()

    res.json({
      success: true,
      data: { note: populatedNote },
      message: 'Note updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating note:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update note'
    })
  }
})

// Delete note
router.delete('/:noteId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { noteId } = req.params

    const note = await Note.findById(noteId)

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      })
    }

    if (note.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own notes'
      })
    }

    note.is_active = false
    await note.save()

    res.json({
      success: true,
      message: 'Note deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting note:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete note'
    })
  }
})

// React to note
router.post('/:noteId/react', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { noteId } = req.params
    const { emoji } = req.body

    if (!emoji) {
      return res.status(400).json({
        success: false,
        error: 'Emoji is required'
      })
    }

    const note = await Note.findById(noteId)

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      })
    }

    // Add or update reaction
    await (note as any).addReaction(userId, emoji)

    const populatedNote = await (Note as any).findById(note._id)
      .populate('user_id', 'username full_name avatar_url is_verified')
      .populate('reactions.user_id', 'username avatar_url')
      .lean()

    res.json({
      success: true,
      data: { note: populatedNote },
      message: 'Reaction added successfully'
    })
  } catch (error: any) {
    console.error('Error reacting to note:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to react to note'
    })
  }
})

// Remove reaction from note
router.delete('/:noteId/react', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { noteId } = req.params

    const note = await Note.findById(noteId)

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      })
    }

    await (note as any).removeReaction(userId)

    const populatedNote = await (Note as any).findById(note._id)
      .populate('user_id', 'username full_name avatar_url is_verified')
      .populate('reactions.user_id', 'username avatar_url')
      .lean()

    res.json({
      success: true,
      data: { note: populatedNote },
      message: 'Reaction removed successfully'
    })
  } catch (error: any) {
    console.error('Error removing reaction:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove reaction'
    })
  }
})

export default router

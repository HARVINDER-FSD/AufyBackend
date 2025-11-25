import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import CloseFriend from '../models/close-friend'
import mongoose from 'mongoose'

const router = Router()

interface AuthRequest extends Request {
  userId?: string
}

// Get user's close friends list
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    let closeFriendDoc = await CloseFriend.findOne({ user_id: new mongoose.Types.ObjectId(userId) })
      .populate('close_friend_ids', 'username full_name avatar_url is_verified')

    if (!closeFriendDoc) {
      // Create empty list if doesn't exist
      closeFriendDoc = await CloseFriend.create({
        user_id: new mongoose.Types.ObjectId(userId),
        close_friend_ids: []
      })
    }

    res.json({
      success: true,
      data: {
        close_friends: closeFriendDoc.close_friend_ids || [],
        count: closeFriendDoc.close_friend_ids?.length || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching close friends:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch close friends'
    })
  }
})

// Add user to close friends
router.post('/add/:friendId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { friendId } = req.params

    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot add yourself to close friends'
      })
    }

    let closeFriendDoc = await CloseFriend.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    if (!closeFriendDoc) {
      closeFriendDoc = await CloseFriend.create({
        user_id: new mongoose.Types.ObjectId(userId),
        close_friend_ids: [new mongoose.Types.ObjectId(friendId)]
      })
    } else {
      // Check if already in list
      const alreadyExists = closeFriendDoc.close_friend_ids.some(
        (id: any) => id.toString() === friendId
      )

      if (alreadyExists) {
        return res.status(400).json({
          success: false,
          error: 'User already in close friends'
        })
      }

      closeFriendDoc.close_friend_ids.push(new mongoose.Types.ObjectId(friendId))
      closeFriendDoc.updated_at = new Date()
      await closeFriendDoc.save()
    }

    res.json({
      success: true,
      message: 'Added to close friends',
      data: {
        count: closeFriendDoc.close_friend_ids.length
      }
    })
  } catch (error: any) {
    console.error('Error adding close friend:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add close friend'
    })
  }
})

// Remove user from close friends
router.delete('/remove/:friendId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { friendId } = req.params

    const closeFriendDoc = await CloseFriend.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    if (!closeFriendDoc) {
      return res.status(404).json({
        success: false,
        error: 'Close friends list not found'
      })
    }

    closeFriendDoc.close_friend_ids = closeFriendDoc.close_friend_ids.filter(
      (id: any) => id.toString() !== friendId
    )
    closeFriendDoc.updated_at = new Date()
    await closeFriendDoc.save()

    res.json({
      success: true,
      message: 'Removed from close friends',
      data: {
        count: closeFriendDoc.close_friend_ids.length
      }
    })
  } catch (error: any) {
    console.error('Error removing close friend:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove close friend'
    })
  }
})

// Check if user is close friend
router.get('/check/:friendId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { friendId } = req.params

    const closeFriendDoc = await CloseFriend.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    const isCloseFriend = closeFriendDoc?.close_friend_ids.some(
      (id: any) => id.toString() === friendId
    ) || false

    res.json({
      success: true,
      data: {
        is_close_friend: isCloseFriend
      }
    })
  } catch (error: any) {
    console.error('Error checking close friend:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check close friend status'
    })
  }
})

export default router

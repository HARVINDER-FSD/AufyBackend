import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth'
import CrushList from '../models/crush-list'
import mongoose from 'mongoose'

const router = Router()

interface AuthRequest extends Request {
  userId?: string
}

// Get user's crush list
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    let crushList = await CrushList.findOne({ user_id: new mongoose.Types.ObjectId(userId) })
      .populate('crush_ids', 'username full_name avatar_url is_verified')

    if (!crushList) {
      crushList = await CrushList.create({
        user_id: new mongoose.Types.ObjectId(userId),
        crush_ids: []
      })
    }

    res.json({
      success: true,
      data: {
        crushes: crushList.crush_ids || [],
        count: crushList.crush_ids?.length || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching crush list:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch crush list'
    })
  }
})

// Add user to crush list
router.post('/add/:crushId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { crushId } = req.params

    if (userId === crushId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot add yourself to crush list'
      })
    }

    let crushList = await CrushList.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    if (!crushList) {
      crushList = await CrushList.create({
        user_id: new mongoose.Types.ObjectId(userId),
        crush_ids: [new mongoose.Types.ObjectId(crushId)]
      })
    } else {
      const alreadyExists = crushList.crush_ids.some(
        (id: any) => id.toString() === crushId
      )

      if (alreadyExists) {
        return res.status(400).json({
          success: false,
          error: 'User already in crush list'
        })
      }

      crushList.crush_ids.push(new mongoose.Types.ObjectId(crushId))
      crushList.updated_at = new Date()
      await crushList.save()
    }

    res.json({
      success: true,
      message: 'Added to crush list',
      data: {
        count: crushList.crush_ids.length
      }
    })
  } catch (error: any) {
    console.error('Error adding to crush list:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add to crush list'
    })
  }
})

// Remove user from crush list
router.delete('/remove/:crushId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { crushId } = req.params

    const crushList = await CrushList.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    if (!crushList) {
      return res.status(404).json({
        success: false,
        error: 'Crush list not found'
      })
    }

    crushList.crush_ids = crushList.crush_ids.filter(
      (id: any) => id.toString() !== crushId
    )
    crushList.updated_at = new Date()
    await crushList.save()

    res.json({
      success: true,
      message: 'Removed from crush list',
      data: {
        count: crushList.crush_ids.length
      }
    })
  } catch (error: any) {
    console.error('Error removing from crush list:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove from crush list'
    })
  }
})

// Check if user is in crush list
router.get('/check/:crushId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { crushId } = req.params

    const crushList = await CrushList.findOne({ user_id: new mongoose.Types.ObjectId(userId) })

    const isInCrushList = crushList?.crush_ids.some(
      (id: any) => id.toString() === crushId
    ) || false

    res.json({
      success: true,
      data: {
        is_in_crush_list: isInCrushList
      }
    })
  } catch (error: any) {
    console.error('Error checking crush list:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check crush list'
    })
  }
})

export default router

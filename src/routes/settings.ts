import express, { Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import User from '../models/user'

const router = express.Router()

// Get user settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId).select('settings')
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Default settings if not set
    const settings = user.settings || {
      darkMode: true,
      privateAccount: false,
      showOnlineStatus: true,
      allowTagging: true,
      allowMentions: true,
      showReadReceipts: true,
      whoCanMessage: 'everyone',
      whoCanSeeStories: 'everyone',
      whoCanSeeFollowers: 'everyone',
      pushNotifications: true,
      emailNotifications: false,
      likes: true,
      comments: true,
      follows: true,
      mentions: true,
      directMessages: true,
      liveVideos: false,
      stories: true,
      posts: true,
      marketing: false,
      security: true,
    }

    res.json({ settings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// Update user settings
router.patch('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Initialize settings if not exists
    if (!user.settings) {
      user.settings = {}
    }

    // Merge new settings with existing ones
    user.settings = {
      ...user.settings,
      ...req.body,
    }

    // Mark settings as modified for Mixed type
    user.markModified('settings')

    await user.save()

    res.json({ 
      message: 'Settings updated successfully',
      settings: user.settings 
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// Update specific setting
router.put('/:key', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params
    const { value } = req.body

    const user = await User.findById(req.user?.userId)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.settings) {
      user.settings = {}
    }

    user.settings[key] = value
    
    // Mark settings as modified for Mixed type
    user.markModified('settings')
    
    await user.save()

    res.json({ 
      message: 'Setting updated successfully',
      key,
      value,
      settings: user.settings
    })
  } catch (error) {
    console.error('Error updating setting:', error)
    res.status(500).json({ error: 'Failed to update setting' })
  }
})

export default router

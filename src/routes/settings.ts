import express, { Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { MongoClient, ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

const router = express.Router()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'

// Get user settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    console.log('[Settings GET] ========================================')
    console.log('[Settings GET] User ID from token:', userId)
    console.log('[Settings GET] User ID type:', typeof userId)
    console.log('[Settings GET] User ID length:', userId?.length)
    console.log('[Settings GET] ========================================')
    
    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()
    
    // First, let's see what users exist
    const allUsers = await db.collection('users').find({}).limit(5).toArray()
    console.log('[Settings GET] Sample user IDs in database:')
    allUsers.forEach((u: any) => {
      console.log('  - ID:', u._id, 'Type:', typeof u._id, 'Username:', u.username)
    })
    
    // Try to find user with ObjectId first
    let user
    let foundWith = ''
    try {
      const objectId = new ObjectId(userId)
      console.log('[Settings GET] Trying ObjectId:', objectId)
      user = await db.collection('users').findOne({ _id: objectId })
      if (user) foundWith = 'ObjectId'
    } catch (err) {
      console.log('[Settings GET] ObjectId conversion failed:', err)
    }
    
    // If not found, try string ID
    if (!user) {
      console.log('[Settings GET] Trying string ID:', userId)
      user = await db.collection('users').findOne({ _id: userId })
      if (user) foundWith = 'String'
    }
    
    // If still not found, try by username from token
    if (!user) {
      console.log('[Settings GET] Trying by username...')
      const decoded = jwt.verify(req.headers.authorization?.split(' ')[1] || '', process.env.JWT_SECRET || 'your-secret-key') as any
      console.log('[Settings GET] Decoded token:', decoded)
      if (decoded.username) {
        user = await db.collection('users').findOne({ username: decoded.username })
        if (user) foundWith = 'Username'
      }
    }
    
    await client.close()
    
    if (!user) {
      console.error('[Settings GET] User not found with any method')
      return res.status(404).json({ error: 'User not found' })
    }
    
    console.log('[Settings GET] User found with:', foundWith)
    console.log('[Settings GET] User _id:', user._id, 'Type:', typeof user._id)

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
    const userId = req.user?.userId
    console.log('[Settings PATCH] User ID from token:', userId, 'Type:', typeof userId)
    console.log('[Settings PATCH] Update data:', req.body)
    
    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()
    
    // Try to find user with ObjectId first
    let user
    let idQuery: any
    try {
      idQuery = { _id: new ObjectId(userId) }
      user = await db.collection('users').findOne(idQuery)
    } catch (err) {
      // If ObjectId fails, try string ID
      console.log('[Settings PATCH] ObjectId failed, trying string ID...')
      idQuery = { _id: userId }
      user = await db.collection('users').findOne(idQuery)
    }
    
    if (!user) {
      await client.close()
      console.error('[Settings PATCH] User not found with either format')
      return res.status(404).json({ error: 'User not found' })
    }
    
    console.log('[Settings PATCH] User found, updating settings...')

    // Initialize settings if not exists
    const currentSettings = user.settings || {}

    // Merge new settings with existing ones
    const updatedSettings = {
      ...currentSettings,
      ...req.body,
    }

    // Update user with new settings
    await db.collection('users').updateOne(
      idQuery,
      { $set: { settings: updatedSettings } }
    )

    await client.close()

    res.json({ 
      message: 'Settings updated successfully',
      settings: updatedSettings 
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
    const userId = req.user?.userId

    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()
    
    // Try to find user with ObjectId first
    let user
    let idQuery: any
    try {
      idQuery = { _id: new ObjectId(userId) }
      user = await db.collection('users').findOne(idQuery)
    } catch (err) {
      idQuery = { _id: userId }
      user = await db.collection('users').findOne(idQuery)
    }
    
    if (!user) {
      await client.close()
      return res.status(404).json({ error: 'User not found' })
    }

    const currentSettings = user.settings || {}
    currentSettings[key] = value

    await db.collection('users').updateOne(
      idQuery,
      { $set: { settings: currentSettings } }
    )

    await client.close()

    res.json({ 
      message: 'Setting updated successfully',
      key,
      value,
      settings: currentSettings
    })
  } catch (error) {
    console.error('Error updating setting:', error)
    res.status(500).json({ error: 'Failed to update setting' })
  }
})

export default router

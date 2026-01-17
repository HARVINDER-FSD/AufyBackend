import { Router } from "express"
import { connectToDatabase } from "../lib/database"
import User from "../models/user"
import Post from "../models/post"
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { cacheGet, cacheSet } from "../lib/redis"

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192'

// Helper to get current user ID from token (optional)
const getCurrentUserId = (req: any): string | null => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) return null

    const decoded = jwt.verify(token, JWT_SECRET) as any
    return decoded.userId
  } catch (error) {
    return null
  }
}

// Global search (root endpoint)
router.get("/", async (req: any, res) => {
  try {
    const { q, limit = 20 } = req.query

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required"
      })
    }

    console.log('[Search] Query:', q)

    // Track search in history if user is logged in
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET) as any
        const userId = decoded.userId
        const { getDatabase } = require('../lib/database')
        const { ObjectId } = require('mongodb')
        const db = await getDatabase()

        // Add to search history
        await db.collection('search_history').insertOne({
          user_id: new ObjectId(userId),
          query: q,
          type: 'search',
          created_at: new Date()
        })
      } catch (err) {
        console.log('[Search] Could not track search history:', err)
      }
    }

    // Try cache first
    const cacheKey = `search:${q}:${limit}`
    const cached = await cacheGet(cacheKey)
    if (cached) {
      console.log(`✅ Cache hit for search: ${q}`)
      return res.json(cached)
    }

    const { db } = await connectToDatabase()
    const currentUserId = getCurrentUserId(req)

    // First, check total users in database
    const totalUsers = await User.countDocuments()
    console.log('[Search] Total users in database:', totalUsers)

    // Search users with simpler query
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { full_name: { $regex: q, $options: 'i' } }
      ]
    })
      .select('username full_name avatar_url is_verified followers_count is_active')
      .limit(Number(limit))
      .lean()

    console.log('[Search] Found users:', users.length)
    if (users.length > 0) {
      console.log('[Search] First user:', users[0])
    }

    // Check follow status for each user if logged in
    let followStatusMap: { [key: string]: boolean } = {}
    if (currentUserId && users.length > 0) {
      console.log('[Search] Checking follow status for currentUserId:', currentUserId)
      const userIds = users.map((u: any) => new ObjectId(u._id))
      console.log('[Search] User IDs to check:', userIds.map(id => id.toString()))
      
      const follows = await db.collection('follows').find({
        follower_id: new ObjectId(currentUserId),
        following_id: { $in: userIds }
      }).toArray()

      console.log('[Search] Found follows:', follows.length)
      follows.forEach((follow: any) => {
        const followingIdStr = follow.following_id.toString()
        followStatusMap[followingIdStr] = true
        console.log('[Search] User', followingIdStr, 'is followed')
      })
    }

    // Search posts
    const posts = await Post.find({
      $or: [
        { caption: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    })
      .populate('user_id', 'username full_name avatar_url is_verified')
      .limit(Number(limit))
      .lean()

    // Extract hashtags from query
    const hashtags = q.startsWith('#') ? [{ tag: q, posts: 0 }] : []

    const formattedUsers = users.map((u: any) => {
      const userId = u._id.toString()
      const isFollowing = followStatusMap[userId] || false
      console.log('[Search] Formatting user:', u.username, 'ID:', userId, 'isFollowing:', isFollowing)
      return {
        _id: userId,
        id: userId,
        username: u.username,
        fullName: u.full_name,
        name: u.full_name,
        avatar: u.avatar_url,
        verified: u.is_verified,
        followers: u.followers_count || 0,
        bio: u.bio || '',
        isFollowing: isFollowing
      }
    })

    const formattedPosts = posts.map((p: any) => ({
      id: p._id.toString(),
      user: {
        id: p.user_id._id.toString(),
        username: p.user_id.username,
        avatar: p.user_id.avatar_url,
        verified: p.user_id.is_verified
      },
      content: p.caption || p.description || '',
      image: p.media_urls?.[0],
      likes: p.likes_count || 0,
      comments: p.comments_count || 0,
      shares: p.shares_count || 0,
      timestamp: p.created_at,
      liked: false,
      bookmarked: false
    }))

    console.log('[Search] Returning:', {
      users: formattedUsers.length,
      posts: formattedPosts.length,
      hashtags: hashtags.length
    })

    // Return in format expected by mobile app
    const response = {
      users: formattedUsers,
      posts: formattedPosts,
      hashtags
    }

    // Cache for 10 minutes (600 seconds)
    await cacheSet(cacheKey, response, 600)

    res.json(response)
  } catch (error: any) {
    console.error("❌ Error performing search:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    })
  }
})

// Search users
router.get("/users", async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required"
      })
    }

    // Placeholder response - implement with actual search service
    res.json({
      success: true,
      data: {
        users: [],
        total: 0
      }
    })
  } catch (error) {
    console.error("Error searching users:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

// Search posts
router.get("/posts", async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required"
      })
    }

    res.json({
      success: true,
      data: {
        posts: [],
        total: 0
      }
    })
  } catch (error) {
    console.error("Error searching posts:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

// Search hashtags
router.get("/hashtags", async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required"
      })
    }

    res.json({
      success: true,
      data: {
        hashtags: [],
        total: 0
      }
    })
  } catch (error) {
    console.error("Error searching hashtags:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

// Get trending hashtags
router.get("/trending", async (req, res) => {
  try {
    const { limit = 10 } = req.query

    res.json({
      success: true,
      data: {
        hashtags: [],
        total: 0
      }
    })
  } catch (error) {
    console.error("Error getting trending hashtags:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

// Get search history
router.get("/history", async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const userId = decoded.userId

    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const { getDatabase } = require('../lib/database')
    const { ObjectId } = require('mongodb')
    const db = await getDatabase()

    // Get total count
    const total = await db.collection('search_history').countDocuments({
      user_id: new ObjectId(userId)
    })

    // Get search history
    const history = await db.collection('search_history')
      .find({ user_id: new ObjectId(userId) })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    res.json({
      success: true,
      history: history.map((item: any) => ({
        _id: item._id.toString(),
        query: item.query,
        type: item.type || 'search',
        createdAt: item.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('Error fetching search history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Delete search history item
router.delete("/history/:itemId", async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const userId = decoded.userId
    const { itemId } = req.params

    const { getDatabase } = require('../lib/database')
    const { ObjectId } = require('mongodb')
    const db = await getDatabase()

    // Delete the search history item
    const result = await db.collection('search_history').deleteOne({
      _id: new ObjectId(itemId),
      user_id: new ObjectId(userId)
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Search history item not found'
      })
    }

    res.json({
      success: true,
      message: 'Search history item deleted'
    })
  } catch (error: any) {
    console.error('Error deleting search history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Clear all search history
router.delete("/history", async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const userId = decoded.userId

    const { getDatabase } = require('../lib/database')
    const { ObjectId } = require('mongodb')
    const db = await getDatabase()

    // Delete all search history for user
    await db.collection('search_history').deleteMany({
      user_id: new ObjectId(userId)
    })

    res.json({
      success: true,
      message: 'All search history cleared'
    })
  } catch (error: any) {
    console.error('Error clearing search history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Global search
router.get("/global", async (req, res) => {
  try {
    const { q, limit = 20 } = req.query

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required"
      })
    }

    res.json({
      success: true,
      data: {
        users: [],
        posts: [],
        hashtags: [],
        total: 0
      }
    })
  } catch (error) {
    console.error("Error performing global search:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error"
    })
  }
})

export default router

import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../lib/database'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192'

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    console.log('[LOGIN] Attempt:', { email, passwordLength: password?.length });

    // Validate required fields
    if (!email || !password) {
      console.log('[LOGIN] Missing fields');
      return res.status(400).json({
        message: "Email and password are required"
      })
    }

    // Connect to MongoDB using shared connection
    const db = await getDatabase()
    const usersCollection = db.collection('users')

    console.log('[LOGIN] Connected to DB:', db.databaseName);
    console.log('[LOGIN] Collection:', usersCollection.collectionName);

    // Count total users
    const totalUsers = await usersCollection.countDocuments();
    console.log('[LOGIN] Total users in collection:', totalUsers);

    // Find user by email
    const user = await usersCollection.findOne({ email })
    console.log('[LOGIN] Query:', { email });

    console.log('[LOGIN] User found:', !!user, user ? `(${user.username})` : '');

    if (!user) {
      console.log('[LOGIN] User not found');
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    console.log('[LOGIN] Has password:', !!user.password);

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password)

    console.log('[LOGIN] Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[LOGIN] Invalid password');
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Set httpOnly cookie for server-side access
    res.cookie('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    // Also set a non-httpOnly cookie for client-side access
    res.cookie('client-token', token, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    // Return user data and token
    return res.json({
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || "",
        fullName: user.name || "",
        bio: user.bio || "",
        avatar: user.avatar || "/placeholder-user.jpg",
        followers: user.followers || 0,
        following: user.following || 0,
        verified: user.verified || false
      },
      token: token
    })
  } catch (error: any) {
    console.error("Login error:", error)
    return res.status(error.status || 401).json({
      message: error.message || "Login failed"
    })
  }
})

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, username, name } = req.body

    // Validate required fields
    if (!email || !password || !username) {
      return res.status(400).json({
        message: "Email, password, and username are required"
      })
    }

    // Connect to MongoDB using shared connection
    const db = await getDatabase()
    const usersCollection = db.collection('users')

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_.]+$/
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
        error: 'INVALID_USERNAME_FORMAT'
      })
    }

    // Check username length
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        message: 'Username must be between 3 and 30 characters',
        error: 'INVALID_USERNAME_LENGTH'
      })
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { username }]
    })

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          message: "Email already registered"
        })
      } else {
        // Username is taken - generate suggestions
        const suggestions: string[] = []
        const baseUsername = username.replace(/[0-9]+$/, '') // Remove trailing numbers
        
        // Try adding random numbers
        for (let i = 0; i < 5; i++) {
          const randomNum = Math.floor(Math.random() * 9999) + 1
          const suggestion = `${baseUsername}${randomNum}`
          
          // Check if suggestion is available
          const exists = await usersCollection.findOne({ username: suggestion })
          if (!exists && suggestion.length <= 30) {
            suggestions.push(suggestion)
          }
        }
        
        // Try adding underscore and numbers
        if (suggestions.length < 5) {
          for (let i = 0; i < 3; i++) {
            const randomNum = Math.floor(Math.random() * 999) + 1
            const suggestion = `${baseUsername}_${randomNum}`
            
            const exists = await usersCollection.findOne({ username: suggestion })
            if (!exists && suggestion.length <= 30 && !suggestions.includes(suggestion)) {
              suggestions.push(suggestion)
            }
          }
        }
        
        return res.status(400).json({
          message: "Username already taken",
          error: 'USERNAME_TAKEN',
          suggestions: suggestions.slice(0, 5)
        })
      }
    }

    // Hash password (8 rounds for faster mobile performance)
    const hashedPassword = await bcrypt.hash(password, 8)

    // Create new user
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      username,
      name: name || username,
      bio: "",
      avatar: "/placeholder-user.jpg",
      followers: 0,
      following: 0,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: result.insertedId.toString(),
        email,
        username,
        name: name || username
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Set cookies
    res.cookie('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    res.cookie('client-token', token, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return res.json({
      user: {
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        username,
        email,
        name: name || username,
        fullName: name || username,
        bio: "",
        avatar: "/placeholder-user.jpg",
        followers: 0,
        following: 0,
        verified: false
      },
      token
    })
  } catch (error: any) {
    console.error("Register error:", error)
    return res.status(500).json({
      message: error.message || "Registration failed"
    })
  }
})

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token')
  res.clearCookie('client-token')
  return res.json({ message: "Logged out successfully" })
})

export default router

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
import path from 'path'
// When running with tsx, __dirname is api-server/src, so go up one level to api-server
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
console.log('Loaded .env from:', path.resolve(__dirname, '..', '.env'))
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI)
console.log('MONGODB_URI value:', process.env.MONGODB_URI?.substring(0, 50))

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import postsRoutes from './routes/posts'
import reelsRoutes from './routes/reels'
import storiesRoutes from './routes/stories'
import notificationsRoutes from './routes/notifications'
import chatRoutes from './routes/chat'
import uploadRoutes from './routes/upload'
import feedRoutes from './routes/feed'
import exploreRoutes from './routes/explore'
import hashtagsRoutes from './routes/hashtags'
import reportsRoutes from './routes/reports'
import searchRoutes from './routes/search'
import analyticsRoutes from './routes/analytics'
import bookmarksRoutes from './routes/bookmarks'
import settingsRoutes from './routes/settings'
import pushRoutes from './routes/push'
import closeFriendsRoutes from './routes/close-friends'
import highlightsRoutes from './routes/highlights'
import storiesCloseFriendsRoutes from './routes/stories-close-friends'
import notesRoutes from './routes/notes'
import crushListRoutes from './routes/crush-list'
import secretCrushRoutes from './routes/secret-crush'
import premiumRoutes from './routes/premium'
import demoRoutes from './routes/demo'

const app = express()
const PORT = parseInt(process.env.PORT || '8000')

// Connect to MongoDB at startup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia'
mongoose.set('strictQuery', false)
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  console.log('✅ MongoDB connected successfully')
  
  // Create indexes for faster queries
  try {
    const db = mongoose.connection.db
    if (db) {
      await db.collection('users').createIndex({ email: 1 }, { unique: true })
      await db.collection('users').createIndex({ username: 1 }, { unique: true })
      console.log('✅ Database indexes created')
    }
  } catch (error) {
    console.log('⚠️  Index creation skipped (may already exist)')
  }
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message)
  console.log('⚠️  Server will continue but database operations may fail')
})

// Security Middleware
import {
  rateLimiter,
  sanitizeInput,
  xssProtection,
  validateRequestSignature,
  csrfProtection,
  ipFilter,
  detectSuspiciousActivity,
  secureSession
} from './middleware/security'

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://anufy.com', 'https://www.anufy.com'] 
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Timestamp', 'X-Signature']
}))

// Security layers
app.use(xssProtection)
app.use(ipFilter)
app.use(detectSuspiciousActivity)
app.use(sanitizeInput)
app.use(rateLimiter(100, 60000)) // 100 requests per minute
app.use(validateRequestSignature)
app.use(csrfProtection)
app.use(secureSession)

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())

// Serve static files (for password reset redirect page)
app.use(express.static(path.join(__dirname, '..', 'public')))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Anufy API Server is running' })
})

// Password reset redirect page
app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'reset-redirect.html'))
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/reels', reelsRoutes)
app.use('/api/stories', storiesRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/explore', exploreRoutes)
app.use('/api/hashtags', hashtagsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/bookmarks', bookmarksRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/close-friends', closeFriendsRoutes)
app.use('/api/highlights', highlightsRoutes)
app.use('/api/stories', storiesCloseFriendsRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/crush-list', crushListRoutes)
app.use('/api/secret-crush', secretCrushRoutes)
app.use('/api/premium', premiumRoutes)
app.use('/api/demo', demoRoutes)

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Anufy API Server running on port ${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/health`)
  console.log(`📍 Network access: http://10.55.239.5:${PORT}/health`)
  console.log(`📍 Auth routes: http://localhost:${PORT}/api/auth/*`)
  console.log(`📍 User routes: http://localhost:${PORT}/api/users/*`)
  console.log(`📍 Post routes: http://localhost:${PORT}/api/posts/*`)
  console.log(`📍 Reel routes: http://localhost:${PORT}/api/reels/*`)
  console.log(`📍 Story routes: http://localhost:${PORT}/api/stories/*`)
  console.log(`📍 Notification routes: http://localhost:${PORT}/api/notifications/*`)
  console.log(`📍 Chat routes: http://localhost:${PORT}/api/chat/*`)
  console.log(`📍 Upload routes: http://localhost:${PORT}/api/upload/*`)
  console.log(`📍 Feed routes: http://localhost:${PORT}/api/feed/*`)
  console.log(`📍 Explore routes: http://localhost:${PORT}/api/explore/*`)
  console.log(`📍 Reports routes: http://localhost:${PORT}/api/reports/*`)
  console.log(`📍 Search routes: http://localhost:${PORT}/api/search/*`)
  console.log(`📍 Analytics routes: http://localhost:${PORT}/api/analytics/*`)
  console.log(`📍 Bookmarks routes: http://localhost:${PORT}/api/bookmarks/*`)
  
  // Keep service awake on Render free tier (prevents sleeping after 15 min)
  if (process.env.NODE_ENV === 'production') {
    const BACKEND_URL = 'https://aufybackend.onrender.com';
    
    console.log('🔄 Self-ping enabled - keeping service awake');
    
    setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (response.ok) {
          console.log('✅ Self-ping successful');
        } else {
          console.log('⚠️  Self-ping returned:', response.status);
        }
      } catch (error: any) {
        console.log('⚠️  Self-ping failed:', error.message);
      }
    }, 10 * 60 * 1000); // Ping every 10 minutes
  }
})

export default app

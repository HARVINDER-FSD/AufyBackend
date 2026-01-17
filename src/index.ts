// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
import path from 'path'

// Load .env from api-server directory
const envPath = path.resolve(process.cwd(), '.env')
const result = dotenv.config({ path: envPath })

// Manually set MONGODB_URI from parsed result if dotenv didn't set it correctly
if (result.parsed?.MONGODB_URI && !process.env.MONGODB_URI?.includes('mongodb+srv')) {
  process.env.MONGODB_URI = result.parsed.MONGODB_URI
}

import express from 'express'
import 'express-async-errors'
import { requestId, httpLogger, logger } from './middleware/logger'
import { errorHandler } from './middleware/errorHandler'

import { createServer } from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { initializeWebSocket } from './lib/websocket'
import { initRedis } from './lib/redis'
import { recordMetric, getPerformanceSummary, checkPerformanceTargets } from './lib/performance-monitor'
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
import professionalRoutes from './routes/professional'
import verificationRoutes from './routes/verification'
import closeFriendsRoutes from './routes/close-friends'
import highlightsRoutes from './routes/highlights'
import storiesCloseFriendsRoutes from './routes/stories-close-friends'
import notesRoutes from './routes/notes'
import crushListRoutes from './routes/crush-list'
import secretCrushRoutes from './routes/secret-crush'
import premiumRoutes from './routes/premium'
import demoRoutes from './routes/demo'
import aiRoutes from './routes/ai'
import promBundle from 'express-prom-bundle'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'


import { initializeFirebase } from './services/firebase-messaging'

const app = express()
const httpServer = createServer(app)
const PORT = parseInt(process.env.PORT || '8000')

// Initialize Firebase for push notifications
initializeFirebase()

// Initialize Redis for caching
initRedis()

// Initialize WebSocket server
const io = initializeWebSocket(httpServer)
console.log('✅ WebSocket server initialized')

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
  origin: '*', // Allow all origins for mobile app compatibility
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Timestamp', 'X-Signature']
}))

// Security layers
app.use(xssProtection as any)
app.use(ipFilter as any)
app.use(detectSuspiciousActivity as any)
app.use(sanitizeInput as any)
app.use(rateLimiter(100, 60000) as any) // 100 requests per minute
app.use(validateRequestSignature as any)
app.use(csrfProtection as any)
app.use(secureSession as any)


// Prometheus Metrics Middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: 'anufy_api' },
  promClient: {
    collectDefaultMetrics: {}
  }
});
app.use(metricsMiddleware as any);


app.use(express.json({ limit: '50mb' }))

app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())

app.use(httpLogger)
app.use(requestId)

// Performance Monitoring Middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = (req as any).userId;
    recordMetric(req.path, req.method, duration, res.statusCode, userId);
  });

  next();
});

// Swagger Documentation
const swaggerPath = path.resolve(process.cwd(), 'src', 'docs', 'swagger.yaml')
const swaggerDocument = YAML.load(swaggerPath)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))


// Serve static files (for password reset redirect page)

app.use(express.static(path.join(__dirname, '..', 'public')))

// Health check
app.get('/health', async (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  let redisStatus = false;
  try {
    const { getRedis } = await import('./lib/redis');
    const redis = getRedis();
    if (redis) {
      // @ts-ignore
      await (redis as any).ping();
      redisStatus = true;
    }
  } catch (err) {
    logger.warn('Health check Redis Error:', err);
  }

  const status = dbStatus && redisStatus ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus ? 'connected' : 'disconnected',
      redis: redisStatus ? 'connected' : 'disconnected'
    }
  });
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
app.use('/api/ai', aiRoutes)
app.use('/api/professional', professionalRoutes)
app.use('/api/verification', verificationRoutes)

// Performance Metrics Endpoint (Admin only)
app.get('/api/metrics', (_req, res) => {
  res.json({
    summary: getPerformanceSummary(),
    violations: checkPerformanceTargets()
  });
});

// Global Error Handler (must be last)
app.use(errorHandler)


// Start server with WebSocket support
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Anufy API Server running on port ${PORT}`)
  console.log(`🔌 WebSocket server ready for real-time chat`)
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

    logger.info('🔄 Self-ping enabled - keeping service awake');

    setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (response.ok) {
          logger.info('✅ Self-ping successful');
        } else {
          logger.warn('⚠️  Self-ping returned:', response.status);
        }
      } catch (error: any) {
        logger.warn('⚠️  Self-ping failed:', error.message);
      }
    }, 10 * 60 * 1000); // Ping every 10 minutes
  }
})

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info(`收到 ${signal}。正在优雅关闭...`);

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP 服务器已关闭。');
  });

  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    logger.info('MongoDB 连接已关闭。');
  } catch (err) {
    logger.error('关闭 MongoDB 时出错:', err);
  }

  // Final exit
  setTimeout(() => {
    logger.info('进程退出。');
    process.exit(0);
  }, 1000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));


export default app

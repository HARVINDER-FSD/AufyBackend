import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

async function addIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '')
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db

    // User indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true })
    await db.collection('users').createIndex({ email: 1 }, { unique: true })
    console.log('✓ User indexes created')

    // Follow indexes for fast follower/following queries
    await db.collection('follows').createIndex({ follower_id: 1 })
    await db.collection('follows').createIndex({ following_id: 1 })
    await db.collection('follows').createIndex({ follower_id: 1, following_id: 1 }, { unique: true })
    console.log('✓ Follow indexes created')

    // Post indexes
    await db.collection('posts').createIndex({ user_id: 1, created_at: -1 })
    await db.collection('posts').createIndex({ created_at: -1 })
    console.log('✓ Post indexes created')

    // Like indexes
    await db.collection('likes').createIndex({ user_id: 1, post_id: 1 }, { unique: true })
    await db.collection('likes').createIndex({ post_id: 1 })
    console.log('✓ Like indexes created')

    // Comment indexes
    await db.collection('comments').createIndex({ post_id: 1, created_at: -1 })
    console.log('✓ Comment indexes created')

    // Notification indexes
    await db.collection('notifications').createIndex({ user_id: 1, created_at: -1 })
    await db.collection('notifications').createIndex({ user_id: 1, is_read: 1 })
    console.log('✓ Notification indexes created')

    console.log('\n✅ All indexes created successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error creating indexes:', error)
    process.exit(1)
  }
}

addIndexes()

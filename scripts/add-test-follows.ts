import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const MONGODB_URI = process.env.MONGODB_URI || ''

async function addTestFollows() {
  try {
    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()

    // Get users
    const users = await db.collection('users').find({}).limit(5).toArray()
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users to create follow relationships')
      await client.close()
      process.exit(1)
    }

    console.log('\n📋 Creating test follow relationships...\n')

    // Create some follow relationships
    const follows = []
    
    // User 0 follows users 1, 2, 3
    for (let i = 1; i < Math.min(4, users.length); i++) {
      follows.push({
        followerId: users[0]._id,
        followingId: users[i]._id,
        createdAt: new Date()
      })
    }
    
    // User 1 follows user 0
    if (users.length > 1) {
      follows.push({
        followerId: users[1]._id,
        followingId: users[0]._id,
        createdAt: new Date()
      })
    }
    
    // User 2 follows user 0
    if (users.length > 2) {
      follows.push({
        followerId: users[2]._id,
        followingId: users[0]._id,
        createdAt: new Date()
      })
    }

    // Insert follow records
    if (follows.length > 0) {
      await db.collection('follows').insertMany(follows)
      console.log(`✅ Created ${follows.length} follow relationships`)
    }

    // Show results
    console.log('\n📊 Follow Summary:')
    for (const user of users) {
      const followers = await db.collection('follows').countDocuments({
        followingId: user._id
      })
      const following = await db.collection('follows').countDocuments({
        followerId: user._id
      })
      console.log(`  ${user.username}: ${followers} followers, ${following} following`)
    }

    await client.close()
    console.log('\n✅ Done! Refresh your app to see the updated counts.')
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

addTestFollows()

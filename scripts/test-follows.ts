import mongoose from 'mongoose'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const MONGODB_URI = process.env.MONGODB_URI || ''

async function testFollows() {
  try {
    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()

    // Get all users
    const users = await db.collection('users').find({}).limit(5).toArray()
    console.log('\n📋 Users in database:')
    users.forEach(u => console.log(`  - ${u.username} (${u._id})`))

    // Get all follow records
    const follows = await db.collection('follows').find({}).toArray()
    console.log(`\n👥 Total follow records: ${follows.length}`)
    
    if (follows.length > 0) {
      console.log('\nFollow records:')
      follows.forEach(f => {
        console.log(`  - ${f.followerId} follows ${f.followingId}`)
      })
    }

    // Check for a specific user
    if (users.length > 0) {
      const testUser = users[0]
      console.log(`\n🔍 Checking follows for user: ${testUser.username}`)
      
      const followers = await db.collection('follows').find({
        followingId: testUser._id
      }).toArray()
      console.log(`  Followers: ${followers.length}`)
      
      const following = await db.collection('follows').find({
        followerId: testUser._id
      }).toArray()
      console.log(`  Following: ${following.length}`)
    }

    await client.close()
    console.log('\n✅ Test complete')
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testFollows()

// Script to remove all follow relationships from database
// This will reset all follows so you can start fresh

const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

// Read .env file manually
const envPath = path.join(__dirname, '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envLines = envContent.split('\n')

let MONGODB_URI = null
for (const line of envLines) {
    if (line.startsWith('MONGODB_URI=')) {
        MONGODB_URI = line.substring('MONGODB_URI='.length).trim()
        break
    }
}

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file')
    process.exit(1)
}

console.log('🔗 Connecting to MongoDB Atlas...')

async function removeAllFollows() {
    const client = await MongoClient.connect(MONGODB_URI)
    const db = client.db()

    try {
        console.log('✅ Connected to database')
        console.log('🔍 Checking current follows...')
        
        // Count current follows
        const followCount = await db.collection('follows').countDocuments()
        console.log(`📊 Found ${followCount} follow relationships`)

        if (followCount === 0) {
            console.log('✅ No follows to remove')
            await client.close()
            return
        }

        // Get all follows for logging
        const allFollows = await db.collection('follows').find().toArray()
        console.log('\n📋 Current follows:')
        allFollows.forEach((follow, index) => {
            console.log(`${index + 1}. ${follow.follower_id} → ${follow.following_id} (status: ${follow.status || 'accepted'})`)
        })

        console.log(`\n⚠️  Deleting ${followCount} follow relationships...`)
        
        // Delete all follows
        const result = await db.collection('follows').deleteMany({})
        console.log(`✅ Deleted ${result.deletedCount} follow relationships`)

        // Also delete any pending follow requests
        const requestCount = await db.collection('followRequests').countDocuments()
        if (requestCount > 0) {
            const requestResult = await db.collection('followRequests').deleteMany({})
            console.log(`✅ Deleted ${requestResult.deletedCount} follow requests`)
        }

        // Reset follower/following counts for all users
        console.log('\n🔄 Resetting user follower/following counts...')
        await db.collection('users').updateMany(
            {},
            {
                $set: {
                    followers_count: 0,
                    following_count: 0
                }
            }
        )
        console.log('✅ Reset all user counts to 0')

        console.log('\n✨ All follow relationships have been removed!')
        console.log('You can now start fresh with new friend requests')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await client.close()
    }
}

// Run the script
removeAllFollows()

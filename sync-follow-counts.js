const { MongoClient, ObjectId } = require('mongodb');

// Hardcoded MongoDB Atlas URI
const MONGODB_URI = 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

console.log('📡 Connecting to MongoDB Atlas...');

async function syncFollowCounts() {
    console.log('🔄 Syncing follower/following counts...\n');

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    try {
        // Get all users
        const users = await db.collection('users').find({}).toArray();
        console.log(`Found ${users.length} users\n`);

        for (const user of users) {
            // Count followers (people who follow this user)
            const followersCount = await db.collection('follows').countDocuments({
                following_id: user._id,
                status: 'accepted'
            });

            // Count following (people this user follows)
            const followingCount = await db.collection('follows').countDocuments({
                follower_id: user._id,
                status: 'accepted'
            });

            // Update user document
            await db.collection('users').updateOne(
                { _id: user._id },
                { 
                    $set: { 
                        followers_count: followersCount,
                        following_count: followingCount
                    }
                }
            );

            console.log(`✅ ${user.username}: ${followersCount} followers, ${followingCount} following`);
        }

        console.log('\n✅ All counts synced successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

syncFollowCounts();

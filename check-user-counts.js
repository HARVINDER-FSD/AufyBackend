const { MongoClient, ObjectId } = require('mongodb');

// Hardcoded MongoDB Atlas URI
const MONGODB_URI = 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function checkUserCounts() {
    console.log('🔍 Checking user counts in database...\n');

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    try {
        // Get the two users
        const harvinder = await db.collection('users').findOne({ 
            _id: new ObjectId('68fa0a99696d2b1cf4f5143d') 
        });
        
        const harshit = await db.collection('users').findOne({ 
            _id: new ObjectId('6939885e3dea6231c93fcdaa') 
        });

        console.log('Its.harvinder.05:');
        console.log(`  - followers_count: ${harvinder.followers_count}`);
        console.log(`  - following_count: ${harvinder.following_count}\n`);

        console.log('its_harshit_01:');
        console.log(`  - followers_count: ${harshit.followers_count}`);
        console.log(`  - following_count: ${harshit.following_count}\n`);

        // Check actual follows
        const followCount = await db.collection('follows').countDocuments({
            follower_id: new ObjectId('68fa0a99696d2b1cf4f5143d'),
            following_id: new ObjectId('6939885e3dea6231c93fcdaa')
        });

        console.log(`Follow relationship exists: ${followCount > 0 ? 'YES' : 'NO'}`);

        // Get all follows for harvinder
        const harvinderFollows = await db.collection('follows').find({
            follower_id: new ObjectId('68fa0a99696d2b1cf4f5143d')
        }).toArray();

        console.log(`\nHarvinder is following ${harvinderFollows.length} users:`);
        for (const follow of harvinderFollows) {
            const user = await db.collection('users').findOne({ _id: follow.following_id });
            console.log(`  - ${user.username} (status: ${follow.status})`);
        }

        // Get all followers for harshit
        const harshitFollowers = await db.collection('follows').find({
            following_id: new ObjectId('6939885e3dea6231c93fcdaa')
        }).toArray();

        console.log(`\nHarshit has ${harshitFollowers.length} followers:`);
        for (const follow of harshitFollowers) {
            const user = await db.collection('users').findOne({ _id: follow.follower_id });
            console.log(`  - ${user.username} (status: ${follow.status})`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkUserCounts();

// Verify if the follow relationship actually exists in the database
require('dotenv').config({ path: __dirname + '/.env' });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const CURRENT_USER_ID = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05
const TARGET_USER_ID = '6939885e3dea6231c93fcdaa'; // its_harshit_01

async function verifyFollows() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    console.log('🔍 Checking if follow relationship exists...\n');
    console.log('Current User:', CURRENT_USER_ID, '(Its.harvinder.05)');
    console.log('Target User:', TARGET_USER_ID, '(its_harshit_01)');

    // Check with snake_case (correct field names)
    console.log('\n1️⃣ Checking with snake_case (follower_id / following_id):');
    const followSnake = await db.collection('follows').findOne({
      follower_id: new ObjectId(CURRENT_USER_ID),
      following_id: new ObjectId(TARGET_USER_ID)
    });
    console.log('Result:', followSnake ? '✅ FOUND' : '❌ NOT FOUND');
    if (followSnake) {
      console.log('Follow record:', JSON.stringify(followSnake, null, 2));
    }

    // Check with camelCase (wrong field names - for comparison)
    console.log('\n2️⃣ Checking with camelCase (followerId / followingId):');
    const followCamel = await db.collection('follows').findOne({
      followerId: new ObjectId(CURRENT_USER_ID),
      followingId: new ObjectId(TARGET_USER_ID)
    });
    console.log('Result:', followCamel ? '✅ FOUND' : '❌ NOT FOUND');
    if (followCamel) {
      console.log('Follow record:', JSON.stringify(followCamel, null, 2));
    }

    // Get all follows for current user
    console.log('\n3️⃣ All follows by current user (with snake_case):');
    const allFollows = await db.collection('follows')
      .find({ follower_id: new ObjectId(CURRENT_USER_ID) })
      .toArray();
    console.log(`Found ${allFollows.length} follows`);
    
    if (allFollows.length > 0) {
      console.log('\nFollowing users:');
      for (const follow of allFollows) {
        const user = await db.collection('users').findOne({ _id: follow.following_id });
        console.log(`  - ${user?.username || 'unknown'} (${follow.following_id})`);
      }
    } else {
      console.log('⚠️  User is not following anyone!');
    }

    // Check if follow relationship needs to be created
    if (!followSnake && !followCamel) {
      console.log('\n❌ PROBLEM: No follow relationship exists!');
      console.log('\n💡 SOLUTION: You need to follow this user first.');
      console.log('   Go to the profile page and click Follow button.');
    } else if (followSnake) {
      console.log('\n✅ Follow relationship exists with correct field names!');
      console.log('   The backend fix should work once deployed.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

verifyFollows();

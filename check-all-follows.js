// Check ALL follow records in database
require('dotenv').config({ path: __dirname + '/.env' });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const CURRENT_USER_ID = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05

async function checkAllFollows() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    console.log('🔍 Checking ALL follow records in database...\n');

    // Get all follows
    const allFollows = await db.collection('follows').find({}).toArray();
    console.log(`📊 Total follow records in database: ${allFollows.length}\n`);

    if (allFollows.length === 0) {
      console.log('❌ NO FOLLOW RECORDS FOUND IN DATABASE!');
      console.log('   This means you need to follow users first.');
      await client.close();
      return;
    }

    // Show first few records to see structure
    console.log('📋 Sample follow records (first 5):');
    allFollows.slice(0, 5).forEach((follow, i) => {
      console.log(`\n${i + 1}. Follow record:`, JSON.stringify(follow, null, 2));
    });

    // Check with snake_case
    console.log('\n\n1️⃣ Checking with snake_case (follower_id / following_id):');
    const followsSnake = await db.collection('follows').find({
      follower_id: new ObjectId(CURRENT_USER_ID)
    }).toArray();
    console.log(`   Found ${followsSnake.length} follows`);
    
    if (followsSnake.length > 0) {
      console.log('   Following:');
      for (const follow of followsSnake) {
        const user = await db.collection('users').findOne({ _id: follow.following_id });
        console.log(`     - ${user?.username || 'unknown'} (${follow.following_id})`);
      }
    }

    // Check with camelCase
    console.log('\n2️⃣ Checking with camelCase (followerId / followingId):');
    const followsCamel = await db.collection('follows').find({
      followerId: new ObjectId(CURRENT_USER_ID)
    }).toArray();
    console.log(`   Found ${followsCamel.length} follows`);
    
    if (followsCamel.length > 0) {
      console.log('   Following:');
      for (const follow of followsCamel) {
        const user = await db.collection('users').findOne({ _id: follow.followingId });
        console.log(`     - ${user?.username || 'unknown'} (${follow.followingId})`);
      }
    }

    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log(`   Total follows in DB: ${allFollows.length}`);
    console.log(`   Your follows (snake_case): ${followsSnake.length}`);
    console.log(`   Your follows (camelCase): ${followsCamel.length}`);
    
    if (followsSnake.length === 0 && followsCamel.length === 0) {
      console.log('\n❌ PROBLEM: You are not following anyone!');
      console.log('   SOLUTION: Go to a user\'s profile and click Follow button.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAllFollows();

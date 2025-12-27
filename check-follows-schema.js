// Check actual field names in follows collection
require('dotenv').config({ path: __dirname + '/.env' });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = '68fa0a99696d2b1cf4f5143d'; // Its.harvinder.05

async function checkFollowsSchema() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    console.log('📋 Checking follows collection schema...\n');

    // Get one follow record to see field names
    const sampleFollow = await db.collection('follows').findOne({});
    
    if (sampleFollow) {
      console.log('Sample follow record:');
      console.log(JSON.stringify(sampleFollow, null, 2));
      console.log('\nField names:', Object.keys(sampleFollow));
    } else {
      console.log('No follow records found');
    }

    // Check follows for our user with different field name variations
    console.log('\n\n🔍 Testing different field name variations for user:', USER_ID);
    const userId = new ObjectId(USER_ID);

    // Test 1: follower_id / following_id (snake_case)
    console.log('\n1. Testing snake_case (follower_id / following_id):');
    const follows1 = await db.collection('follows')
      .find({ follower_id: userId })
      .toArray();
    console.log(`   Found ${follows1.length} follows`);
    if (follows1.length > 0) {
      console.log('   First record:', follows1[0]);
    }

    // Test 2: followerId / followingId (camelCase)
    console.log('\n2. Testing camelCase (followerId / followingId):');
    const follows2 = await db.collection('follows')
      .find({ followerId: userId })
      .toArray();
    console.log(`   Found ${follows2.length} follows`);
    if (follows2.length > 0) {
      console.log('   First record:', follows2[0]);
    }

    // Test 3: Check specific follow relationship
    const targetUserId = new ObjectId('6939885e3dea6231c93fcdaa'); // its_harshit_01
    console.log('\n3. Checking if user follows its_harshit_01 (6939885e3dea6231c93fcdaa):');
    
    const follow_snake = await db.collection('follows').findOne({
      follower_id: userId,
      following_id: targetUserId
    });
    console.log('   With snake_case:', !!follow_snake);
    if (follow_snake) console.log('   Record:', follow_snake);

    const follow_camel = await db.collection('follows').findOne({
      followerId: userId,
      followingId: targetUserId
    });
    console.log('   With camelCase:', !!follow_camel);
    if (follow_camel) console.log('   Record:', follow_camel);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkFollowsSchema();

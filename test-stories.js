// Test script to check stories in database
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function testStories() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  console.log('=== CHECKING STORIES ===\n');

  // Get all stories
  const stories = await db.collection('stories').find({}).toArray();
  console.log(`Total stories in database: ${stories.length}\n`);

  // Get active stories (not expired)
  const activeStories = await db.collection('stories').find({
    expires_at: { $gt: new Date() },
    is_deleted: { $ne: true }
  }).toArray();
  console.log(`Active stories (not expired): ${activeStories.length}\n`);

  // Show first 5 active stories
  if (activeStories.length > 0) {
    console.log('First 5 active stories:');
    activeStories.slice(0, 5).forEach((story, i) => {
      console.log(`${i + 1}. ID: ${story._id}`);
      console.log(`   User: ${story.user_id}`);
      console.log(`   Created: ${story.created_at}`);
      console.log(`   Expires: ${story.expires_at}`);
      console.log(`   Media: ${story.media_url?.substring(0, 50)}...`);
      console.log('');
    });
  } else {
    console.log('❌ No active stories found!');
    console.log('\nTo create a test story, use the app or run:');
    console.log('node api-server/create-test-story.js');
  }

  await client.close();
}

testStories().catch(console.error);

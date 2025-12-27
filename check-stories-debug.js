const { MongoClient, ObjectId } = require('mongodb');

// Use Atlas URI directly
const MONGODB_URI = 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

console.log('✅ Connecting to MongoDB Atlas...');

async function checkStories() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  console.log('\n=== CHECKING STORIES ===\n');

  // Get all stories
  const stories = await db.collection('stories').find({}).toArray();
  console.log(`Total stories in database: ${stories.length}`);

  if (stories.length > 0) {
    console.log('\nStories:');
    for (const story of stories) {
      const user = await db.collection('users').findOne({ _id: story.user_id });
      const isExpired = new Date(story.expires_at) < new Date();
      
      console.log(`\n- Story ID: ${story._id}`);
      console.log(`  User: ${user?.username || 'Unknown'} (${story.user_id})`);
      console.log(`  Media Type: ${story.media_type}`);
      console.log(`  Media URL: ${story.media_url}`);
      console.log(`  Created: ${story.created_at}`);
      console.log(`  Expires: ${story.expires_at}`);
      console.log(`  Expired: ${isExpired ? 'YES ❌' : 'NO ✅'}`);
      console.log(`  Deleted: ${story.is_deleted ? 'YES' : 'NO'}`);
      console.log(`  Views: ${story.views_count || 0}`);
    }
  } else {
    console.log('\n❌ No stories found in database!');
    console.log('\nTo see stories, you need to:');
    console.log('1. Create a story using the app');
    console.log('2. Go to Stories tab and tap the camera icon');
    console.log('3. Select a photo/video and publish');
  }

  // Check active (non-expired) stories
  const activeStories = await db.collection('stories').find({
    expires_at: { $gt: new Date() },
    is_deleted: false
  }).toArray();
  
  console.log(`\n\nActive (non-expired) stories: ${activeStories.length}`);

  // Get current user (for testing)
  const users = await db.collection('users').find({}).limit(5).toArray();
  console.log(`\n\nUsers in database: ${users.length}`);
  if (users.length > 0) {
    console.log('\nFirst few users:');
    users.forEach(u => {
      console.log(`- ${u.username} (${u._id})`);
    });
  }

  // Check follows
  const follows = await db.collection('follows').find({}).toArray();
  console.log(`\n\nFollow relationships: ${follows.length}`);
  if (follows.length > 0) {
    console.log('\nFollow relationships:');
    for (const follow of follows.slice(0, 10)) {
      const follower = await db.collection('users').findOne({ _id: follow.followerId });
      const following = await db.collection('users').findOne({ _id: follow.followingId });
      console.log(`- ${follower?.username || 'Unknown'} follows ${following?.username || 'Unknown'}`);
    }
  }

  await client.close();
}

checkStories().catch(console.error);

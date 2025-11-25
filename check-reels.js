// Script to check what data is in reels
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkReels() {
  console.log('🔍 Checking reels data...\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  const reelsCollection = db.collection('reels');
  const usersCollection = db.collection('users');

  try {
    // Find user by username
    const user = await usersCollection.findOne({ username: 'Its.harvinder.05' });
    
    if (!user) {
      console.log('❌ User not found');
      await client.close();
      return;
    }

    console.log('✅ Found user:', user.username, '(ID:', user._id.toString(), ')');
    
    // Find user's reels
    const reels = await reelsCollection.find({ user_id: user._id }).toArray();
    
    console.log(`\n📊 Found ${reels.length} reels for this user\n`);
    
    if (reels.length === 0) {
      console.log('No reels found for this user');
    } else {
      reels.forEach((reel, index) => {
        console.log(`Reel #${index + 1}:`);
        console.log('  ID:', reel._id.toString());
        console.log('  video_url:', reel.video_url || 'NOT SET');
        console.log('  thumbnail_url:', reel.thumbnail_url || 'NOT SET');
        console.log('  title:', reel.title || 'NOT SET');
        console.log('  description:', reel.description || 'NOT SET');
        console.log('  caption:', reel.caption || 'NOT SET');
        console.log('  created_at:', reel.created_at);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkReels();

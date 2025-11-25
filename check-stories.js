// Script to check stories in database
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkStories() {
  console.log('🔍 Checking stories data...\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  const storiesCollection = db.collection('stories');
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
    
    // Find all stories
    const allStories = await storiesCollection.find({}).sort({ created_at: -1 }).limit(10).toArray();
    console.log(`\n📊 Total stories in database: ${await storiesCollection.countDocuments()}`);
    console.log(`\n📊 Recent 10 stories:\n`);
    
    if (allStories.length === 0) {
      console.log('No stories found in database');
    } else {
      allStories.forEach((story, index) => {
        console.log(`Story #${index + 1}:`);
        console.log('  ID:', story._id.toString());
        console.log('  User ID:', story.user_id?.toString() || 'NOT SET');
        console.log('  Media URL:', story.media_url ? story.media_url.substring(0, 60) + '...' : 'NOT SET');
        console.log('  Media Type:', story.media_type || 'NOT SET');
        console.log('  Caption:', story.caption || 'NOT SET');
        console.log('  Created:', story.created_at);
        console.log('  Expires:', story.expires_at);
        console.log('');
      });
    }
    
    // Find user's stories
    const userStories = await storiesCollection.find({ user_id: user._id }).toArray();
    console.log(`\n📊 Stories by ${user.username}: ${userStories.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkStories();

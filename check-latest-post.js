// Check latest post structure
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkLatestPost() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }), 'posts');

    console.log('\n🔍 Finding latest post...');
    const latestPost = await Post.findOne().sort({ created_at: -1 });
    
    if (!latestPost) {
      console.log('❌ No posts found');
      process.exit(0);
    }

    console.log('\n📊 Latest Post Structure:');
    console.log('ID:', latestPost._id.toString());
    console.log('User ID:', latestPost.user_id);
    console.log('Content:', latestPost.content?.substring(0, 50));
    console.log('Media Type:', latestPost.media_type);
    console.log('Type:', latestPost.type);
    console.log('Media URLs:', latestPost.media_urls);
    console.log('Has media_urls[0]:', !!latestPost.media_urls?.[0]);
    console.log('Created:', latestPost.created_at);
    
    console.log('\n📸 What backend will return:');
    console.log('image_url:', latestPost.media_urls && latestPost.media_urls[0] ? latestPost.media_urls[0] : null);
    console.log('type:', latestPost.type || (latestPost.media_type === 'video' ? 'reel' : 'post'));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkLatestPost();

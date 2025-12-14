// Find which user has posts
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function findUserWithPosts() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }), 'posts');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    console.log('\n🔍 Finding latest post...');
    const latestPost = await Post.findOne().sort({ created_at: -1 });
    
    if (!latestPost) {
      console.log('❌ No posts found');
      process.exit(0);
    }

    console.log('📊 Latest post ID:', latestPost._id.toString());
    console.log('User ID:', latestPost.user_id);

    // Find the user
    const user = await User.findById(latestPost.user_id);
    if (user) {
      console.log('\n👤 User who created this post:');
      console.log('Username:', user.username);
      console.log('Email:', user.email);
      console.log('Full Name:', user.full_name || user.fullName);
      
      // Count their posts
      const postCount = await Post.countDocuments({ user_id: user._id });
      console.log('Total posts:', postCount);
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

findUserWithPosts();

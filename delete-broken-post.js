// Delete post with missing image_url
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const POST_ID = '693513c5190be7fa0a52f12a'; // The broken post ID from logs

async function deletePost() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }), 'posts');

    console.log('\n🔍 Finding post:', POST_ID);
    const post = await Post.findById(POST_ID);
    
    if (!post) {
      console.log('❌ Post not found');
      process.exit(0);
    }

    console.log('📊 Post data:', JSON.stringify(post, null, 2));
    console.log('\n⚠️  Deleting post...');
    
    await Post.findByIdAndDelete(POST_ID);
    console.log('✅ Post deleted successfully!');
    
    console.log('\n💡 Now create a new post with proper image from the app');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

deletePost();

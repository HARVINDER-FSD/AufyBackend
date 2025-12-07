// Check if user has posts in database
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';

async function checkUserPosts() {
  console.log('🔍 Checking user posts in database...\n');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();

  try {
    // Find user
    const user = await db.collection('users').findOne({ username: 'krinaprajapati24' });
    
    if (!user) {
      console.log('❌ User not found!');
      await client.close();
      return;
    }

    console.log('✅ User found:');
    console.log('   ID:', user._id);
    console.log('   Username:', user.username);
    console.log('   Name:', user.full_name || user.name);
    console.log('   Is Private:', user.is_private || false);
    console.log('');

    // Find posts
    const posts = await db.collection('posts').find({
      user_id: user._id,
      is_archived: { $ne: true }
    }).toArray();

    console.log('📊 Posts found:', posts.length);
    
    if (posts.length > 0) {
      console.log('\nPost details:');
      posts.forEach((post, index) => {
        console.log(`\n  Post ${index + 1}:`);
        console.log('    ID:', post._id);
        console.log('    Caption:', post.caption?.substring(0, 50) || 'No caption');
        console.log('    Media Type:', post.media_type);
        console.log('    Image URL:', post.image_url || 'MISSING!');
        console.log('    Media URLs:', post.media_urls?.length || 0, 'items');
        console.log('    Created:', post.created_at);
        console.log('    Archived:', post.is_archived || false);
      });
    } else {
      console.log('\n⚠️  No posts found for this user!');
      console.log('   The user needs to create a post first.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkUserPosts();

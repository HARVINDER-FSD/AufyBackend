require('dotenv').config();
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

async function resetAndSeed() {
  console.log('🚀 Starting complete reset and seed process...\n');
  
  const client = await MongoClient.connect(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  
  try {
    const db = client.db();
    
    // Step 1: Count existing users
    console.log('📊 Step 1: Checking existing data...');
    const userCount = await db.collection('users').countDocuments();
    const postCount = await db.collection('posts').countDocuments();
    const reelCount = await db.collection('reels').countDocuments();
    console.log(`   Users: ${userCount}`);
    console.log(`   Posts: ${postCount}`);
    console.log(`   Reels: ${reelCount}\n`);

    // Step 2: Clear Cloudinary
    console.log('🗑️  Step 2: Clearing Cloudinary data...');
    try {
      // Get all resources from Cloudinary
      const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
      const response = await axios.get(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      
      const resources = response.data.resources || [];
      console.log(`   Found ${resources.length} resources in Cloudinary`);
      
      // Delete each resource
      for (const resource of resources) {
        try {
          await axios.delete(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload`,
            {
              headers: { Authorization: `Basic ${auth}` },
              data: { public_ids: [resource.public_id] }
            }
          );
          console.log(`   ✓ Deleted: ${resource.public_id}`);
        } catch (err) {
          console.log(`   ✗ Failed to delete: ${resource.public_id}`);
        }
      }
      console.log('   ✅ Cloudinary cleared\n');
    } catch (error) {
      console.log('   ⚠️  Could not clear Cloudinary:', error.message, '\n');
    }

    // Step 3: Delete all old data
    console.log('🗑️  Step 3: Deleting old database data...');
    const collections = ['users', 'posts', 'reels', 'likes', 'comments', 'follows', 'search_history'];
    
    for (const collection of collections) {
      const result = await db.collection(collection).deleteMany({});
      console.log(`   ✓ Deleted ${result.deletedCount} documents from ${collection}`);
    }
    console.log('');

    // Step 4: Create fresh users
    console.log('👥 Step 4: Creating fresh users...');
    const newUsers = [
      {
        _id: new ObjectId(),
        username: 'rajesh_kumar',
        full_name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        password: 'hashed_password_123',
        avatar_url: 'https://via.placeholder.com/150?text=Rajesh',
        bio: 'Software Developer | Tech Enthusiast',
        is_verified: true,
        followers_count: 250,
        following_count: 180,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        _id: new ObjectId(),
        username: 'priya_sharma',
        full_name: 'Priya Sharma',
        email: 'priya@example.com',
        password: 'hashed_password_456',
        avatar_url: 'https://via.placeholder.com/150?text=Priya',
        bio: 'Graphic Designer | Creative Mind',
        is_verified: true,
        followers_count: 380,
        following_count: 220,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        _id: new ObjectId(),
        username: 'amit_patel',
        full_name: 'Amit Patel',
        email: 'amit@example.com',
        password: 'hashed_password_789',
        avatar_url: 'https://via.placeholder.com/150?text=Amit',
        bio: 'Content Creator | Photographer',
        is_verified: false,
        followers_count: 520,
        following_count: 310,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        _id: new ObjectId(),
        username: 'neha_singh',
        full_name: 'Neha Singh',
        email: 'neha@example.com',
        password: 'hashed_password_101',
        avatar_url: 'https://via.placeholder.com/150?text=Neha',
        bio: 'Fitness Coach | Health Enthusiast',
        is_verified: true,
        followers_count: 650,
        following_count: 420,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        _id: new ObjectId(),
        username: 'vikram_reddy',
        full_name: 'Vikram Reddy',
        email: 'vikram@example.com',
        password: 'hashed_password_202',
        avatar_url: 'https://via.placeholder.com/150?text=Vikram',
        bio: 'Music Producer | DJ',
        is_verified: false,
        followers_count: 420,
        following_count: 280,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const usersResult = await db.collection('users').insertMany(newUsers);
    console.log(`   ✅ Created ${usersResult.insertedCount} new users\n`);

    // Step 5: Create fresh posts
    console.log('📝 Step 5: Creating fresh posts...');
    const newPosts = [
      {
        _id: new ObjectId(),
        user_id: newUsers[0]._id,
        caption: 'Just launched my new project! 🚀 Check it out',
        description: 'Excited to share my latest work with everyone',
        media_urls: ['https://via.placeholder.com/600x400?text=Project+Launch'],
        likes_count: 156,
        comments_count: 42,
        shares_count: 28,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[1]._id,
        caption: 'New design system completed! 🎨✨',
        description: 'Spent weeks perfecting this design',
        media_urls: ['https://via.placeholder.com/600x400?text=Design+System'],
        likes_count: 234,
        comments_count: 67,
        shares_count: 45,
        created_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[2]._id,
        caption: 'Golden hour photography session 📸🌅',
        description: 'Nature is the best photographer',
        media_urls: ['https://via.placeholder.com/600x400?text=Golden+Hour'],
        likes_count: 389,
        comments_count: 95,
        shares_count: 67,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[3]._id,
        caption: 'Morning workout motivation! 💪🔥',
        description: 'Start your day with energy',
        media_urls: ['https://via.placeholder.com/600x400?text=Workout'],
        likes_count: 512,
        comments_count: 128,
        shares_count: 89,
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[4]._id,
        caption: 'New track dropping soon! 🎵🎧',
        description: 'Working on something special',
        media_urls: ['https://via.placeholder.com/600x400?text=Music+Studio'],
        likes_count: 278,
        comments_count: 73,
        shares_count: 52,
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
        is_archived: false
      }
    ];

    const postsResult = await db.collection('posts').insertMany(newPosts);
    console.log(`   ✅ Created ${postsResult.insertedCount} new posts\n`);

    // Step 6: Create fresh reels
    console.log('🎬 Step 6: Creating fresh reels...');
    const newReels = [
      {
        _id: new ObjectId(),
        user_id: newUsers[0]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel+1',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel+1',
        caption: 'Quick coding tips 💻⚡',
        likes_count: 445,
        views_count: 2100,
        comments_count: 112,
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[1]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel+2',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel+2',
        caption: 'Design process timelapse 🎨✨',
        likes_count: 678,
        views_count: 3400,
        comments_count: 189,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[2]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel+3',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel+3',
        caption: 'Photography behind the scenes 📸',
        likes_count: 823,
        views_count: 4200,
        comments_count: 234,
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[3]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel+4',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel+4',
        caption: 'Fitness transformation 💪🔥',
        likes_count: 1200,
        views_count: 5800,
        comments_count: 356,
        created_at: new Date(Date.now() - 30 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: newUsers[4]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel+5',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel+5',
        caption: 'Studio session highlights 🎵🎧',
        likes_count: 567,
        views_count: 2900,
        comments_count: 145,
        created_at: new Date(Date.now() - 15 * 60 * 1000),
        is_archived: false
      }
    ];

    const reelsResult = await db.collection('reels').insertMany(newReels);
    console.log(`   ✅ Created ${reelsResult.insertedCount} new reels\n`);

    // Step 7: Create some follows
    console.log('👥 Step 7: Creating follow relationships...');
    const follows = [
      { follower_id: newUsers[0]._id, following_id: newUsers[1]._id, created_at: new Date() },
      { follower_id: newUsers[0]._id, following_id: newUsers[2]._id, created_at: new Date() },
      { follower_id: newUsers[1]._id, following_id: newUsers[0]._id, created_at: new Date() },
      { follower_id: newUsers[2]._id, following_id: newUsers[3]._id, created_at: new Date() },
      { follower_id: newUsers[3]._id, following_id: newUsers[4]._id, created_at: new Date() },
      { follower_id: newUsers[4]._id, following_id: newUsers[0]._id, created_at: new Date() }
    ];

    const followsResult = await db.collection('follows').insertMany(follows);
    console.log(`   ✅ Created ${followsResult.insertedCount} follow relationships\n`);

    // Summary
    console.log('✨ ✨ ✨ RESET AND SEED COMPLETED ✨ ✨ ✨\n');
    console.log('📊 Final Summary:');
    console.log(`   Users: ${usersResult.insertedCount}`);
    console.log(`   Posts: ${postsResult.insertedCount}`);
    console.log(`   Reels: ${reelsResult.insertedCount}`);
    console.log(`   Follows: ${followsResult.insertedCount}\n`);
    
    console.log('👥 New Users Created:');
    newUsers.forEach(u => console.log(`   @${u.username} - ${u.full_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

resetAndSeed();

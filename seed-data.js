require('dotenv').config();
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function seedData() {
  console.log('🌱 Starting data seeding...');
  
  const client = await MongoClient.connect(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  
  try {
    const db = client.db();
    
    // Create test users
    const users = [
      {
        _id: new ObjectId(),
        username: 'monu',
        full_name: 'Monu Kumar',
        email: 'monu@example.com',
        avatar_url: 'https://via.placeholder.com/150?text=Monu',
        is_verified: true,
        followers_count: 150,
        following_count: 50,
        bio: 'Tech enthusiast',
        created_at: new Date(),
        is_active: true
      },
      {
        _id: new ObjectId(),
        username: 'ayesha',
        full_name: 'Ayesha Khan',
        email: 'ayesha@example.com',
        avatar_url: 'https://via.placeholder.com/150?text=Ayesha',
        is_verified: false,
        followers_count: 200,
        following_count: 100,
        bio: 'Designer & Artist',
        created_at: new Date(),
        is_active: true
      },
      {
        _id: new ObjectId(),
        username: 'harvinder',
        full_name: 'Harvinder Singh',
        email: 'harvinder@example.com',
        avatar_url: 'https://via.placeholder.com/150?text=Harvinder',
        is_verified: true,
        followers_count: 500,
        following_count: 200,
        bio: 'Developer & Creator',
        created_at: new Date(),
        is_active: true
      }
    ];

    // Insert users
    const usersResult = await db.collection('users').insertMany(users);
    console.log(`✅ Created ${usersResult.insertedCount} users`);

    // Create test posts
    const posts = [
      {
        _id: new ObjectId(),
        user_id: users[0]._id,
        caption: 'Beautiful sunset today! 🌅',
        description: 'Enjoying the evening',
        media_urls: ['https://via.placeholder.com/400x300?text=Sunset'],
        likes_count: 45,
        comments_count: 12,
        shares_count: 5,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: users[1]._id,
        caption: 'New design project completed! 🎨',
        description: 'Check out my latest work',
        media_urls: ['https://via.placeholder.com/400x300?text=Design'],
        likes_count: 120,
        comments_count: 35,
        shares_count: 20,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: users[2]._id,
        caption: 'Coding session with coffee ☕',
        description: 'Building something awesome',
        media_urls: ['https://via.placeholder.com/400x300?text=Coding'],
        likes_count: 200,
        comments_count: 50,
        shares_count: 30,
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
        is_archived: false
      }
    ];

    const postsResult = await db.collection('posts').insertMany(posts);
    console.log(`✅ Created ${postsResult.insertedCount} posts`);

    // Create test reels
    const reels = [
      {
        _id: new ObjectId(),
        user_id: users[0]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel1',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel1',
        caption: 'Quick dance moves 💃',
        likes_count: 300,
        views_count: 1500,
        comments_count: 80,
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
        is_archived: false
      },
      {
        _id: new ObjectId(),
        user_id: users[1]._id,
        video_url: 'https://via.placeholder.com/400x600?text=Reel2',
        thumbnail_url: 'https://via.placeholder.com/400x600?text=Reel2',
        caption: 'Art timelapse 🎨',
        likes_count: 450,
        views_count: 2500,
        comments_count: 120,
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000),
        is_archived: false
      }
    ];

    const reelsResult = await db.collection('reels').insertMany(reels);
    console.log(`✅ Created ${reelsResult.insertedCount} reels`);

    console.log('\n✨ Data seeding completed successfully!');
    console.log('\nTest users created:');
    users.forEach(u => console.log(`  - @${u.username} (${u.full_name})`));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

seedData();

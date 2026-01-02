const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function createTestAyeshaUser() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Creating test Ayesha user');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ username: "ft_.ayesha_" });
    
    if (existingUser) {
      console.log('✅ User ft_.ayesha_ already exists');
      console.log('User details:', existingUser);
      return;
    }
    
    // Create a test user with avatar issue (no avatar set)
    const testUser = {
      username: "ft_.ayesha_",
      fullName: "Ayesha Khan",
      email: "ayesha@test.com",
      password: "$2b$10$example", // This would be hashed in real scenario
      // Intentionally NOT setting profileImage, avatar_url, or avatar
      // This will cause the avatar issue you mentioned
      createdAt: new Date(),
      lastLogin: new Date(),
      isVerified: false,
      followers: 0,
      following: 0,
      posts: 0
    };
    
    const result = await usersCollection.insertOne(testUser);
    console.log('✅ Created test user ft_.ayesha_');
    console.log('User ID:', result.insertedId);
    
    // Now create a test message to show the avatar issue
    const messagesCollection = db.collection('messages');
    
    const testMessage = {
      senderId: result.insertedId.toString(),
      senderName: "ft_.ayesha_",
      // Intentionally NOT setting senderAvatar - this causes the issue
      receiverId: "existing_user_id", // This would be a real user ID
      text: "Hello, this is a test message from Ayesha",
      createdAt: new Date(),
      timestamp: new Date()
    };
    
    const messageResult = await messagesCollection.insertOne(testMessage);
    console.log('✅ Created test message');
    console.log('Message ID:', messageResult.insertedId);
    
    console.log('\n🎯 Avatar Issue Demonstration:');
    console.log('The user ft_.ayesha_ has been created WITHOUT any avatar fields:');
    console.log('- No profileImage');
    console.log('- No avatar_url');
    console.log('- No avatar');
    console.log('\nThis will cause the avatar to not show properly in the messages page.');
    console.log('\n🔧 To fix this, you need to:');
    console.log('1. Set a profileImage URL for the user');
    console.log('2. Update the message to include senderAvatar');
    console.log('3. Or implement a fallback avatar system');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await client.close();
  }
}

// Run the creation
createTestAyeshaUser().catch(console.error);
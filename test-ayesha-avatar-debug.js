const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function debugAyeshaAvatar() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Debugging Ayesha avatar issue');
    
    const db = client.db('anufy');
    const usersCollection = db.collection('users');
    
    // Search for users with "ayesha" in their name/username (case insensitive)
    console.log('\n📋 Searching for users with "ayesha" in name/username...');
    const ayeshaUsers = await usersCollection.find({
      $or: [
        { username: { $regex: /ayesha/i } },
        { fullName: { $regex: /ayesha/i } },
        { name: { $regex: /ayesha/i } },
        { full_name: { $regex: /ayesha/i } }
      ]
    }).toArray();
    
    console.log(`\n✅ Found ${ayeshaUsers.length} users matching "ayesha":`);
    
    ayeshaUsers.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Full Name: ${user.fullName || user.full_name || user.name || 'N/A'}`);
      console.log(`   Profile Image: ${user.profileImage || 'NOT SET'}`);
      console.log(`   Avatar URL: ${user.avatar_url || 'NOT SET'}`);
      console.log(`   Avatar: ${user.avatar || 'NOT SET'}`);
      console.log(`   Created At: ${user.createdAt || user.created_at || 'N/A'}`);
      
      // Check which avatar field has a value
      const avatarFields = [
        { name: 'profileImage', value: user.profileImage },
        { name: 'avatar_url', value: user.avatar_url },
        { name: 'avatar', value: user.avatar }
      ];
      
      const validAvatars = avatarFields.filter(field => field.value && field.value.trim() !== '');
      console.log(`   Valid Avatar Fields: ${validAvatars.length > 0 ? validAvatars.map(f => `${f.name}: ${f.value}`).join(', ') : 'NONE'}`);
      
      // Generate fallback avatar URL
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=0095f6&color=fff&size=128`;
      console.log(`   Fallback Avatar: ${fallbackUrl}`);
    });
    
    // Also check conversations involving these users
    console.log('\n📨 Checking conversations involving Ayesha users...');
    const conversationsCollection = db.collection('conversations');
    
    for (const user of ayeshaUsers) {
      const conversations = await conversationsCollection.find({
        participants: user._id.toString()
      }).toArray();
      
      console.log(`\n💬 User ${user.username} has ${conversations.length} conversations`);
      conversations.forEach((conv, index) => {
        console.log(`   Conversation ${index + 1}: ${conv._id}`);
        console.log(`   Participants: ${conv.participants.join(', ')}`);
        console.log(`   Last Message: ${conv.lastMessage?.content || 'N/A'}`);
      });
    }
    
    // Check if there are any specific avatar loading issues
    console.log('\n🔍 Avatar URL Analysis:');
    ayeshaUsers.forEach(user => {
      const avatarUrl = user.profileImage || user.avatar_url || user.avatar;
      if (avatarUrl) {
        console.log(`\n🖼️  ${user.username} avatar URL: ${avatarUrl}`);
        
        // Check if URL looks valid
        if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
          console.log('   ✅ URL format looks valid');
        } else {
          console.log('   ❌ URL format looks invalid - missing protocol');
        }
        
        // Check for common issues
        if (avatarUrl.includes(' ')) {
          console.log('   ⚠️  URL contains spaces - may cause loading issues');
        }
        
        if (avatarUrl.length > 500) {
          console.log('   ⚠️  URL is very long - may cause issues');
        }
        
        if (avatarUrl.includes('localhost') || avatarUrl.includes('127.0.0.1')) {
          console.log('   ❌ URL points to localhost - will not work on mobile');
        }
      } else {
        console.log(`\n❌ ${user.username} has NO avatar URL set`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error debugging Ayesha avatar:', error);
  } finally {
    await client.close();
  }
}

// Run the debug
debugAyeshaAvatar().catch(console.error);
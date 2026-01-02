const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function debugAyeshaAvatar() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Debugging Ayesha avatar issue');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Search for the specific user "ft_.ayesha_"
    const ayeshaUsers = await usersCollection.find({
      $or: [
        { username: "ft_.ayesha_" },
        { username: { $regex: /ft_\.ayesha_/i } },
        { username: { $regex: /ayesha/i } },
        { fullName: { $regex: /ayesha/i } },
        { full_name: { $regex: /ayesha/i } },
        { name: { $regex: /ayesha/i } }
      ]
    }).toArray();
    
    console.log(`\n🎯 Found ${ayeshaUsers.length} users matching "ft_.ayesha_" or similar:`);
    
    if (ayeshaUsers.length > 0) {
      ayeshaUsers.forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Full Name: ${user.fullName || user.full_name || user.name || 'Not set'}`);
        console.log(`   Email: ${user.email || 'Not set'}`);
        
        // Check all possible avatar fields
        const avatarFields = {
          profileImage: user.profileImage,
          avatar_url: user.avatar_url,
          avatar: user.avatar,
          profilePicture: user.profilePicture,
          image: user.image,
          photo: user.photo
        };
        
        console.log(`\n   📸 Avatar Fields:`);
        Object.entries(avatarFields).forEach(([field, value]) => {
          if (value) {
            console.log(`     ${field}: ${value}`);
          } else {
            console.log(`     ${field}: ❌ NOT SET`);
          }
        });
        
        // Determine the primary avatar URL
        const primaryAvatar = user.profileImage || user.avatar_url || user.avatar || user.profilePicture || user.image || user.photo;
        
        if (!primaryAvatar) {
          console.log(`\n   🚨 ISSUE FOUND: NO AVATAR URL SET`);
          console.log(`   📝 This user will show a fallback/default avatar`);
          console.log(`   🔧 Fallback URL would be: https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=0095f6&color=fff&size=128`);
        } else {
          console.log(`\n   ✅ Primary Avatar: ${primaryAvatar}`);
          
          // Check for common avatar issues
          const issues = [];
          
          if (!primaryAvatar.startsWith('http')) {
            issues.push('Missing protocol (http/https)');
          }
          
          if (primaryAvatar.includes('localhost') || primaryAvatar.includes('127.0.0.1')) {
            issues.push('Points to localhost (won\'t work on mobile)');
          }
          
          if (primaryAvatar.includes(' ')) {
            issues.push('Contains spaces');
          }
          
          if (primaryAvatar.length > 500) {
            issues.push(`Very long URL (${primaryAvatar.length} characters)`);
          }
          
          if (primaryAvatar.includes('data:image')) {
            issues.push('Base64 encoded image (might be too large)');
          }
          
          if (issues.length > 0) {
            console.log(`\n   ⚠️  POTENTIAL ISSUES:`);
            issues.forEach(issue => console.log(`     - ${issue}`));
          } else {
            console.log(`\n   ✅ Avatar URL looks good`);
          }
        }
        
        // Check user creation date
        if (user.createdAt) {
          console.log(`\n   📅 Created: ${user.createdAt}`);
        }
        
        // Check if user is active
        if (user.lastLogin) {
          console.log(`   🕐 Last Login: ${user.lastLogin}`);
        }
      });
      
      // Now check messages collection to see how this user appears in messages
      console.log(`\n\n💬 Checking messages collection for Ayesha users...`);
      
      const messagesCollection = db.collection('messages');
      
      for (const user of ayeshaUsers) {
        console.log(`\n📨 Messages involving ${user.username}:`);
        
        // Check messages sent by this user
        const sentMessages = await messagesCollection.find({
          senderId: user._id.toString()
        }).limit(3).toArray();
        
        console.log(`   Sent messages: ${sentMessages.length} found`);
        sentMessages.forEach((msg, i) => {
          console.log(`     Message ${i + 1}:`);
          console.log(`       Sender ID: ${msg.senderId}`);
          console.log(`       Sender Name: ${msg.senderName || 'Not set'}`);
          console.log(`       Sender Avatar: ${msg.senderAvatar || 'Not set'}`);
          console.log(`       Text: ${msg.text ? msg.text.substring(0, 50) + '...' : 'No text'}`);
        });
        
        // Check messages received by this user
        const receivedMessages = await messagesCollection.find({
          receiverId: user._id.toString()
        }).limit(3).toArray();
        
        console.log(`   Received messages: ${receivedMessages.length} found`);
      }
      
    } else {
      console.log('\n❌ No users found with "Ayesha" in their name');
      
      // Show all users for reference
      console.log('\n📝 All users in database:');
      const allUsers = await usersCollection.find({}).limit(10).toArray();
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name || 'No name'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging Ayesha avatar:', error);
  } finally {
    await client.close();
  }
}

// Run the debug
debugAyeshaAvatar().catch(console.error);
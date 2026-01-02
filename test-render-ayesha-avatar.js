const { MongoClient } = require('mongodb');

// Use your correct Render backend MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function testRenderAyeshaAvatar() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to Render MongoDB - Debugging Ayesha avatar issue');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Search for the specific user "ft_.ayesha_"
    console.log('\n🔍 Searching for ft_.ayesha_ user...');
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
    
    console.log(`\n🎯 Found ${ayeshaUsers.length} users matching "ayesha":`);
    
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
        
        console.log(`\n   📸 Avatar Fields Analysis:`);
        let hasAvatar = false;
        Object.entries(avatarFields).forEach(([field, value]) => {
          if (value) {
            console.log(`     ✅ ${field}: ${value}`);
            hasAvatar = true;
          } else {
            console.log(`     ❌ ${field}: NOT SET`);
          }
        });
        
        // Determine the primary avatar URL that should be used
        const primaryAvatar = user.profileImage || user.avatar_url || user.avatar || user.profilePicture || user.image || user.photo;
        
        if (!hasAvatar) {
          console.log(`\n   🚨 AVATAR ISSUE CONFIRMED: NO AVATAR URL SET`);
          console.log(`   📝 This user will show a fallback/default avatar in messages`);
          console.log(`   🔧 Fallback URL: https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=0095f6&color=fff&size=128`);
          
          // Suggest fix
          console.log(`\n   💡 SUGGESTED FIX:`);
          console.log(`   1. Set a profileImage URL for this user`);
          console.log(`   2. Or ensure the frontend properly handles missing avatars with fallback`);
          
        } else {
          console.log(`\n   ✅ Primary Avatar Found: ${primaryAvatar}`);
          
          // Check for common avatar URL issues
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
            console.log(`\n   ⚠️  POTENTIAL AVATAR URL ISSUES:`);
            issues.forEach(issue => console.log(`     - ${issue}`));
          } else {
            console.log(`\n   ✅ Avatar URL looks good - issue might be in frontend rendering`);
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
          $or: [
            { senderId: user._id.toString() },
            { senderId: user._id },
            { senderName: user.username }
          ]
        }).limit(5).toArray();
        
        console.log(`   📤 Sent messages: ${sentMessages.length} found`);
        sentMessages.forEach((msg, i) => {
          console.log(`     Message ${i + 1}:`);
          console.log(`       Sender ID: ${msg.senderId}`);
          console.log(`       Sender Name: ${msg.senderName || 'Not set'}`);
          console.log(`       Sender Avatar: ${msg.senderAvatar || '❌ NOT SET'}`);
          console.log(`       Text: ${msg.text ? msg.text.substring(0, 50) + '...' : 'No text'}`);
          console.log(`       Created: ${msg.createdAt || msg.timestamp || 'No timestamp'}`);
        });
        
        // Check messages received by this user
        const receivedMessages = await messagesCollection.find({
          $or: [
            { receiverId: user._id.toString() },
            { receiverId: user._id }
          ]
        }).limit(3).toArray();
        
        console.log(`   📥 Received messages: ${receivedMessages.length} found`);
      }
      
    } else {
      console.log('\n❌ No users found with "Ayesha" in their name on Render backend');
      
      // Show all users for reference
      console.log('\n📝 All users in Render database:');
      const allUsers = await usersCollection.find({}).limit(10).toArray();
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name || 'No name'})`);
        if (user.profileImage || user.avatar_url || user.avatar) {
          console.log(`      Avatar: ${user.profileImage || user.avatar_url || user.avatar}`);
        } else {
          console.log(`      Avatar: ❌ NOT SET`);
        }
      });
    }
    
    // Check if there are any conversations involving Ayesha users
    console.log(`\n\n🔥 Checking Firebase conversations collection...`);
    try {
      const conversationsCollection = db.collection('conversations');
      const conversations = await conversationsCollection.find({}).limit(10).toArray();
      console.log(`   Found ${conversations.length} conversations in Firebase collection`);
      
      // Look for conversations that might involve Ayesha
      const ayeshaConversations = conversations.filter(conv => 
        conv.participants && conv.participants.some(p => 
          ayeshaUsers.some(user => user._id.toString() === p || user._id === p)
        )
      );
      
      console.log(`   Found ${ayeshaConversations.length} conversations involving Ayesha users`);
      
    } catch (error) {
      console.log('   No Firebase conversations collection found or error accessing it');
    }
    
  } catch (error) {
    console.error('❌ Error debugging Ayesha avatar on Render:', error);
  } finally {
    await client.close();
  }
}

// Run the debug
testRenderAyeshaAvatar().catch(console.error);
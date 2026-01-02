const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function checkMessagesForAyesha() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Checking messages for Ayesha references');
    
    const db = client.db('socialmedia');
    const messagesCollection = db.collection('messages');
    
    // Search for any messages that mention Ayesha
    const ayeshaMessages = await messagesCollection.find({
      $or: [
        { senderName: { $regex: /ayesha/i } },
        { receiverName: { $regex: /ayesha/i } },
        { text: { $regex: /ayesha/i } }
      ]
    }).toArray();
    
    console.log(`\n💬 Found ${ayeshaMessages.length} messages mentioning "Ayesha"`);
    
    if (ayeshaMessages.length > 0) {
      ayeshaMessages.forEach((msg, index) => {
        console.log(`\n📨 Message ${index + 1}:`);
        console.log(`   ID: ${msg._id}`);
        console.log(`   Sender ID: ${msg.senderId}`);
        console.log(`   Sender Name: ${msg.senderName || 'Not set'}`);
        console.log(`   Sender Avatar: ${msg.senderAvatar || 'Not set'}`);
        console.log(`   Receiver ID: ${msg.receiverId}`);
        console.log(`   Receiver Name: ${msg.receiverName || 'Not set'}`);
        console.log(`   Text: ${msg.text || 'No text'}`);
        console.log(`   Created: ${msg.createdAt || msg.timestamp || 'No timestamp'}`);
        
        if (msg.senderAvatar) {
          console.log(`\n   🔍 Avatar Analysis:`);
          if (!msg.senderAvatar.startsWith('http')) {
            console.log(`     ⚠️  Avatar missing protocol: ${msg.senderAvatar}`);
          } else if (msg.senderAvatar.includes('localhost')) {
            console.log(`     ⚠️  Avatar points to localhost: ${msg.senderAvatar}`);
          } else {
            console.log(`     ✅ Avatar URL looks valid: ${msg.senderAvatar}`);
          }
        } else {
          console.log(`     ❌ No avatar URL in message`);
        }
      });
    }
    
    // Also check for any orphaned messages (messages with sender/receiver IDs that don't exist in users)
    console.log(`\n\n🔍 Checking for orphaned messages...`);
    
    const allMessages = await messagesCollection.find({}).limit(20).toArray();
    const usersCollection = db.collection('users');
    
    console.log(`\n📊 Recent messages (showing avatar info):`);
    
    for (let i = 0; i < Math.min(10, allMessages.length); i++) {
      const msg = allMessages[i];
      console.log(`\n📨 Message ${i + 1}:`);
      console.log(`   Sender ID: ${msg.senderId}`);
      console.log(`   Sender Name: ${msg.senderName || 'Not set'}`);
      console.log(`   Sender Avatar: ${msg.senderAvatar || 'Not set'}`);
      console.log(`   Text: ${msg.text ? msg.text.substring(0, 50) + '...' : 'No text'}`);
      
      // Check if sender exists in users collection
      if (msg.senderId) {
        const senderExists = await usersCollection.findOne({ _id: msg.senderId });
        if (!senderExists) {
          console.log(`   ⚠️  ORPHANED: Sender ID ${msg.senderId} not found in users collection`);
        }
      }
      
      // Check avatar issues
      if (msg.senderAvatar) {
        if (!msg.senderAvatar.startsWith('http')) {
          console.log(`   ⚠️  Avatar issue: Missing protocol`);
        } else if (msg.senderAvatar.includes('localhost')) {
          console.log(`   ⚠️  Avatar issue: Points to localhost`);
        }
      } else {
        console.log(`   ❌ No avatar in message`);
      }
    }
    
    // Check if there are any users with similar names
    console.log(`\n\n🔍 Checking for users with similar names...`);
    const similarUsers = await usersCollection.find({
      $or: [
        { username: { $regex: /aisha|aysha|aesha|ayesha/i } },
        { fullName: { $regex: /aisha|aysha|aesha|ayesha/i } },
        { full_name: { $regex: /aisha|aysha|aesha|ayesha/i } },
        { name: { $regex: /aisha|aysha|aesha|ayesha/i } }
      ]
    }).toArray();
    
    if (similarUsers.length > 0) {
      console.log(`\n👥 Found ${similarUsers.length} users with similar names:`);
      similarUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name})`);
      });
    } else {
      console.log(`\n❌ No users found with similar names to Ayesha`);
    }
    
  } catch (error) {
    console.error('❌ Error checking messages:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkMessagesForAyesha().catch(console.error);
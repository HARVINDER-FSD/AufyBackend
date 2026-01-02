const { MongoClient } = require('mongodb');

// Use your correct Render backend MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';

async function fixAyeshaAvatarIssue() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔧 Connected to MongoDB - Fixing Ayesha avatar issue');
    
    const db = client.db('socialmedia');
    const usersCollection = db.collection('users');
    
    // Find the specific user "ft_.ayesha_"
    const ayeshaUser = await usersCollection.findOne({ username: "ft_.ayesha_" });
    
    if (!ayeshaUser) {
      console.log('❌ User ft_.ayesha_ not found');
      return;
    }
    
    console.log('✅ Found user ft_.ayesha_');
    console.log('Current avatar status:', {
      profileImage: ayeshaUser.profileImage || 'NOT SET',
      avatar_url: ayeshaUser.avatar_url || 'NOT SET',
      avatar: ayeshaUser.avatar || 'NOT SET'
    });
    
    // Generate a proper avatar URL for this user
    const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(ayeshaUser.username)}&background=0095f6&color=fff&size=128`;
    
    // Option 1: Use a nice placeholder avatar
    const placeholderAvatarUrl = 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face';
    
    // Option 2: Use a generated avatar service
    const generatedAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${ayeshaUser.username}&backgroundColor=0095f6`;
    
    console.log('\n🎯 Available avatar options:');
    console.log('1. Fallback UI Avatar:', fallbackAvatarUrl);
    console.log('2. Nice placeholder:', placeholderAvatarUrl);
    console.log('3. Generated avatar:', generatedAvatarUrl);
    
    // Update the user with a proper avatar
    const updateResult = await usersCollection.updateOne(
      { username: "ft_.ayesha_" },
      {
        $set: {
          profileImage: placeholderAvatarUrl, // Use the nice placeholder
          avatar_url: placeholderAvatarUrl,   // Backup field
          avatar: placeholderAvatarUrl,       // Another backup field
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('\n✅ Successfully updated ft_.ayesha_ avatar!');
      console.log('New avatar URL:', placeholderAvatarUrl);
      
      // Verify the update
      const updatedUser = await usersCollection.findOne({ username: "ft_.ayesha_" });
      console.log('\n📸 Updated avatar fields:');
      console.log('  profileImage:', updatedUser.profileImage);
      console.log('  avatar_url:', updatedUser.avatar_url);
      console.log('  avatar:', updatedUser.avatar);
      
    } else {
      console.log('❌ Failed to update user avatar');
    }
    
    // Now update any existing messages from this user to include the avatar
    console.log('\n💬 Updating messages to include sender avatar...');
    const messagesCollection = db.collection('messages');
    
    const messageUpdateResult = await messagesCollection.updateMany(
      { 
        $or: [
          { senderId: ayeshaUser._id.toString() },
          { senderId: ayeshaUser._id },
          { senderName: "ft_.ayesha_" }
        ]
      },
      {
        $set: {
          senderAvatar: placeholderAvatarUrl,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Updated ${messageUpdateResult.modifiedCount} messages with sender avatar`);
    
    // Check if there are any Firebase conversations that need updating
    console.log('\n🔥 Checking Firebase conversations...');
    try {
      const conversationsCollection = db.collection('conversations');
      const conversations = await conversationsCollection.find({
        participants: { $in: [ayeshaUser._id.toString(), ayeshaUser._id] }
      }).toArray();
      
      console.log(`Found ${conversations.length} conversations involving ft_.ayesha_`);
      
      if (conversations.length > 0) {
        console.log('💡 Note: You may need to refresh the mobile app to see the updated avatar in conversations');
      }
      
    } catch (error) {
      console.log('No Firebase conversations collection found or error accessing it');
    }
    
    console.log('\n🎉 Avatar fix complete!');
    console.log('📱 The avatar should now display properly in the messages page');
    console.log('🔄 You may need to restart the mobile app to see the changes');
    
  } catch (error) {
    console.error('❌ Error fixing Ayesha avatar:', error);
  } finally {
    await client.close();
  }
}

// Run the fix
fixAyeshaAvatarIssue().catch(console.error);
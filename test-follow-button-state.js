// Test script to check follow button state issue
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function testFollowButtonState() {
  console.log('🔍 Testing Follow Button State Issue\n');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  try {
    // Get your user (Its.harvinder.05)
    const currentUser = await db.collection('users').findOne({ 
      username: 'Its.harvinder.05' 
    });
    
    if (!currentUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 Current User:', currentUser.username);
    console.log('   User ID:', currentUser._id.toString());
    
    // Get following list (what /api/users/:userId/following returns)
    const followingRecords = await db.collection('follows').find({
      followerId: new ObjectId(currentUser._id),
      status: 'accepted'
    }).toArray();
    
    console.log('\n📋 Following Records:', followingRecords.length);
    
    const followingIds = followingRecords.map(f => f.followingId);
    const followingUsers = await db.collection('users').find({
      _id: { $in: followingIds }
    }).toArray();
    
    console.log('\n✅ Following Users (API Response Format):');
    followingUsers.forEach(user => {
      console.log(`   - ${user.username}`);
      console.log(`     ID: ${user._id.toString()}`);
      console.log(`     API returns: { id: "${user._id.toString()}" }`);
    });
    
    // Get followers list
    const followersRecords = await db.collection('follows').find({
      followingId: new ObjectId(currentUser._id),
      status: 'accepted'
    }).toArray();
    
    console.log('\n📋 Followers Records:', followersRecords.length);
    
    const followerIds = followersRecords.map(f => f.followerId);
    const followerUsers = await db.collection('users').find({
      _id: { $in: followerIds }
    }).toArray();
    
    console.log('\n👥 Followers (who should show "Following" button):');
    followerUsers.forEach(user => {
      const isFollowingBack = followingIds.some(id => id.equals(user._id));
      console.log(`   - ${user.username}`);
      console.log(`     ID: ${user._id.toString()}`);
      console.log(`     You follow them back: ${isFollowingBack ? '✅ YES' : '❌ NO'}`);
      console.log(`     Button should show: ${isFollowingBack ? 'Following' : 'Follow'}`);
    });
    
    // Check mutual follows
    const mutualFollows = followerUsers.filter(user => 
      followingIds.some(id => id.equals(user._id))
    );
    
    console.log('\n🤝 Mutual Follows:', mutualFollows.length);
    mutualFollows.forEach(user => {
      console.log(`   - ${user.username} (ID: ${user._id.toString()})`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Following: ${followingUsers.length}`);
    console.log(`   Followers: ${followerUsers.length}`);
    console.log(`   Mutual: ${mutualFollows.length}`);
    
    console.log('\n🔍 FollowContext Check:');
    console.log('   FollowContext should have these IDs in followingUsers Set:');
    followingUsers.forEach(user => {
      console.log(`   - "${user._id.toString()}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testFollowButtonState();

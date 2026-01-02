const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function findAyeshaUser() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Finding Ayesha user');
    
    const db = client.db('anufy');
    const usersCollection = db.collection('users');
    
    // Get all users to see what we have
    console.log('\n📋 Getting all users to find Ayesha...');
    const allUsers = await usersCollection.find({}).toArray();
    
    console.log(`\n✅ Found ${allUsers.length} total users in database:`);
    
    // Look for any user that might be Ayesha (broader search)
    const possibleMatches = allUsers.filter(user => {
      const username = (user.username || '').toLowerCase();
      const fullName = (user.fullName || user.full_name || user.name || '').toLowerCase();
      
      return username.includes('ayesha') || 
             username.includes('aisha') || 
             username.includes('aysha') ||
             fullName.includes('ayesha') || 
             fullName.includes('aisha') || 
             fullName.includes('aysha') ||
             username.includes('aye') ||
             fullName.includes('aye');
    });
    
    console.log(`\n🎯 Found ${possibleMatches.length} possible matches for Ayesha:`);
    
    possibleMatches.forEach((user, index) => {
      console.log(`\n👤 Possible Match ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Full Name: ${user.fullName || user.full_name || user.name || 'N/A'}`);
      console.log(`   Profile Image: ${user.profileImage || 'NOT SET'}`);
      console.log(`   Avatar URL: ${user.avatar_url || 'NOT SET'}`);
      console.log(`   Avatar: ${user.avatar || 'NOT SET'}`);
    });
    
    // If no matches, show first 10 users to help identify
    if (possibleMatches.length === 0) {
      console.log('\n📝 No matches found. Here are the first 10 users in the database:');
      
      allUsers.slice(0, 10).forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Full Name: ${user.fullName || user.full_name || user.name || 'N/A'}`);
        console.log(`   Profile Image: ${user.profileImage || 'NOT SET'}`);
        console.log(`   Avatar URL: ${user.avatar_url || 'NOT SET'}`);
        console.log(`   Avatar: ${user.avatar || 'NOT SET'}`);
      });
    }
    
    // Check for users with avatar issues (no avatar set)
    console.log('\n🔍 Checking for users with missing avatars...');
    const usersWithoutAvatars = allUsers.filter(user => {
      return !user.profileImage && !user.avatar_url && !user.avatar;
    });
    
    console.log(`\n❌ Found ${usersWithoutAvatars.length} users without any avatar set:`);
    usersWithoutAvatars.slice(0, 5).forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.fullName || user.full_name || user.name || 'No name'})`);
    });
    
  } catch (error) {
    console.error('❌ Error finding Ayesha user:', error);
  } finally {
    await client.close();
  }
}

// Run the search
findAyeshaUser().catch(console.error);
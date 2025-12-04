// Test with user that has followers
const API_URL = 'http://localhost:5001';

async function test() {
  console.log('🧪 Testing with user that has followers...\n');

  // First, let's find a user with followers
  const { MongoClient } = require('mongodb');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true';
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  
  const users = await db.collection('users').find({ followers: { $gt: 0 } }).toArray();
  await client.close();
  
  if (users.length === 0) {
    console.log('❌ No users with followers found');
    return;
  }
  
  const testUser = users[0];
  console.log(`Found user: ${testUser.username} with ${testUser.followers} followers`);
  console.log(`User ID: ${testUser._id.toString()}`);
  
  // Now test the API
  // We need to login as any user to get a token
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'private.test@example.com',
      password: 'Test123!'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('❌ Login failed');
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  
  // Test followers endpoint
  console.log(`\nTesting followers for ${testUser.username}...`);
  const followersResponse = await fetch(`${API_URL}/api/users/${testUser._id.toString()}/followers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log(`Status: ${followersResponse.status}`);
  
  if (followersResponse.ok) {
    const data = await followersResponse.json();
    const followers = data.data || data || [];
    console.log(`✅ Got ${followers.length} followers:`);
    followers.forEach(f => console.log(`  - ${f.username}`));
  } else {
    console.error('❌ Failed:', await followersResponse.text());
  }
  
  // Test following endpoint
  console.log(`\nTesting following for ${testUser.username}...`);
  const followingResponse = await fetch(`${API_URL}/api/users/${testUser._id.toString()}/following`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log(`Status: ${followingResponse.status}`);
  
  if (followingResponse.ok) {
    const data = await followingResponse.json();
    const following = data.data || data || [];
    console.log(`✅ Got ${following.length} following:`);
    following.forEach(f => console.log(`  - ${f.username}`));
  } else {
    console.error('❌ Failed:', await followingResponse.text());
  }
}

test();

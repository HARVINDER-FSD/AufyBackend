// Test script for private accounts and follow requests system
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Test users
const user1 = {
  email: 'privateuser@test.com',
  password: 'Test123!',
  username: 'privateuser',
  fullName: 'Private User'
};

const user2 = {
  email: 'follower@test.com',
  password: 'Test123!',
  username: 'follower',
  fullName: 'Follower User'
};

let user1Token, user2Token, user1Id, user2Id;

async function register(user) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.log(`Registration response: ${error}`);
    return null;
  }
  
  const data = await response.json();
  return data;
}

async function login(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  return data;
}

async function makePrivate(token) {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ privateAccount: true })
  });
  
  return response.ok;
}

async function followUser(token, userId) {
  const response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  return data;
}

async function getFollowRequests(token) {
  const response = await fetch(`${API_URL}/api/users/follow-requests`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  return data;
}

async function acceptRequest(token, userId) {
  const response = await fetch(`${API_URL}/api/users/follow-requests/${userId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.ok;
}

async function rejectRequest(token, userId) {
  const response = await fetch(`${API_URL}/api/users/follow-requests/${userId}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.ok;
}

async function runTests() {
  console.log('🧪 Testing Private Accounts & Follow Requests System\n');
  
  // Step 1: Register or login users
  console.log('1️⃣ Setting up test users...');
  let result1 = await register(user1);
  if (!result1) {
    result1 = await login(user1.email, user1.password);
  }
  user1Token = result1.token;
  user1Id = result1.user.id;
  console.log(`✅ User 1 (${user1.username}): ${user1Id}`);
  
  let result2 = await register(user2);
  if (!result2) {
    result2 = await login(user2.email, user2.password);
  }
  user2Token = result2.token;
  user2Id = result2.user.id;
  console.log(`✅ User 2 (${user2.username}): ${user2Id}\n`);
  
  // Step 2: Make user1 private
  console.log('2️⃣ Making user1 account private...');
  const madePrivate = await makePrivate(user1Token);
  console.log(madePrivate ? '✅ Account is now private\n' : '❌ Failed to make private\n');
  
  // Step 3: User2 tries to follow user1
  console.log('3️⃣ User2 attempting to follow private user1...');
  const followResult = await followUser(user2Token, user1Id);
  console.log('Follow result:', followResult);
  
  if (followResult.isPending) {
    console.log('✅ Follow request created (pending)\n');
  } else if (followResult.isFollowing) {
    console.log('❌ Should be pending, but shows following\n');
  } else {
    console.log('❌ Unexpected result\n');
  }
  
  // Step 4: User1 checks follow requests
  console.log('4️⃣ User1 checking follow requests...');
  const requests = await getFollowRequests(user1Token);
  console.log('Follow requests:', requests);
  
  if (requests.data && requests.data.length > 0) {
    console.log(`✅ Found ${requests.data.length} follow request(s)\n`);
    
    // Step 5: User1 accepts the request
    console.log('5️⃣ User1 accepting follow request...');
    const accepted = await acceptRequest(user1Token, user2Id);
    console.log(accepted ? '✅ Request accepted\n' : '❌ Failed to accept\n');
    
    // Step 6: Verify user2 is now following
    console.log('6️⃣ Verifying follow status...');
    const verifyFollow = await followUser(user2Token, user1Id);
    console.log('Follow status:', verifyFollow);
    
    if (verifyFollow.isFollowing) {
      console.log('✅ User2 is now following user1\n');
    } else {
      console.log('❌ Follow status not updated\n');
    }
  } else {
    console.log('❌ No follow requests found\n');
  }
  
  // Test rejection flow
  console.log('7️⃣ Testing rejection flow...');
  console.log('User2 unfollowing user1...');
  await followUser(user2Token, user1Id); // Unfollow
  
  console.log('User2 requesting to follow again...');
  const followAgain = await followUser(user2Token, user1Id);
  
  if (followAgain.isPending) {
    console.log('✅ New follow request created');
    
    console.log('User1 rejecting request...');
    const rejected = await rejectRequest(user1Token, user2Id);
    console.log(rejected ? '✅ Request rejected\n' : '❌ Failed to reject\n');
    
    // Verify request is gone
    const requestsAfter = await getFollowRequests(user1Token);
    console.log(`Requests after rejection: ${requestsAfter.data?.length || 0}`);
    console.log(requestsAfter.data?.length === 0 ? '✅ Request removed\n' : '❌ Request still exists\n');
  }
  
  console.log('🎉 All tests completed!');
}

runTests().catch(console.error);

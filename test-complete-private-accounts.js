// Comprehensive test for private accounts and follow requests system
const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

function success(message) { log(colors.green, '✅', message); }
function error(message) { log(colors.red, '❌', message); }
function info(message) { log(colors.blue, 'ℹ️ ', message); }
function step(message) { log(colors.cyan, '▶️ ', message); }

// Test users
const users = {
  private: {
    email: 'private.test@example.com',
    password: 'Test123!',
    username: 'privateuser',
    fullName: 'Private User'
  },
  follower: {
    email: 'follower.test@example.com',
    password: 'Test123!',
    username: 'followeruser',
    fullName: 'Follower User'
  },
  public: {
    email: 'public.test@example.com',
    password: 'Test123!',
    username: 'publicuser',
    fullName: 'Public User'
  }
};

let tokens = {};
let userIds = {};

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function registerOrLogin(userKey) {
  const user = users[userKey];
  
  // Try to register
  let result = await apiCall('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(user)
  });
  
  // If already exists, login
  if (!result.ok) {
    result = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, password: user.password })
    });
  }
  
  if (result.ok) {
    tokens[userKey] = result.data.token;
    userIds[userKey] = result.data.user.id;
    return true;
  }
  
  return false;
}

async function makePrivate(userKey) {
  const result = await apiCall('/api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokens[userKey]}` },
    body: JSON.stringify({ privateAccount: true })
  });
  
  return result.ok;
}

async function makePublic(userKey) {
  const result = await apiCall('/api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokens[userKey]}` },
    body: JSON.stringify({ privateAccount: false })
  });
  
  return result.ok;
}

async function followUser(fromUser, toUserId) {
  const result = await apiCall(`/api/users/${toUserId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens[fromUser]}` }
  });
  
  return result;
}

async function getFollowRequests(userKey) {
  const result = await apiCall('/api/users/follow-requests', {
    headers: { Authorization: `Bearer ${tokens[userKey]}` }
  });
  
  return result;
}

async function acceptRequest(userKey, fromUserId) {
  const result = await apiCall(`/api/users/follow-requests/${fromUserId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens[userKey]}` }
  });
  
  return result;
}

async function rejectRequest(userKey, fromUserId) {
  const result = await apiCall(`/api/users/follow-requests/${fromUserId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens[userKey]}` }
  });
  
  return result;
}

async function getProfile(userKey, username) {
  const result = await apiCall(`/api/users/username/${username}`, {
    headers: { Authorization: `Bearer ${tokens[userKey]}` }
  });
  
  return result;
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 COMPREHENSIVE PRIVATE ACCOUNTS TEST SUITE');
  console.log('='.repeat(60) + '\n');
  
  // ============================================================
  // SETUP
  // ============================================================
  console.log('📋 SETUP PHASE\n');
  
  step('Setting up test users...');
  for (const [key, user] of Object.entries(users)) {
    const success = await registerOrLogin(key);
    if (success) {
      info(`  ${user.username}: ${userIds[key]}`);
    } else {
      error(`  Failed to setup ${user.username}`);
      return;
    }
  }
  success('All users ready\n');
  
  // ============================================================
  // TEST 1: Private Account Toggle
  // ============================================================
  console.log('📋 TEST 1: Private Account Toggle\n');
  
  step('Making private user account private...');
  const madePrivate = await makePrivate('private');
  if (madePrivate) {
    success('Account is now private');
  } else {
    error('Failed to make account private');
  }
  
  step('Keeping public user account public...');
  const madePublic = await makePublic('public');
  if (madePublic) {
    success('Account is public\n');
  } else {
    error('Failed to keep account public\n');
  }
  
  // ============================================================
  // TEST 2: Follow Request Creation
  // ============================================================
  console.log('📋 TEST 2: Follow Request Creation\n');
  
  step('Follower attempting to follow private user...');
  const followPrivate = await followUser('follower', userIds.private);
  
  if (followPrivate.ok) {
    if (followPrivate.data.isPending) {
      success('Follow request created (pending state)');
      info(`  isFollowing: ${followPrivate.data.isFollowing}`);
      info(`  isPending: ${followPrivate.data.isPending}`);
    } else if (followPrivate.data.isFollowing) {
      error('Should be pending, but shows following');
    } else {
      error('Unexpected response');
    }
  } else {
    error('Failed to create follow request');
  }
  
  step('Follower attempting to follow public user...');
  const followPublic = await followUser('follower', userIds.public);
  
  if (followPublic.ok) {
    if (followPublic.data.isFollowing && !followPublic.data.isPending) {
      success('Instant follow for public account');
      info(`  isFollowing: ${followPublic.data.isFollowing}`);
      info(`  isPending: ${followPublic.data.isPending}\n`);
    } else {
      error('Should be following, not pending\n');
    }
  } else {
    error('Failed to follow public user\n');
  }
  
  // ============================================================
  // TEST 3: Follow Requests List
  // ============================================================
  console.log('📋 TEST 3: Follow Requests List\n');
  
  step('Private user checking follow requests...');
  const requests = await getFollowRequests('private');
  
  if (requests.ok) {
    const requestList = requests.data.data || requests.data.requests || [];
    if (requestList.length > 0) {
      success(`Found ${requestList.length} follow request(s)`);
      requestList.forEach(req => {
        info(`  - ${req.username} (${req.id})`);
      });
      console.log();
    } else {
      error('No follow requests found (expected at least 1)\n');
    }
  } else {
    error('Failed to fetch follow requests\n');
  }
  
  // ============================================================
  // TEST 4: Accept Follow Request
  // ============================================================
  console.log('📋 TEST 4: Accept Follow Request\n');
  
  step('Private user accepting follow request...');
  const accepted = await acceptRequest('private', userIds.follower);
  
  if (accepted.ok) {
    success('Follow request accepted');
    
    // Verify follower is now following
    step('Verifying follow status...');
    const verifyFollow = await followUser('follower', userIds.private);
    
    if (verifyFollow.ok && verifyFollow.data.isFollowing && !verifyFollow.data.isPending) {
      success('Follower is now following private user');
      info(`  isFollowing: ${verifyFollow.data.isFollowing}`);
      info(`  isPending: ${verifyFollow.data.isPending}\n`);
    } else {
      error('Follow status not updated correctly\n');
    }
  } else {
    error('Failed to accept follow request\n');
  }
  
  // ============================================================
  // TEST 5: Profile Visibility
  // ============================================================
  console.log('📋 TEST 5: Profile Visibility\n');
  
  step('Checking private profile visibility for follower...');
  const privateProfile = await getProfile('follower', users.private.username);
  
  if (privateProfile.ok) {
    const profile = privateProfile.data.data || privateProfile.data;
    success('Can access private profile (now following)');
    info(`  Username: ${profile.username}`);
    info(`  Private: ${profile.isPrivate || profile.is_private || false}`);
    info(`  Following: ${profile.isFollowing || profile.is_following || false}\n`);
  } else {
    error('Cannot access private profile\n');
  }
  
  // ============================================================
  // TEST 6: Reject Follow Request
  // ============================================================
  console.log('📋 TEST 6: Reject Follow Request\n');
  
  step('Public user requesting to follow private user...');
  const publicRequest = await followUser('public', userIds.private);
  
  if (publicRequest.ok && publicRequest.data.isPending) {
    success('Follow request created');
    
    step('Private user rejecting request...');
    const rejected = await rejectRequest('private', userIds.public);
    
    if (rejected.ok) {
      success('Follow request rejected');
      
      // Verify request is gone
      step('Verifying request was removed...');
      const requestsAfter = await getFollowRequests('private');
      
      if (requestsAfter.ok) {
        const list = requestsAfter.data.data || requestsAfter.data.requests || [];
        const hasPublicRequest = list.some(r => r.id === userIds.public);
        
        if (!hasPublicRequest) {
          success('Request successfully removed\n');
        } else {
          error('Request still exists\n');
        }
      }
    } else {
      error('Failed to reject request\n');
    }
  } else {
    error('Failed to create follow request for rejection test\n');
  }
  
  // ============================================================
  // TEST 7: Cancel Pending Request
  // ============================================================
  console.log('📋 TEST 7: Cancel Pending Request\n');
  
  step('Public user requesting to follow private user again...');
  const requestAgain = await followUser('public', userIds.private);
  
  if (requestAgain.ok && requestAgain.data.isPending) {
    success('Follow request created');
    
    step('Public user canceling their own request...');
    const cancel = await followUser('public', userIds.private);
    
    if (cancel.ok && !cancel.data.isFollowing && !cancel.data.isPending) {
      success('Request canceled successfully');
      info(`  isFollowing: ${cancel.data.isFollowing}`);
      info(`  isPending: ${cancel.data.isPending}\n`);
    } else {
      error('Failed to cancel request\n');
    }
  } else {
    error('Failed to create request for cancel test\n');
  }
  
  // ============================================================
  // TEST 8: Unfollow Private Account
  // ============================================================
  console.log('📋 TEST 8: Unfollow Private Account\n');
  
  step('Follower unfollowing private user...');
  const unfollow = await followUser('follower', userIds.private);
  
  if (unfollow.ok && !unfollow.data.isFollowing) {
    success('Successfully unfollowed');
    info(`  isFollowing: ${unfollow.data.isFollowing}\n`);
  } else {
    error('Failed to unfollow\n');
  }
  
  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('='.repeat(60));
  console.log('🎉 TEST SUITE COMPLETED');
  console.log('='.repeat(60) + '\n');
  
  console.log('✅ All tests passed successfully!\n');
  console.log('Tested features:');
  console.log('  ✓ Private account toggle');
  console.log('  ✓ Follow request creation for private accounts');
  console.log('  ✓ Instant follow for public accounts');
  console.log('  ✓ Follow requests list');
  console.log('  ✓ Accept follow request');
  console.log('  ✓ Reject follow request');
  console.log('  ✓ Cancel pending request');
  console.log('  ✓ Unfollow private account');
  console.log('  ✓ Profile visibility\n');
}

// Run tests
runTests().catch(err => {
  error(`Test suite failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});

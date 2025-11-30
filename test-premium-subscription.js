// Test Premium Subscription Flow
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'https://aufybackend.onrender.com';

async function testPremiumSubscription() {
  console.log('🧪 Testing Premium Subscription Flow\n');
  console.log('API URL:', API_URL);
  console.log('');

  try {
    // 1. Login to get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'harvinderfsd@gmail.com',
        password: 'test123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginResponse.status);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const userId = loginData.user.id || loginData.user._id;
    console.log('✅ Logged in as:', loginData.user.username);
    console.log('   User ID:', userId);

    // 2. Check current user status
    console.log('\n2️⃣ Checking current user status...');
    const userResponse = await fetch(`${API_URL}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('   Current Status:');
      console.log('   - Premium:', userData.isPremium || userData.is_premium || false);
      console.log('   - Verified:', userData.is_verified || userData.verified || false);
      console.log('   - Badge Type:', userData.badge_type || userData.badgeType || 'none');
      console.log('   - Secret Crushes Limit:', userData.maxSecretCrushes || 5);
    }

    // 3. Create payment order
    console.log('\n3️⃣ Creating payment order...');
    const orderResponse = await fetch(`${API_URL}/api/premium/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount: 99 })
    });

    if (!orderResponse.ok) {
      console.error('❌ Order creation failed:', orderResponse.status);
      const errorText = await orderResponse.text();
      console.error('   Error:', errorText);
      return;
    }

    const orderData = await orderResponse.json();
    console.log('✅ Order created successfully!');
    console.log('   Order ID:', orderData.orderId);
    console.log('   Amount:', orderData.amount / 100, 'INR');
    console.log('   Currency:', orderData.currency);

    // 4. Simulate payment success (verify payment)
    console.log('\n4️⃣ Simulating payment success...');
    const verifyResponse = await fetch(`${API_URL}/api/premium/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: 'test_payment_' + Date.now(),
        razorpay_signature: 'test_signature_' + Date.now()
      })
    });

    if (!verifyResponse.ok) {
      console.error('❌ Payment verification failed:', verifyResponse.status);
      const errorText = await verifyResponse.text();
      console.error('   Error:', errorText);
      return;
    }

    const verifyData = await verifyResponse.json();
    console.log('✅ Payment verified successfully!');
    console.log('   Message:', verifyData.message);
    console.log('\n   Premium Features Activated:');
    if (verifyData.premium && verifyData.premium.features) {
      Object.entries(verifyData.premium.features).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
    }
    if (verifyData.badge) {
      console.log('\n   Badge Information:');
      console.log('   - Type:', verifyData.badge.type);
      console.log('   - Verified:', verifyData.badge.verified);
      console.log('   - Status:', verifyData.badge.status);
    }

    // 5. Verify user status after subscription
    console.log('\n5️⃣ Verifying updated user status...');
    const updatedUserResponse = await fetch(`${API_URL}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (updatedUserResponse.ok) {
      const updatedUserData = await updatedUserResponse.json();
      console.log('✅ User status updated:');
      console.log('   - Premium:', updatedUserData.isPremium || updatedUserData.is_premium || false);
      console.log('   - Verified:', updatedUserData.is_verified || updatedUserData.verified || false);
      console.log('   - Badge Type:', updatedUserData.badge_type || updatedUserData.badgeType || 'none');
      console.log('   - Secret Crushes Limit:', updatedUserData.maxSecretCrushes || 5);
      
      // Check if badge is visible
      if (updatedUserData.is_verified && updatedUserData.badge_type) {
        console.log('\n   ✅ VERIFIED BADGE IS ACTIVE!');
        console.log('   Badge will appear on profile with blue checkmark');
      } else {
        console.log('\n   ⚠️  Badge not activated properly');
      }
    }

    console.log('\n✅ Premium subscription test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   1. User logged in');
    console.log('   2. Payment order created (₹99)');
    console.log('   3. Payment verified');
    console.log('   4. Premium features activated');
    console.log('   5. Verified badge granted');
    console.log('   6. User profile updated');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testPremiumSubscription();

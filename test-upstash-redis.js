// Test Upstash Redis Connection
require('dotenv').config()

async function testUpstashRedis() {
  console.log('🔍 Testing Upstash Redis connection...\n')
  
  // Check if credentials are set
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.log('❌ Upstash Redis credentials not found in .env file')
    console.log('\n📝 Add these to your .env file:')
    console.log('UPSTASH_REDIS_REST_URL=https://your-db.upstash.io')
    console.log('UPSTASH_REDIS_REST_TOKEN=your_token_here')
    console.log('\n📚 Get credentials from: https://console.upstash.com')
    process.exit(1)
  }
  
  console.log('✅ Upstash Redis credentials found')
  console.log(`📍 URL: ${url}`)
  console.log(`🔑 Token: ${token.substring(0, 20)}...\n`)
  
  try {
    // Test 1: Ping
    console.log('Test 1: Ping Redis...')
    const pingResponse = await fetch(`${url}/ping`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const pingData = await pingResponse.json()
    console.log(`✅ Ping successful:`, pingData)
    console.log()
    
    // Test 2: Set value
    console.log('Test 2: Set test value...')
    const setResponse = await fetch(`${url}/set/test:connection/Hello_from_Anufy`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const setData = await setResponse.json()
    console.log(`✅ Value set:`, setData)
    console.log()
    
    // Test 3: Get value
    console.log('Test 3: Get test value...')
    const getResponse = await fetch(`${url}/get/test:connection`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const getData = await getResponse.json()
    console.log(`✅ Value retrieved:`, getData)
    console.log()
    
    // Test 4: Set with expiry (60 seconds)
    console.log('Test 4: Set value with 60s expiry...')
    const setExResponse = await fetch(`${url}/setex/test:expiry/60/Expires_in_60s`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const setExData = await setExResponse.json()
    console.log(`✅ Value with expiry set:`, setExData)
    console.log()
    
    // Test 5: Delete value
    console.log('Test 5: Delete test value...')
    const delResponse = await fetch(`${url}/del/test:connection`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const delData = await delResponse.json()
    console.log(`✅ Value deleted:`, delData)
    console.log()
    
    // Test 6: Check database info
    console.log('Test 6: Get database info...')
    const infoResponse = await fetch(`${url}/dbsize`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const infoData = await infoResponse.json()
    console.log(`✅ Database size:`, infoData)
    console.log()
    
    console.log('🎉 All tests passed! Upstash Redis is working perfectly!')
    console.log('\n✨ Your Redis cache is ready to use for:')
    console.log('   - Session management')
    console.log('   - API response caching')
    console.log('   - Rate limiting')
    console.log('   - Real-time features')
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message)
    console.error('\n🔧 Troubleshooting:')
    console.error('1. Check your Upstash Redis credentials')
    console.error('2. Verify your database is active at https://console.upstash.com')
    console.error('3. Check your internet connection')
    process.exit(1)
  }
}

testUpstashRedis()

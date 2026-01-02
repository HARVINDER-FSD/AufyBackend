// Test Redis Connection
require('dotenv').config()
const Redis = require('ioredis')

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n')
  
  // Check if REDIS_URL is set
  if (!process.env.REDIS_URL) {
    console.log('❌ REDIS_URL not found in .env file')
    console.log('\n📝 Add this to your .env file:')
    console.log('REDIS_URL=redis://default:YOUR_PASSWORD@your-db.upstash.io:6379')
    console.log('\n📚 Get Redis URL from: https://upstash.com')
    process.exit(1)
  }
  
  console.log('✅ REDIS_URL found in .env')
  console.log(`📍 URL: ${process.env.REDIS_URL.replace(/:[^:@]+@/, ':****@')}\n`)
  
  try {
    // Create Redis connection
    const redis = new Redis(process.env.REDIS_URL)
    
    // Test 1: Ping
    console.log('Test 1: Ping Redis...')
    const pong = await redis.ping()
    console.log(`✅ Ping successful: ${pong}\n`)
    
    // Test 2: Set value
    console.log('Test 2: Set test value...')
    await redis.set('test:connection', 'Hello from Anufy!', 'EX', 60)
    console.log('✅ Value set successfully\n')
    
    // Test 3: Get value
    console.log('Test 3: Get test value...')
    const value = await redis.get('test:connection')
    console.log(`✅ Value retrieved: ${value}\n`)
    
    // Test 4: Delete value
    console.log('Test 4: Delete test value...')
    await redis.del('test:connection')
    console.log('✅ Val
const Redis = require('ioredis');
const { Redis: UpstashRedis } = require('@upstash/redis');

async function testRedis() {
  console.log('\n🔍 Testing Redis Connection\n');
  
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log('Environment Variables:');
  console.log('- UPSTASH_REDIS_REST_URL:', upstashUrl ? '✅ Set' : '❌ Not set');
  console.log('- UPSTASH_REDIS_REST_TOKEN:', upstashToken ? '✅ Set' : '❌ Not set');
  
  // Test 1: Upstash Redis (HTTP)
  if (upstashUrl && upstashToken) {
    console.log('\n📡 Testing Upstash Redis (HTTP)...');
    try {
      const upstashRedis = new UpstashRedis({
        url: upstashUrl,
        token: upstashToken,
      });
      
      console.log('Attempting to set a test key...');
      await upstashRedis.set('test-key', 'test-value', { ex: 60 });
      console.log('✅ Set successful');
      
      console.log('Attempting to get the test key...');
      const value = await upstashRedis.get('test-key');
      console.log('✅ Get successful:', value);
      
      console.log('Attempting to delete the test key...');
      await upstashRedis.del('test-key');
      console.log('✅ Delete successful');
      
      console.log('\n✅ Upstash Redis is WORKING!\n');
    } catch (error) {
      console.log('❌ Upstash Redis error:', error.message);
      console.log('Error details:', error);
    }
  }
  
  // Test 2: Local Redis
  console.log('\n📡 Testing Local Redis (TCP)...');
  try {
    const localRedis = new Redis({
      host: 'localhost',
      port: 6379,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
    });
    
    console.log('Attempting to set a test key...');
    await localRedis.setex('test-key', 60, 'test-value');
    console.log('✅ Set successful');
    
    console.log('Attempting to get the test key...');
    const value = await localRedis.get('test-key');
    console.log('✅ Get successful:', value);
    
    console.log('Attempting to delete the test key...');
    await localRedis.del('test-key');
    console.log('✅ Delete successful');
    
    console.log('\n✅ Local Redis is WORKING!\n');
    
    localRedis.disconnect();
  } catch (error) {
    console.log('❌ Local Redis error:', error.message);
  }
}

// Load .env
require('dotenv').config({ path: '.env' });

testRedis().catch(console.error);

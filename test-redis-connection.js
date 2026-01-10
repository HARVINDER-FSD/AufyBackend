/**
 * Test Redis Connection
 * Checks if Redis is working
 */

const { Redis } = require('@upstash/redis');

async function testRedis() {
  console.log('\n🔍 TESTING REDIS CONNECTION\n');
  
  const upstashUrl = 'https://wealthy-bengal-50905.upstash.io';
  const upstashToken = 'AcbZAAIncDE3ZTU1YjFmYzAxY2Q0ZDEzYTFiMmNkZjUwODBiYzNlZnAxNTA5MDU';
  
  try {
    console.log('1️⃣  Creating Upstash Redis client...');
    const redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    });
    console.log('   ✅ Client created');
    
    console.log('\n2️⃣  Testing PING command...');
    const pong = await redis.ping();
    console.log('   ✅ PING response:', pong);
    
    console.log('\n3️⃣  Testing SET command...');
    const setResult = await redis.set('test-key', 'test-value', { ex: 60 });
    console.log('   ✅ SET result:', setResult);
    
    console.log('\n4️⃣  Testing GET command...');
    const getValue = await redis.get('test-key');
    console.log('   ✅ GET result:', getValue);
    
    console.log('\n5️⃣  Testing DEL command...');
    const delResult = await redis.del('test-key');
    console.log('   ✅ DEL result:', delResult);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ REDIS IS WORKING!\n');
    
  } catch (error) {
    console.error('\n❌ Redis connection failed:', error.message);
    console.log('\nError details:', error);
    process.exit(1);
  }
}

testRedis();

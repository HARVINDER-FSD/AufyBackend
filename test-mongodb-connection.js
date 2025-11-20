// Test MongoDB Atlas Connection
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔍 Testing MongoDB Connection...\n');
console.log('📋 Connection Details:');
console.log('  - URI:', MONGODB_URI ? MONGODB_URI.substring(0, 50) + '...' : 'NOT SET');
console.log('  - Cluster:', MONGODB_URI?.includes('cluster0.ssl5fvx') ? 'cluster0.ssl5fvx.mongodb.net' : 'Unknown');
console.log('');

async function testConnection() {
  console.log('⏳ Attempting to connect...\n');
  
  const startTime = Date.now();
  
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });
    
    const endTime = Date.now();
    console.log(`✅ Connected successfully in ${endTime - startTime}ms\n`);
    
    // Test database access
    const db = client.db();
    console.log('📊 Database:', db.databaseName);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:', collections.length);
    collections.forEach(col => console.log('  -', col.name));
    
    // Test a simple query
    console.log('\n🔍 Testing query...');
    const usersCount = await db.collection('users').countDocuments();
    console.log(`✅ Users collection: ${usersCount} documents`);
    
    await client.close();
    console.log('\n✅ Connection test passed!');
    process.exit(0);
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`\n❌ Connection failed after ${endTime - startTime}ms\n`);
    console.error('Error details:');
    console.error('  - Code:', error.code);
    console.error('  - Message:', error.message);
    console.error('  - Syscall:', error.syscall);
    console.error('  - Hostname:', error.hostname);
    
    console.log('\n🔧 Possible causes:');
    console.log('  1. IP Address not whitelisted in MongoDB Atlas');
    console.log('  2. Network/Firewall blocking connection');
    console.log('  3. Incorrect credentials');
    console.log('  4. MongoDB Atlas cluster paused or deleted');
    console.log('  5. DNS resolution issues');
    
    console.log('\n💡 Solutions:');
    console.log('  1. Go to MongoDB Atlas → Network Access → Add IP Address');
    console.log('  2. Add 0.0.0.0/0 to allow all IPs (for testing)');
    console.log('  3. Check if cluster is active in MongoDB Atlas dashboard');
    console.log('  4. Verify username and password are correct');
    
    process.exit(1);
  }
}

testConnection();

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harvinder:Harvinder%40123@cluster0.mongodb.net/anufy?retryWrites=true&w=majority';

async function checkDatabaseStatus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔍 Connected to MongoDB - Checking database status');
    
    const db = client.db('anufy');
    
    // List all collections
    console.log('\n📋 Available collections:');
    const collections = await db.listCollections().toArray();
    console.log(collections.map(c => c.name));
    
    // Check each collection for data
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   ${collection.name}: ${count} documents`);
      
      if (collection.name === 'users' && count > 0) {
        // Show sample user data
        const sampleUsers = await db.collection('users').find({}).limit(3).toArray();
        console.log('\n👤 Sample users:');
        sampleUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.username} - ${user.fullName || user.full_name || user.name || 'No name'}`);
          console.log(`      Avatar: ${user.profileImage || user.avatar_url || user.avatar || 'NO AVATAR'}`);
        });
      }
    }
    
    // Try different database names in case it's not 'anufy'
    console.log('\n🔍 Checking other possible database names...');
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    
    console.log('\n📊 Available databases:');
    databases.databases.forEach(db => {
      console.log(`   ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    // Check if there's a different database with user data
    for (const database of databases.databases) {
      if (database.name !== 'anufy' && database.name !== 'admin' && database.name !== 'local') {
        console.log(`\n🔍 Checking database: ${database.name}`);
        const testDb = client.db(database.name);
        const testCollections = await testDb.listCollections().toArray();
        
        for (const col of testCollections) {
          if (col.name === 'users') {
            const userCount = await testDb.collection('users').countDocuments();
            console.log(`   Found ${userCount} users in ${database.name}.users`);
            
            if (userCount > 0) {
              const sampleUsers = await testDb.collection('users').find({}).limit(3).toArray();
              console.log('   Sample users:');
              sampleUsers.forEach((user, index) => {
                console.log(`     ${index + 1}. ${user.username} - ${user.fullName || user.full_name || user.name || 'No name'}`);
              });
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking database status:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkDatabaseStatus().catch(console.error);
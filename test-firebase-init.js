// Simple test to check if Firebase is initialized correctly
console.log('🧪 Testing Firebase Initialization...\n');

try {
  // Check if service account file exists
  const fs = require('fs');
  const path = require('path');
  
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('❌ firebase-service-account.json NOT FOUND');
    console.log('   Expected location:', serviceAccountPath);
    process.exit(1);
  }
  
  console.log('✅ firebase-service-account.json found');
  
  // Read and validate the file
  const serviceAccount = require('./firebase-service-account.json');
  
  if (!serviceAccount.project_id) {
    console.log('❌ Invalid service account file (missing project_id)');
    process.exit(1);
  }
  
  console.log('✅ Service account file is valid');
  console.log('   Project ID:', serviceAccount.project_id);
  console.log('   Client Email:', serviceAccount.client_email);
  
  // Try to initialize Firebase Admin
  const admin = require('firebase-admin');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('\n✅ Firebase Admin SDK initialized successfully!');
  console.log('\n📱 Your backend is ready to send push notifications when the app is closed.');
  console.log('\n📝 Next steps:');
  console.log('   1. Make sure your mobile app has google-services.json');
  console.log('   2. Build a new APK with: npm run build:production');
  console.log('   3. Install the APK on your device');
  console.log('   4. Test notifications when app is completely closed');
  
} catch (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

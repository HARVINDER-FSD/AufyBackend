// Test WebSocket Connection to Render Backend
const io = require('socket.io-client');

const BACKEND_URL = 'https://aufybackend.onrender.com';

console.log('🔌 Testing WebSocket connection to:', BACKEND_URL);
console.log('⚠️  Note: Render free tier may have WebSocket limitations\n');

// Test with a dummy token (will fail auth but test connection)
const socket = io(BACKEND_URL, {
  auth: { token: 'test-token' },
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
  timeout: 20000,
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected!');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  
  if (error.message.includes('Authentication')) {
    console.log('\n✅ Good news: Server is responding (auth error is expected with test token)');
    console.log('✅ WebSocket server is working!');
    socket.disconnect();
    process.exit(0);
  }
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Connection timeout - Render may be sleeping or WebSocket not supported');
  console.log('💡 Render free tier limitations:');
  console.log('   - Service sleeps after 15 min of inactivity');
  console.log('   - WebSocket support is limited on free tier');
  console.log('   - Consider upgrading to paid tier for WebSocket support');
  socket.disconnect();
  process.exit(1);
}, 30000);

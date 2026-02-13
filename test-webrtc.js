
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192';
const SERVER_URL = 'http://localhost:5001';

// Valid MongoDB ObjectIds
const USER_A_ID = '507f1f77bcf86cd799439011';
const USER_B_ID = '507f1f77bcf86cd799439022';

// Generate Tokens
const tokenA = jwt.sign({ userId: USER_A_ID, username: 'Alice' }, JWT_SECRET);
const tokenB = jwt.sign({ userId: USER_B_ID, username: 'Bob' }, JWT_SECRET);

// Connect Clients
const socketA = io(SERVER_URL, { auth: { token: tokenA }, transports: ['websocket'] });
const socketB = io(SERVER_URL, { auth: { token: tokenB }, transports: ['websocket'] });

console.log('🚀 Starting WebRTC Signaling Test (Protocol V2)...');

let steps = {
  connected: 0,
  incomingReceived: false,
  acceptedReceived: false,
  offerReceived: false,
  answerReceived: false,
  iceReceived: false
};

// --- USER A (Caller) ---
socketA.on('connect', () => {
  console.log('✅ User A Connected');
  checkStart();
});

socketA.on('call:accepted', (data) => {
  console.log('✅ User A received Call Accepted from:', data.acceptorId);
  steps.acceptedReceived = true;
  
  console.log('🔄 User A sending Offer...');
  socketA.emit('call:offer', {
    targetUserId: USER_B_ID,
    sdp: 'mock-sdp-offer'
  });
});

socketA.on('call:answer', (data) => {
  console.log('✅ User A received Answer SDP from:', data.senderId);
  steps.answerReceived = true;
  
  console.log('🔄 User A sending ICE Candidate...');
  socketA.emit('call:ice-candidate', {
    targetUserId: USER_B_ID,
    candidate: 'mock-ice-candidate-A'
  });
});

// --- USER B (Callee) ---
socketB.on('connect', () => {
  console.log('✅ User B Connected');
  checkStart();
});

socketB.on('call:incoming', (data) => {
  console.log('✅ User B received Incoming Call from:', data.callerId);
  steps.incomingReceived = true;
  
  console.log('🔄 User B accepting call...');
  socketB.emit('call:accept', { callerId: data.callerId });
});

socketB.on('call:offer', (data) => {
  console.log('✅ User B received Offer SDP from:', data.senderId);
  steps.offerReceived = true;
  
  console.log('🔄 User B sending Answer...');
  socketB.emit('call:answer', {
    targetUserId: data.senderId,
    sdp: 'mock-sdp-answer'
  });
});

socketB.on('call:ice-candidate', (data) => {
  console.log('✅ User B received ICE Candidate from:', data.senderId);
  steps.iceReceived = true;
  finishTest();
});

function checkStart() {
  steps.connected++;
  if (steps.connected === 2) {
    console.log('🔄 User A starting call...');
    socketA.emit('call:start', { recipientId: USER_B_ID, isVideo: true });
  }
}

function finishTest() {
  console.log('\n🎉 TEST SUMMARY:');
  console.log(`- Incoming Call: ${steps.incomingReceived ? 'PASS' : 'FAIL'}`);
  console.log(`- Call Accepted: ${steps.acceptedReceived ? 'PASS' : 'FAIL'}`);
  console.log(`- Offer Exchanged: ${steps.offerReceived ? 'PASS' : 'FAIL'}`);
  console.log(`- Answer Exchanged: ${steps.answerReceived ? 'PASS' : 'FAIL'}`);
  console.log(`- ICE Exchanged: ${steps.iceReceived ? 'PASS' : 'FAIL'}`);

  if (steps.iceReceived) {
    console.log('\n✅ WebRTC Signaling Flow Verified Successfully!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

setTimeout(() => {
  console.log('\n❌ Test Timed Out');
  process.exit(1);
}, 5000);

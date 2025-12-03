const API_URL = 'https://aufybackend.onrender.com';

async function test() {
  console.log('Testing settings endpoint...\n');
  
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'private.test@example.com', password: 'Test123!' })
  });
  
  if (!loginRes.ok) {
    console.log('Login failed - account may not exist');
    return;
  }
  
  const { token } = await loginRes.json();
  console.log('✅ Logged in\n');
  
  const getRes = await fetch(`${API_URL}/api/settings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`GET /api/settings: ${getRes.status}`);
  
  const patchRes = await fetch(`${API_URL}/api/settings`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ privateAccount: true })
  });
  console.log(`PATCH /api/settings: ${patchRes.status}\n`);
  
  if (getRes.ok && patchRes.ok) {
    console.log('✅ Settings endpoints working!');
  } else {
    console.log('❌ Settings endpoints not working');
    console.log('Backend needs latest code deployed');
  }
}

test().catch(console.error);

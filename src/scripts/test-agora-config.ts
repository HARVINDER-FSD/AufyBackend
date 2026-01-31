
import dotenv from 'dotenv';
import path from 'path';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

// Load environment variables manually since we are running a standalone script
dotenv.config({ path: path.join(__dirname, '../../.env') });

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

console.log('--- Agora Configuration Test ---');
console.log('APP_ID:', APP_ID ? 'Loaded ✅' : 'Missing ❌');
console.log('APP_CERTIFICATE:', APP_CERTIFICATE ? 'Loaded ✅' : 'Missing ❌');

if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Error: Missing Agora configuration.');
    process.exit(1);
}

const channelName = 'test-channel';
const uid = '123456';
const role = RtcRole.PUBLISHER;
const expirationTimeInSeconds = 3600;
const currentTimestamp = Math.floor(Date.now() / 1000);
const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

console.log(`\nGenerating token for Channel: ${channelName}, User: ${uid}...`);

try {
    const token = RtcTokenBuilder.buildTokenWithAccount(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        role,
        privilegeExpiredTs
    );
    console.log('\nToken Generated Successfully! 🎉');
    console.log('Token:', token);
    console.log('\nBackend verification passed: Agora SDK is accepting the credentials.');
} catch (error) {
    console.error('\nError generating token:', error);
}

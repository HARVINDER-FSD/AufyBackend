import express from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import auth from '../middleware/auth';

const router = express.Router();

// Get these from Environment Variables
const APP_ID = process.env.AGORA_APP_ID || '373fa7954c3940d58159be06afc41e46';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || 'e7c42286bbd34594af3f823c2632809e';

router.get('/token', auth, (req, res) => {
  try {
    const { channelName, role } = req.query;
    
    if (!channelName) {
      return res.status(400).json({ message: 'Channel name is required' });
    }

    if (!APP_ID) {
        return res.status(500).json({ message: 'Agora App ID is not configured' });
    }

    // Get user ID from auth middleware
    const uid = req.userId || '0'; 
    
    // Set role: PUBLISHER (default) or SUBSCRIBER
    let rtcRole = RtcRole.PUBLISHER;
    if (role === 'audience') {
      rtcRole = RtcRole.SUBSCRIBER;
    }

    // Token expiration time (1 hour)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log(`Generating Agora Token for Channel: ${channelName}, User: ${uid}`);

    const token = RtcTokenBuilder.buildTokenWithAccount(
      APP_ID,
      APP_CERTIFICATE,
      channelName as string,
      uid,
      rtcRole,
      privilegeExpiredTs
    );

    return res.json({ token, appId: APP_ID, channelName, uid });

  } catch (error: any) {
    console.error('Error generating Agora token:', error);
    return res.status(500).json({ message: 'Failed to generate token' });
  }
});

export default router;

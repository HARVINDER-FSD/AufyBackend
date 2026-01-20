import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../lib/database';
import { authenticateToken } from '../middleware/auth';
import { cacheDel } from '../lib/redis';

const router = express.Router();

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
  };
}

// Get all user settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure privateAccount setting is synced with is_private field
    const settings = user.settings || {};
    if (user.is_private !== undefined && settings.privateAccount === undefined) {
      settings.privateAccount = user.is_private;
      console.log('[Settings] Syncing privateAccount from is_private:', user.is_private);
    }

    res.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update user settings (partial update)
router.patch('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge new settings with existing settings
    const updatedSettings = {
      ...user.settings,
      ...req.body
    };

    // CRITICAL: Sync is_private field with privateAccount setting
    const updateFields: any = {
      settings: updatedSettings,
      updated_at: new Date()
    };

    // If privateAccount is being updated, also update is_private
    if ('privateAccount' in req.body) {
      updateFields.is_private = req.body.privateAccount;
      console.log('[Settings] Syncing is_private =', req.body.privateAccount);
    }

    await usersCollection.updateOne(
      { _id: user._id },
      { $set: updateFields }
    );

    // Invalidate user profile cache
    await cacheDel(`userProfile:${req.userId}`);

    res.json({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get AI settings
router.get('/ai', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const settings = user.settings || {};
    res.json({
      aiEnabled: settings.aiEnabled !== false,
      personalizedResponses: settings.personalizedResponses !== false,
      learningEnabled: settings.learningEnabled || false,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// Update AI settings
router.put('/ai', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const update = {
      'settings.aiEnabled': req.body.aiEnabled,
      'settings.personalizedResponses': req.body.personalizedResponses,
      'settings.learningEnabled': req.body.learningEnabled,
      updated_at: new Date()
    };

    await usersCollection.updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: update }
    );

    res.json({ success: true, settings: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

// Get specific setting category
router.get('/:category', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { category } = req.params;
    const settings = user.settings || {};

    // Return category-specific settings
    let categorySettings: any = {};

    switch (category) {
      case 'privacy':
        categorySettings = {
          privateAccount: settings.privateAccount || false,
          showOnlineStatus: settings.showOnlineStatus !== false,
          allowTagging: settings.allowTagging !== false,
          allowMentions: settings.allowMentions !== false,
          showReadReceipts: settings.showReadReceipts !== false,
          whoCanMessage: settings.whoCanMessage || 'everyone',
          whoCanSeeStories: settings.whoCanSeeStories || 'everyone',
          whoCanSeeFollowers: settings.whoCanSeeFollowers || 'everyone',
        };
        break;

      case 'notifications':
        categorySettings = {
          pauseAll: settings.pauseAll || false,
          postsStoriesComments: settings.postsStoriesComments || true,
          followingFollowers: settings.followingFollowers || true,
          messagesCalls: settings.messagesCalls || true,
          liveReels: settings.liveReels || true,
          fundraisers: settings.fundraisers || true,
          fromAnufy: settings.fromAnufy || true,
        };
        break;

      case 'wellbeing':
        categorySettings = {
          quietModeEnabled: settings.quietModeEnabled || false,
          quietModeStart: settings.quietModeStart || '22:00',
          quietModeEnd: settings.quietModeEnd || '07:00',
          takeBreakEnabled: settings.takeBreakEnabled || false,
          takeBreakInterval: settings.takeBreakInterval || 20,
          dailyLimitEnabled: settings.dailyLimitEnabled || false,
          dailyLimitMinutes: settings.dailyLimitMinutes || 60,
        };
        break;

      default:
        categorySettings = settings;
    }

    res.json({ settings: categorySettings });
  } catch (error) {
    console.error('Error fetching category settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});


export default router;

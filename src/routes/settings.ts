import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../lib/database';
import { authenticateToken } from '../middleware/auth';

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
    
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user?.userId) });
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
    
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user?.userId) });
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

    res.json({ 
      message: 'Settings updated successfully',
      settings: updatedSettings 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get specific setting category
router.get('/:category', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user?.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { category } = req.params;
    const settings = user.settings || {};

    // Return category-specific settings
    const categorySettings: any = {};
    
    switch (category) {
      case 'privacy':
        categorySettings.privateAccount = settings.privateAccount;
        categorySettings.showOnlineStatus = settings.showOnlineStatus;
        categorySettings.whoCanMessage = settings.whoCanMessage;
        categorySettings.whoCanSeeStories = settings.whoCanSeeStories;
        categorySettings.whoCanSeeFollowers = settings.whoCanSeeFollowers;
        break;
      
      case 'messages':
        categorySettings.whoCanMessage = settings.whoCanMessage;
        categorySettings.groupRequests = settings.groupRequests;
        categorySettings.messageReplies = settings.messageReplies;
        categorySettings.showActivityStatus = settings.showActivityStatus;
        categorySettings.readReceipts = settings.readReceipts;
        break;
      
      case 'media':
        categorySettings.saveOriginalPhotos = settings.saveOriginalPhotos;
        categorySettings.uploadQuality = settings.uploadQuality;
        categorySettings.autoPlayVideos = settings.autoPlayVideos;
        categorySettings.useLessData = settings.useLessData;
        break;
      
      case 'wellbeing':
        categorySettings.quietModeEnabled = settings.quietModeEnabled;
        categorySettings.quietModeStart = settings.quietModeStart;
        categorySettings.quietModeEnd = settings.quietModeEnd;
        categorySettings.takeBreakEnabled = settings.takeBreakEnabled;
        categorySettings.takeBreakInterval = settings.takeBreakInterval;
        categorySettings.dailyLimitEnabled = settings.dailyLimitEnabled;
        categorySettings.dailyLimitMinutes = settings.dailyLimitMinutes;
        break;
      
      default:
        return res.json({ settings: user.settings });
    }

    res.json({ settings: categorySettings });
  } catch (error) {
    console.error('Error fetching category settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export default router;

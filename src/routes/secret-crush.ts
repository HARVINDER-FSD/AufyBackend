// Secret Crush (Favorites Friend) API Routes - Enhanced with defensive queries
import express, { Response } from 'express';
import { SecretCrush } from '../models/secret-crush';
import User from '../models/user';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createNotification } from '../lib/notifications';

const router = express.Router();

// Add user to secret crush list
router.post('/add/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId;
    const crushUserId = req.params.userId;

    // Validate crush user ID
    if (!crushUserId || crushUserId === 'undefined') {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    // Prevent self-crush
    if (currentUserId === crushUserId) {
      return res.status(400).json({ success: false, message: 'Cannot add yourself as secret crush' });
    }

    // Check if crush user exists
    const crushUser = await (User as any).findOne({ _id: crushUserId });
    if (!crushUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get current user to check limits
    const currentUser = await (User as any).findOne({ _id: currentUserId });
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already exists
    const existing = await SecretCrush.findOne({
      userId: currentUserId,
      crushUserId,
      isActive: true
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already in your secret crush list',
        isMutual: existing.isMutual
      });
    }

    // Check user's crush limit
    const maxCrushes = currentUser.isPremium ? 10 : 5;
    const currentCount = await SecretCrush.countDocuments({
      userId: currentUserId,
      isActive: true
    });

    if (currentCount >= maxCrushes) {
      return res.status(400).json({
        success: false,
        message: `You've reached your limit of ${maxCrushes} secret crushes`,
        isPremium: currentUser.isPremium,
        needsUpgrade: !currentUser.isPremium
      });
    }

    // Create secret crush entry
    const secretCrush = new SecretCrush({
      userId: currentUserId,
      crushUserId
    });

    // Check if it's mutual (other user also added current user)
    const mutualCrush = await SecretCrush.findOne({
      userId: crushUserId,
      crushUserId: currentUserId,
      isActive: true
    });

    let chatId = null;
    let isMutual = false;

    if (mutualCrush) {
      // MUTUAL MATCH! 💕
      isMutual = true;
      
      // Generate unique chat ID for secret crush chat
      chatId = `secret_crush_${[currentUserId, crushUserId].sort().join('_')}`;
      
      // Update both entries
      secretCrush.isMutual = true;
      secretCrush.mutualChatId = chatId;
      secretCrush.mutualDetectedAt = new Date();
      
      mutualCrush.isMutual = true;
      mutualCrush.mutualChatId = chatId;
      mutualCrush.mutualDetectedAt = new Date();
      
      await mutualCrush.save();

      // Send notifications to both users (only if not already notified)
      if (!mutualCrush.notifiedAt) {
        try {
          await createNotification({
            userId: currentUserId,
            actorId: crushUserId,
            type: 'secret_crush_match',
            conversationId: chatId,
            content: `💕 You both are secret crushes! You and @${crushUser.username} both added each other as favorites!`
          });

          await createNotification({
            userId: crushUserId,
            actorId: currentUserId,
            type: 'secret_crush_match',
            conversationId: chatId,
            content: `💕 You both are secret crushes! You and @${currentUser.username} both added each other as favorites!`
          });

          secretCrush.notifiedAt = new Date();
          mutualCrush.notifiedAt = new Date();
          await mutualCrush.save();
        } catch (notifError) {
          console.error('Error sending mutual crush notifications:', notifError);
        }
      }
    }

    try {
      await secretCrush.save();
    } catch (saveError: any) {
      // Handle duplicate key error (race condition)
      if (saveError.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Already in your secret crush list'
        });
      }
      throw saveError;
    }

    // Update user's crush count
    await (User as any).updateOne(
      { _id: currentUserId },
      { $inc: { secretCrushCount: 1 } }
    );

    res.json({
      success: true,
      message: isMutual ? 'Mutual crush detected! 💕' : 'Added to secret crush list',
      isMutual,
      chatId,
      crushCount: currentCount + 1,
      maxCrushes
    });

  } catch (error) {
    console.error('Error adding secret crush:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove user from secret crush list
router.delete('/remove/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId;
    const crushUserId = req.params.userId;

    const secretCrush = await SecretCrush.findOne({
      userId: currentUserId,
      crushUserId,
      isActive: true
    });

    if (!secretCrush) {
      return res.status(404).json({ success: false, message: 'Not in your secret crush list' });
    }

    const wasMutual = secretCrush.isMutual;
    const chatId = secretCrush.mutualChatId;

    // Mark as inactive
    secretCrush.isActive = false;
    secretCrush.removedAt = new Date();
    await secretCrush.save();

    // Update user's crush count
    await (User as any).updateOne(
      { _id: currentUserId },
      { $inc: { secretCrushCount: -1 } }
    );

    // If was mutual, update other user's entry and notify
    if (wasMutual) {
      const otherCrush = await SecretCrush.findOne({
        userId: crushUserId,
        crushUserId: currentUserId,
        isActive: true
      });

      if (otherCrush) {
        // Break the mutual connection
        otherCrush.isMutual = false;
        otherCrush.mutualChatId = null;
        otherCrush.mutualBrokenAt = new Date();
        await otherCrush.save();

        // Get user details for notification
        try {
          const currentUser = await (User as any).findOne({ _id: currentUserId });
          const otherUser = await (User as any).findOne({ _id: crushUserId });
          
          if (currentUser && otherUser) {
            // Notify other user that mutual connection ended
            await createNotification({
              userId: crushUserId,
              actorId: currentUserId,
              type: 'secret_crush_removed',
              content: `💔 Your favorites connection with @${currentUser.username} has ended`
            });

            console.log(`💔 Mutual crush connection broken between ${currentUser.username} and ${otherUser.username}`);
          }
        } catch (notifError) {
          console.error('Error sending crush ended notification:', notifError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Removed from secret crush list',
      wasMutual,
      affectedUsers: wasMutual ? [currentUserId, crushUserId] : [currentUserId]
    });

  } catch (error) {
    console.error('Error removing secret crush:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's secret crush list
router.get('/my-list', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get user's limits first
    const user = await (User as any).findOne({ _id: userId }).lean();
    const maxCrushes = user?.isPremium ? 10 : 5;

    // Find crushes with defensive query
    const crushes = await SecretCrush.find({
      userId,
      isActive: true
    })
    .populate('crushUserId', 'username full_name avatar_url is_verified badge_type')
    .sort({ createdAt: -1 })
    .lean()
    .catch(err => {
      console.error('Error querying crushes:', err);
      return [];
    });

    if (!crushes || !Array.isArray(crushes)) {
      return res.json({
        success: true,
        crushes: [],
        count: 0,
        mutualCount: 0,
        maxCrushes,
        isPremium: user?.isPremium || false
      });
    }

    // Filter out any crushes with missing user data
    const validCrushes = crushes.filter(crush => crush.crushUserId && typeof crush.crushUserId === 'object');
    const mutualCount = validCrushes.filter(c => c.isMutual).length;

    const crushList = validCrushes.map(crush => ({
      id: crush._id,
      user: crush.crushUserId,
      isMutual: crush.isMutual || false,
      chatId: crush.mutualChatId || null,
      addedAt: crush.createdAt,
      mutualSince: crush.mutualDetectedAt || null
    }));

    res.json({
      success: true,
      crushes: crushList,
      count: validCrushes.length,
      mutualCount,
      maxCrushes,
      isPremium: user?.isPremium || false
    });

  } catch (error) {
    console.error('Error fetching secret crush list:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      crushes: [],
      count: 0,
      mutualCount: 0,
      maxCrushes: 5,
      isPremium: false
    });
  }
});

// Get only mutual crushes
router.get('/mutual', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const mutualCrushes = await SecretCrush.find({
      userId,
      isActive: true,
      isMutual: true
    })
    .populate('crushUserId', 'username full_name avatar_url is_verified badge_type')
    .sort({ mutualDetectedAt: -1 })
    .lean()
    .catch(err => {
      console.error('Error querying mutual crushes:', err);
      return [];
    });

    if (!mutualCrushes || !Array.isArray(mutualCrushes)) {
      return res.json({
        success: true,
        mutualCrushes: [],
        count: 0
      });
    }

    // Filter out any crushes with missing user data
    const validCrushes = mutualCrushes.filter(crush => crush.crushUserId && typeof crush.crushUserId === 'object');

    const crushList = validCrushes.map(crush => ({
      id: crush._id,
      user: crush.crushUserId,
      chatId: crush.mutualChatId || null,
      mutualSince: crush.mutualDetectedAt || null
    }));

    res.json({
      success: true,
      mutualCrushes: crushList,
      count: crushList.length
    });

  } catch (error) {
    console.error('Error fetching mutual crushes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      mutualCrushes: [],
      count: 0
    });
  }
});

// Check if user is in your secret crush list
router.get('/check/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.userId;
    const checkUserId = req.params.userId;

    const crush = await SecretCrush.findOne({
      userId: currentUserId,
      crushUserId: checkUserId,
      isActive: true
    });

    res.json({
      success: true,
      isInMyList: !!crush,
      isMutual: crush?.isMutual || false,
      chatId: crush?.mutualChatId || null
    });

  } catch (error) {
    console.error('Error checking secret crush:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get last update timestamp for real-time polling
router.get('/last-update', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find the most recent update in user's secret crush list
    const latestUpdate = await SecretCrush.findOne({
      $or: [
        { userId, isActive: true },
        { crushUserId: userId, isActive: true }
      ]
    })
    .sort({ updatedAt: -1 })
    .select('updatedAt mutualDetectedAt removedAt mutualBrokenAt')
    .lean();

    const lastUpdateTime = latestUpdate ? (
      latestUpdate.mutualBrokenAt || 
      latestUpdate.removedAt || 
      latestUpdate.mutualDetectedAt || 
      latestUpdate.updatedAt
    ) : null;

    res.json({
      success: true,
      lastUpdate: lastUpdateTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting last update:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      lastUpdate: null,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

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

      // Send notifications to both users
      try {
        await createNotification({
          userId: currentUserId,
          actorId: crushUserId,
          type: 'follow',
          content: `💕 Mutual Favorite Match! You and @${crushUser.username} both added each other!`
        });

        await createNotification({
          userId: crushUserId,
          actorId: currentUserId,
          type: 'follow',
          content: `💕 Mutual Favorite Match! You and @${currentUser.username} both added each other!`
        });

        secretCrush.notifiedAt = new Date();
        mutualCrush.notifiedAt = new Date();
        await mutualCrush.save();
      } catch (notifError) {
        console.error('Error sending mutual crush notifications:', notifError);
      }
    }

    await secretCrush.save();

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
        otherCrush.isMutual = false;
        otherCrush.mutualChatId = null;
        await otherCrush.save();

        // Notify other user
        try {
          const currentUser = await (User as any).findOne({ _id: currentUserId });
          await createNotification({
            userId: crushUserId,
            actorId: currentUserId,
            type: 'follow',
            content: `Your favorites connection with @${currentUser?.username} has ended`
          });
        } catch (notifError) {
          console.error('Error sending crush ended notification:', notifError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Removed from secret crush list',
      wasMutual
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

    const crushes = await SecretCrush.find({
      userId,
      isActive: true
    })
    .populate('crushUserId', 'username full_name avatar_url is_verified badge_type')
    .sort({ createdAt: -1 });

    const mutualCount = crushes.filter(c => c.isMutual).length;

    const crushList = crushes.map(crush => ({
      id: crush._id,
      user: crush.crushUserId,
      isMutual: crush.isMutual,
      chatId: crush.mutualChatId,
      addedAt: crush.createdAt,
      mutualSince: crush.mutualDetectedAt
    }));

    // Get user's limits
    const user = await (User as any).findOne({ _id: userId });
    const maxCrushes = user?.isPremium ? 10 : 5;

    res.json({
      success: true,
      crushes: crushList,
      count: crushes.length,
      mutualCount,
      maxCrushes,
      isPremium: user?.isPremium || false
    });

  } catch (error) {
    console.error('Error fetching secret crush list:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get only mutual crushes
router.get('/mutual', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const mutualCrushes = await SecretCrush.find({
      userId,
      isActive: true,
      isMutual: true
    })
    .populate('crushUserId', 'username full_name avatar_url is_verified badge_type')
    .sort({ mutualDetectedAt: -1 });

    const crushList = mutualCrushes.map(crush => ({
      id: crush._id,
      user: crush.crushUserId,
      chatId: crush.mutualChatId,
      mutualSince: crush.mutualDetectedAt
    }));

    res.json({
      success: true,
      mutualCrushes: crushList,
      count: crushList.length
    });

  } catch (error) {
    console.error('Error fetching mutual crushes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

export default router;

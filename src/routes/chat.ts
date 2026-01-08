import express from 'express';
import auth from '../middleware/auth';
import Message from '../models/message';
import Conversation from '../models/conversation';
import mongoose from 'mongoose';

const router = express.Router();

// Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user!._id
    })
      .populate('participants', 'username fullName profileImage')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get or create conversation with a user
router.post('/conversations', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user!._id, userId] }
    })
      .populate('participants', 'username fullName profileImage')
      .populate('lastMessage');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [req.user!._id, userId]
      });
      
      conversation = await conversation.populate('participants', 'username fullName profileImage');
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    const query: any = { conversation: conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'username fullName profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, image, recipientId } = req.body;

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user!._id,
      content,
      image
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    // Check if this should create a message request
    if (recipientId) {
      const db = mongoose.connection.db;
      if (!db) {
        console.error('Database connection not available');
      } else {
        // Check mutual follow
        const [userFollowsRecipient, recipientFollowsUser] = await Promise.all([
          db.collection('follows').findOne({
            followerId: new mongoose.Types.ObjectId(req.user!._id),
            followingId: new mongoose.Types.ObjectId(recipientId)
          }),
          db.collection('follows').findOne({
            followerId: new mongoose.Types.ObjectId(recipientId),
            followingId: new mongoose.Types.ObjectId(req.user!._id)
          })
        ]);

        const isMutualFollow = !!userFollowsRecipient && !!recipientFollowsUser;

        // If not mutual follow, create/update message request
        if (!isMutualFollow) {
          await db.collection('message_requests').updateOne(
            {
              senderId: new mongoose.Types.ObjectId(req.user!._id),
              recipientId: new mongoose.Types.ObjectId(recipientId)
            },
            {
              $set: {
                conversationId,
                lastMessage: {
                  content,
                  image,
                  timestamp: new Date()
                },
                updatedAt: new Date()
              },
              $setOnInsert: {
                status: 'pending',
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
        }
      }
    }

    const populatedMessage = await message.populate('sender', 'username fullName profileImage');

    // Send push notification
    if (recipientId) {
      notifyMessage(
        recipientId,
        req.user!._id,
        conversationId,
        content || (image ? 'Sent an image' : 'Sent a message')
      ).catch(err => console.error('Error sending message notification:', err));
    }

    res.json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/conversations/:conversationId/read', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user!._id },
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message
router.delete('/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user!._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await message.deleteOne();
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search messages in conversation
router.get('/conversations/:conversationId/search', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query required' });
    }

    const messages = await Message.find({
      conversation: conversationId,
      content: { $regex: q, $options: 'i' }
    })
      .populate('sender', 'username fullName profileImage')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mute/Unmute conversation notifications
router.post('/conversations/:conversationId/mute', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { mute = true } = req.body;

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    if (mute) {
      // Add to muted list
      await db.collection('muted_conversations').updateOne(
        {
          userId: new mongoose.Types.ObjectId(req.user!._id),
          conversationId: new mongoose.Types.ObjectId(conversationId)
        },
        {
          $set: {
            userId: new mongoose.Types.ObjectId(req.user!._id),
            conversationId: new mongoose.Types.ObjectId(conversationId),
            mutedAt: new Date()
          }
        },
        { upsert: true }
      );
      res.json({ message: 'Conversation muted', isMuted: true });
    } else {
      // Remove from muted list
      await db.collection('muted_conversations').deleteOne({
        userId: new mongoose.Types.ObjectId(req.user!._id),
        conversationId: new mongoose.Types.ObjectId(conversationId)
      });
      res.json({ message: 'Conversation unmuted', isMuted: false });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Block user in conversation
router.post('/conversations/:conversationId/block', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { blockUserId } = req.body;

    if (!blockUserId) {
      return res.status(400).json({ message: 'blockUserId required' });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Add to blocked list
    await db.collection('blocked_users').updateOne(
      {
        userId: new mongoose.Types.ObjectId(req.user!._id),
        blockedUserId: new mongoose.Types.ObjectId(blockUserId)
      },
      {
        $set: {
          userId: new mongoose.Types.ObjectId(req.user!._id),
          blockedUserId: new mongoose.Types.ObjectId(blockUserId),
          conversationId: new mongoose.Types.ObjectId(conversationId),
          blockedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ message: 'User blocked', isBlocked: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Unblock user
router.post('/conversations/:conversationId/unblock', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { blockUserId } = req.body;

    if (!blockUserId) {
      return res.status(400).json({ message: 'blockUserId required' });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Remove from blocked list
    await db.collection('blocked_users').deleteOne({
      userId: new mongoose.Types.ObjectId(req.user!._id),
      blockedUserId: new mongoose.Types.ObjectId(blockUserId)
    });

    res.json({ message: 'User unblocked', isBlocked: false });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Report user/conversation
router.post('/conversations/:conversationId/report', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: 'reportedUserId and reason required' });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Create report
    const report = {
      reporterId: new mongoose.Types.ObjectId(req.user!._id),
      reportedUserId: new mongoose.Types.ObjectId(reportedUserId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      reason,
      description: description || '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('reports').insertOne(report);

    res.json({
      message: 'Report submitted successfully',
      reportId: result.insertedId
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Check if conversation is muted
router.get('/conversations/:conversationId/mute-status', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    const muted = await db.collection('muted_conversations').findOne({
      userId: new mongoose.Types.ObjectId(req.user!._id),
      conversationId: new mongoose.Types.ObjectId(conversationId)
    });

    const blocked = await db.collection('blocked_users').findOne({
      userId: new mongoose.Types.ObjectId(req.user!._id),
      conversationId: new mongoose.Types.ObjectId(conversationId)
    });

    res.json({
      isMuted: !!muted,
      isBlocked: !!blocked
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

export default router;

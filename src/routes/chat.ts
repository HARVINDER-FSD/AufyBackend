import express from 'express';
import auth from '../middleware/auth';
import Message from '../models/message';
import Conversation from '../models/conversation';

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
      const { MongoClient, ObjectId } = require('mongodb');
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialmedia';
      const client = await MongoClient.connect(MONGODB_URI);
      const db = client.db();

      // Check mutual follow
      const [userFollowsRecipient, recipientFollowsUser] = await Promise.all([
        db.collection('follows').findOne({
          followerId: new ObjectId(req.user!._id),
          followingId: new ObjectId(recipientId)
        }),
        db.collection('follows').findOne({
          followerId: new ObjectId(recipientId),
          followingId: new ObjectId(req.user!._id)
        })
      ]);

      const isMutualFollow = !!userFollowsRecipient && !!recipientFollowsUser;

      // If not mutual follow, create/update message request
      if (!isMutualFollow) {
        await db.collection('message_requests').updateOne(
          {
            senderId: new ObjectId(req.user!._id),
            recipientId: new ObjectId(recipientId)
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

      await client.close();
    }

    const populatedMessage = await message.populate('sender', 'username fullName profileImage');

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

export default router;

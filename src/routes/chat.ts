import express from 'express';
import auth from '../middleware/auth';
import Message from '../models/message';
import Conversation from '../models/conversation';
import mongoose from 'mongoose';
import { ChatService } from '../services/chat';
import { AnonymousChatService } from '../services/anonymous-chat';
import { messageLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// --- Anonymous Chat Routes ---

// Get Users Online Count (for a tag)
router.get('/anonymous/count', async (req, res) => {
  try {
    const { interest } = req.query;
    const count = await AnonymousChatService.getQueueLength(interest as string);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Join Anonymous Queue (Random Stranger)
router.post('/anonymous/join', auth, async (req, res) => {
  try {
    const { interests } = req.body; // Changed from topic to interests (array)
    const result = await AnonymousChatService.joinQueue(req.userId!, interests);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Leave Anonymous Queue
router.post('/anonymous/leave', auth, async (req, res) => {
  try {
    const { interests } = req.body;
    await AnonymousChatService.leaveQueue(req.userId!, interests);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Skip & Next (Combined Action for efficiency)
router.post('/anonymous/skip', auth, async (req, res) => {
  try {
    const { interests, currentConversationId } = req.body;

    // 1. End current conversation (if any)
    if (currentConversationId) {
      await AnonymousChatService.endAnonymousConversation(currentConversationId, req.userId!);
    }

    // 2. Leave queue (just in case they were waiting)
    await AnonymousChatService.leaveQueue(req.userId!, interests);

    // 3. Join Queue Immediately
    const result = await AnonymousChatService.joinQueue(req.userId!, interests);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Send Anonymous Request to Creator
router.post('/anonymous/request', auth, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const message = await AnonymousChatService.sendAnonymousRequest(req.userId!, recipientId, content);
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Report Stranger
router.post('/anonymous/report', auth, async (req, res) => {
  try {
    const { reportedUserId, conversationId, reason } = req.body;
    if (!reportedUserId || !conversationId || !reason) {
      return res.status(400).json({ message: 'reportedUserId, conversationId, and reason are required' });
    }
    await AnonymousChatService.reportStranger(req.userId!, reportedUserId, conversationId, reason);
    res.json({ success: true, message: 'Report submitted. The user has been blocked.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// --- Standard Chat Routes ---

// Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.user': req.userId,
      $or: [
        { last_message: { $exists: true, $ne: null } },
        { type: 'group' }
      ]
    })
      .populate('participants.user', 'username fullName profileImage')
      .populate('last_message')
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
      'participants.user': { $all: [req.userId, userId] }
    })
      .populate('participants.user', 'username fullName profileImage')
      .populate('last_message');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [
          { user: req.userId, role: 'admin' },
          { user: userId, role: 'member' }
        ],
        created_by: req.userId
      });

      conversation = await conversation.populate('participants.user', 'username fullName profileImage');
    }

    res.json(conversation);
  } catch (error: any) {
    console.error('Conversation creation error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await ChatService.getConversationMessages(
      conversationId,
      req.userId!,
      1, // page (not strictly used if using before cursor, but kept for signature)
      Number(limit),
      before as string
    );

    res.json(messages);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', auth, messageLimiter, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, image, recipientId, type } = req.body;

    const message = await ChatService.sendMessage(
      req.userId!,
      conversationId,
      {
        content,
        media_url: image, // mapping image to media_url
        media_type: image ? 'image' : undefined,
        message_type: type || (image ? 'image' : 'text')
      }
    );

    res.json(message);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
});

// Mark messages as read
router.post('/conversations/:conversationId/read', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.userId },
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

    if (message.sender_id.toString() !== req.userId!.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await message.deleteOne();
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

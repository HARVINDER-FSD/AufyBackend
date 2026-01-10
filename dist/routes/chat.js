"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../middleware/auth"));
const message_1 = __importDefault(require("../models/message"));
const conversation_1 = __importDefault(require("../models/conversation"));
const mongoose_1 = __importDefault(require("mongoose"));
const router = express_1.default.Router();
// Get all conversations for current user
router.get('/conversations', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conversations = yield conversation_1.default.find({
            participants: req.user._id
        })
            .populate('participants', 'username fullName profileImage')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });
        res.json(conversations);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// Get or create conversation with a user
router.post('/conversations', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.body;
        // Check if conversation already exists
        let conversation = yield conversation_1.default.findOne({
            participants: { $all: [req.user._id, userId] }
        })
            .populate('participants', 'username fullName profileImage')
            .populate('lastMessage');
        if (!conversation) {
            // Create new conversation
            conversation = yield conversation_1.default.create({
                participants: [req.user._id, userId]
            });
            conversation = yield conversation.populate('participants', 'username fullName profileImage');
        }
        res.json(conversation);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { conversationId } = req.params;
        const { limit = 50, before } = req.query;
        const query = { conversation: conversationId };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        const messages = yield message_1.default.find(query)
            .populate('sender', 'username fullName profileImage')
            .sort({ createdAt: -1 })
            .limit(Number(limit));
        res.json(messages.reverse());
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// Send a message
router.post('/conversations/:conversationId/messages', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { conversationId } = req.params;
        const { content, image, recipientId } = req.body;
        const message = yield message_1.default.create({
            conversation_id: conversationId,
            sender_id: req.user._id,
            content,
            media_url: image,
            media_type: image ? 'image' : undefined,
            message_type: image ? 'image' : 'text'
        });
        // Update conversation's last message
        yield conversation_1.default.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            updatedAt: new Date()
        });
        // Check if this should create a message request
        if (recipientId) {
            const db = mongoose_1.default.connection.db;
            if (!db) {
                console.error('Database connection not available');
            }
            else {
                // Check mutual follow
                const [userFollowsRecipient, recipientFollowsUser] = yield Promise.all([
                    db.collection('follows').findOne({
                        followerId: new mongoose_1.default.Types.ObjectId(req.user._id),
                        followingId: new mongoose_1.default.Types.ObjectId(recipientId)
                    }),
                    db.collection('follows').findOne({
                        followerId: new mongoose_1.default.Types.ObjectId(recipientId),
                        followingId: new mongoose_1.default.Types.ObjectId(req.user._id)
                    })
                ]);
                const isMutualFollow = !!userFollowsRecipient && !!recipientFollowsUser;
                // If not mutual follow, create/update message request
                if (!isMutualFollow) {
                    yield db.collection('message_requests').updateOne({
                        senderId: new mongoose_1.default.Types.ObjectId(req.user._id),
                        recipientId: new mongoose_1.default.Types.ObjectId(recipientId)
                    }, {
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
                    }, { upsert: true });
                }
            }
        }
        const populatedMessage = yield message.populate('sender', 'username fullName profileImage');
        res.json(populatedMessage);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// Mark messages as read
router.post('/conversations/:conversationId/read', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { conversationId } = req.params;
        yield message_1.default.updateMany({
            conversation: conversationId,
            sender: { $ne: req.user._id },
            read: false
        }, { read: true });
        res.json({ message: 'Messages marked as read' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
// Delete a message
router.delete('/messages/:messageId', auth_1.default, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const message = yield message_1.default.findById(req.params.messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        if (message.sender_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        yield message.deleteOne();
        res.json({ message: 'Message deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}));
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_1 = require("../services/chat");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user conversations
router.get("/conversations", auth_1.authenticateToken, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await chat_1.ChatService.getUserConversations(req.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get or create direct conversation
router.post("/conversations/direct", auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User ID is required",
            });
        }
        const conversation = await chat_1.ChatService.getOrCreateDirectConversation(req.userId, userId);
        res.json({
            success: true,
            data: { conversation },
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get conversation messages
router.get("/conversations/:conversationId/messages", auth_1.authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page, limit } = req.query;
        const result = await chat_1.ChatService.getConversationMessages(conversationId, req.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 50);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Send message
router.post("/conversations/:conversationId/messages", auth_1.authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content, media_url, media_type, message_type, reply_to_id, shared_content } = req.body;
        const message = await chat_1.ChatService.sendMessage(req.userId, conversationId, {
            content,
            media_url,
            media_type,
            message_type: message_type || "text",
            reply_to_id,
            shared_content,
        });
        res.status(201).json({
            success: true,
            data: { message },
            message: "Message sent successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Mark messages as read
router.post("/messages/read", auth_1.authenticateToken, async (req, res) => {
    try {
        const { messageIds } = req.body;
        if (!messageIds || !Array.isArray(messageIds)) {
            return res.status(400).json({
                success: false,
                error: "Message IDs array is required",
            });
        }
        await chat_1.ChatService.markMessagesAsRead(req.userId, messageIds);
        res.json({
            success: true,
            message: "Messages marked as read",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Delete message
router.delete("/messages/:messageId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        await chat_1.ChatService.deleteMessage(messageId, req.userId);
        res.json({
            success: true,
            message: "Message deleted successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.default = router;

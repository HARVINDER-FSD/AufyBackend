import { Router } from "express"
import { ChatService } from "../services/chat"
import { authenticateToken } from "../middleware/auth"

const router = Router()

// Get user conversations
router.get("/conversations", authenticateToken, async (req, res) => {
    try {
        const { page, limit } = req.query

        const result = await ChatService.getUserConversations(
            req.userId!,
            Number.parseInt(page as string) || 1,
            Number.parseInt(limit as string) || 20,
        )

        res.json(result)
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

// Get or create direct conversation
router.post("/conversations/direct", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "User ID is required",
            })
        }

        const conversation = await ChatService.getOrCreateDirectConversation(req.userId!, userId)

        res.json({
            success: true,
            data: { conversation },
        })
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

// Get conversation messages
router.get("/conversations/:conversationId/messages", authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params
        const { page, limit } = req.query

        const result = await ChatService.getConversationMessages(
            conversationId,
            req.userId!,
            Number.parseInt(page as string) || 1,
            Number.parseInt(limit as string) || 50,
        )

        res.json(result)
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

// Send message
router.post("/conversations/:conversationId/messages", authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params
        const { content, media_url, media_type, message_type, reply_to_id, shared_content } = req.body

        const message = await ChatService.sendMessage(req.userId!, conversationId, {
            content,
            media_url,
            media_type,
            message_type: message_type || "text",
            reply_to_id,
            shared_content,
        })

        res.status(201).json({
            success: true,
            data: { message },
            message: "Message sent successfully",
        })
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

// Mark messages as read
router.post("/messages/read", authenticateToken, async (req, res) => {
    try {
        const { messageIds } = req.body

        if (!messageIds || !Array.isArray(messageIds)) {
            return res.status(400).json({
                success: false,
                error: "Message IDs array is required",
            })
        }

        await ChatService.markMessagesAsRead(req.userId!, messageIds)

        res.json({
            success: true,
            message: "Messages marked as read",
        })
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

// Delete message
router.delete("/messages/:messageId", authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params
        await ChatService.deleteMessage(messageId, req.userId!)

        res.json({
            success: true,
            message: "Message deleted successfully",
        })
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        })
    }
})

export default router


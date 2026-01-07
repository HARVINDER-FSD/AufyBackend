"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_1 = require("../services/notification");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user notifications
router.get("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const { page, limit, unread_only } = req.query;
        const result = await notification_1.NotificationService.getUserNotifications(req.userId, Number.parseInt(page) || 1, Number.parseInt(limit) || 20, unread_only === "true");
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get unread count
router.get("/unread-count", auth_1.authenticateToken, async (req, res) => {
    try {
        const count = await notification_1.NotificationService.getUnreadCount(req.userId);
        res.json({
            success: true,
            data: { count },
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Mark all notifications as read
router.put("/read-all", auth_1.authenticateToken, async (req, res) => {
    try {
        await notification_1.NotificationService.markAllAsRead(req.userId);
        res.json({
            success: true,
            message: "All notifications marked as read",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Mark notification as read
router.put("/:notificationId/read", auth_1.authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        await notification_1.NotificationService.markAsRead(notificationId, req.userId);
        res.json({
            success: true,
            message: "Notification marked as read",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Delete notification
router.delete("/:notificationId", auth_1.authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        await notification_1.NotificationService.deleteNotification(notificationId, req.userId);
        res.json({
            success: true,
            message: "Notification deleted successfully",
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

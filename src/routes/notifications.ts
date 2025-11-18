import { Router } from "express"
import { NotificationService } from "../services/notification"
import { authenticateToken } from "../middleware/auth"

const router = Router()

// Get user notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page, limit, unread_only } = req.query

    const result = await NotificationService.getUserNotifications(
      req.userId!,
      Number.parseInt(page as string) || 1,
      Number.parseInt(limit as string) || 20,
      unread_only === "true",
    )

    res.json(result)
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get unread count
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.userId!)

    res.json({
      success: true,
      data: { count },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Mark all notifications as read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    await NotificationService.markAllAsRead(req.userId!)

    res.json({
      success: true,
      message: "All notifications marked as read",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Mark notification as read
router.put("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params
    await NotificationService.markAsRead(notificationId, req.userId!)

    res.json({
      success: true,
      message: "Notification marked as read",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

// Delete notification
router.delete("/:notificationId", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params
    await NotificationService.deleteNotification(notificationId, req.userId!)

    res.json({
      success: true,
      message: "Notification deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router


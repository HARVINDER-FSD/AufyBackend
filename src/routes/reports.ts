import { Router, Response } from "express"
import { ObjectId } from "mongodb"
import { getDatabase } from "../lib/database"
import { getWebSocketService } from "../lib/websocket"

const router = Router()

// Create report
router.post("/", async (req: any, res: Response) => {
  try {
    const { target_id, target_type, reason, description } = req.body
    const userId = req.userId // Assuming middleware populates this, although authenticateToken is used

    if (!target_id || !target_type || !reason) {
      return res.status(400).json({
        success: false,
        error: "target_id, target_type, and reason are required",
      })
    }

    const db = await getDatabase();
    const reportData = {
      reporter_id: userId ? new ObjectId(userId) : null,
      target_id: new ObjectId(target_id),
      target_type, // 'user', 'post', 'reel', 'story'
      reason,
      description,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('reports').insertOne(reportData);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      reportId: result.insertedId
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router;

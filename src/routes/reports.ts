import { Router, Response } from "express"
import { ObjectId } from "mongodb"
import { getDatabase } from "../lib/database"
import { authenticateToken } from "../middleware/auth"
const router = Router()

// Create report
router.post("/", authenticateToken, async (req: any, res: Response) => {
  try {
    const { target_id, target_type, reason, description } = req.body
    const userId = req.userId

    const db = await getDatabase();

    // 🛡️ ANONYMOUS MODE CHECK: Reels are not part of anonymous mode
    if (target_type === 'reel') {
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (user?.isAnonymousMode) {
        return res.status(403).json({
          success: false,
          error: "Reels are not available in Anonymous Mode."
        });
      }
    }

    if (!target_id || !target_type || !reason) {
      return res.status(400).json({
        success: false,
        error: "target_id, target_type, and reason are required",
      })
    }

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

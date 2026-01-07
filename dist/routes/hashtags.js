"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../lib/database");
const router = (0, express_1.Router)();
// Get trending hashtags
router.get("/trending", async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const limitNum = Number.parseInt(limit) || 10;
        const db = await (0, database_1.getDatabase)();
        // Aggregate hashtags from posts
        const hashtags = await db.collection('posts')
            .aggregate([
            {
                $match: {
                    hashtags: { $exists: true, $ne: [] },
                    created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
                }
            },
            { $unwind: '$hashtags' },
            {
                $group: {
                    _id: '$hashtags',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: limitNum },
            {
                $project: {
                    tag: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ])
            .toArray();
        res.json({
            success: true,
            data: hashtags
        });
    }
    catch (error) {
        console.error('Error fetching trending hashtags:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch trending hashtags',
            data: [] // Return empty array on error
        });
    }
});
exports.default = router;

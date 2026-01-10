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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../lib/database");
const router = (0, express_1.Router)();
// Get trending hashtags
router.get("/trending", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit = 10 } = req.query;
        const limitNum = Number.parseInt(limit) || 10;
        const db = yield (0, database_1.getDatabase)();
        // Aggregate hashtags from posts
        const hashtags = yield db.collection('posts')
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
}));
exports.default = router;

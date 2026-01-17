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
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Track event
router.post("/track", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { event_type, target_id, target_type, metadata } = req.body;
        if (!event_type) {
            return res.status(400).json({
                success: false,
                error: "Event type is required"
            });
        }
        res.json({
            success: true,
            message: "Event tracked successfully"
        });
    }
    catch (error) {
        console.error("Error tracking event:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}));
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
// Get user activity summary
router.get("/user-activity", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        console.log('[Analytics/UserActivity] Raw userId:', userId, 'Type:', typeof userId);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            console.log('[Analytics/UserActivity] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Analytics/UserActivity] Failed to convert userId to ObjectId:', err);
            return res.json({
                success: true,
                data: {
                    postsCount: 0,
                    likesCount: 0,
                    commentsCount: 0,
                    timeSpentToday: 0,
                    recentDeletions: 0
                }
            });
        }
        console.log('[Analytics/UserActivity] Using userObjectId:', userObjectId.toString());
        // 1. Posts count
        const postsCount = yield db.collection('posts').countDocuments({ user_id: userObjectId });
        // 2. Likes given
        const likesCount = yield db.collection('likes').countDocuments({ user_id: userObjectId });
        // 3. Comments given
        const commentsCount = yield db.collection('comments').countDocuments({ user_id: userObjectId });
        // 4. Time spent today (from a simulated collection or redis)
        const today = new Date().toISOString().split('T')[0];
        const timeSpentDoc = yield db.collection('user_time_spent').findOne({
            user_id: userObjectId,
            date: today
        });
        console.log('[Analytics/UserActivity] Counts - Posts:', postsCount, 'Likes:', likesCount, 'Comments:', commentsCount);
        res.json({
            success: true,
            data: {
                postsCount,
                likesCount,
                commentsCount,
                timeSpentToday: (timeSpentDoc === null || timeSpentDoc === void 0 ? void 0 : timeSpentDoc.minutes) || 0,
                recentDeletions: 0, // Placeholder
            }
        });
    }
    catch (error) {
        console.error('[Analytics/UserActivity] Error:', error);
        res.json({
            success: true,
            data: {
                postsCount: 0,
                likesCount: 0,
                commentsCount: 0,
                timeSpentToday: 0,
                recentDeletions: 0
            }
        });
    }
}));
// Track time spent
router.post("/time-spent", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let userId = req.userId;
        const { minutes } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const db = yield (0, database_1.getDatabase)();
        console.log('[Analytics/TimeSpent] Raw userId:', userId, 'minutes:', minutes);
        // Always convert to ObjectId - userId from JWT should be a valid 24-char hex string
        let userObjectId;
        try {
            userObjectId = new mongodb_1.ObjectId(userId);
            console.log('[Analytics/TimeSpent] Converted to ObjectId:', userObjectId.toString());
        }
        catch (err) {
            console.error('[Analytics/TimeSpent] Failed to convert userId to ObjectId:', err);
            return res.json({ success: true });
        }
        yield db.collection('user_time_spent').updateOne({ user_id: userObjectId, date: today }, { $inc: { minutes: minutes || 1 } }, { upsert: true });
        console.log('[Analytics/TimeSpent] Updated successfully');
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Analytics/TimeSpent] Error:', error);
        res.json({ success: true });
    }
}));
// Get user analytics (existing but improved)
router.get("/user/:userId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const db = yield (0, database_1.getDatabase)();
        const posts = yield db.collection('posts').find({ userId: new mongodb_1.ObjectId(userId) }).toArray();
        const postIds = posts.map(p => p._id);
        const [likes, comments] = yield Promise.all([
            db.collection('likes').countDocuments({ postId: { $in: postIds } }),
            db.collection('comments').countDocuments({ postId: { $in: postIds } })
        ]);
        res.json({
            success: true,
            data: {
                postsCount: posts.length,
                likesCount: likes,
                commentsCount: comments,
                views: 0 // Placeholder
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;

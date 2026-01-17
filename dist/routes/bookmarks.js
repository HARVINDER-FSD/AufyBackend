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
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
// Get user bookmarks
router.get("/", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        if (!mongodb_1.ObjectId.isValid(userId)) {
            console.error('[Bookmarks] Invalid userId for bookmarks:', userId);
            return res.json({
                success: true,
                data: {
                    bookmarks: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                    },
                },
            });
        }
        const db = yield (0, database_1.getDatabase)();
        const userObjectId = new mongodb_1.ObjectId(userId);
        const total = yield db.collection('bookmarks').countDocuments({ userId: userObjectId });
        const bookmarks = yield db.collection('bookmarks')
            .aggregate([
            { $match: { userId: userObjectId } },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'postId',
                    foreignField: '_id',
                    as: 'post'
                }
            },
            { $unwind: '$post' }
        ]).toArray();
        res.json({
            success: true,
            data: {
                bookmarks,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Add bookmark
router.post("/:postId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const db = yield (0, database_1.getDatabase)();
        // Check if post exists
        const post = yield db.collection('posts').findOne({ _id: new mongodb_1.ObjectId(postId) });
        if (!post) {
            return res.status(404).json({ success: false, error: "Post not found" });
        }
        // Check if already bookmarked
        const existing = yield db.collection('bookmarks').findOne({
            userId: new mongodb_1.ObjectId(userId),
            postId: new mongodb_1.ObjectId(postId)
        });
        if (existing) {
            return res.json({ success: true, message: "Already bookmarked" });
        }
        yield db.collection('bookmarks').insertOne({
            userId: new mongodb_1.ObjectId(userId),
            postId: new mongodb_1.ObjectId(postId),
            createdAt: new Date()
        });
        res.json({
            success: true,
            message: "Post bookmarked successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}));
// Remove bookmark
router.delete("/:postId", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const db = yield (0, database_1.getDatabase)();
        yield db.collection('bookmarks').deleteOne({
            userId: new mongodb_1.ObjectId(userId),
            postId: new mongodb_1.ObjectId(postId)
        });
        res.json({
            success: true,
            message: "Bookmark removed successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}));
exports.default = router;

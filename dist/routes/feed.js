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
const post_1 = require("../services/post");
const auth_1 = require("../middleware/auth");
const redis_1 = require("../lib/redis");
const router = (0, express_1.Router)();
// Get user's personalized feed
router.get("/", auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit } = req.query;
        const pageNum = Number.parseInt(page) || 1;
        const limitNum = Number.parseInt(limit) || 20;
        // Try cache first
        const cacheKey = `feed:${req.userId}:${pageNum}:${limitNum}`;
        const cached = yield (0, redis_1.cacheGet)(cacheKey);
        if (cached) {
            console.log(`✅ Cache hit for feed page ${pageNum}`);
            return res.json(cached);
        }
        const result = yield post_1.PostService.getFeedPosts(req.userId, pageNum, limitNum);
        // Cache for 2 minutes (120 seconds)
        yield (0, redis_1.cacheSet)(cacheKey, result, 120);
        res.json(result);
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
}));
exports.default = router;

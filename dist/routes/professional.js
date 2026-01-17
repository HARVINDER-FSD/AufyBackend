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
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// PATCH /api/professional/account-type - Switch account type
router.patch('/account-type', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { accountType } = req.body;
        if (!['personal', 'business', 'creator'].includes(accountType)) {
            return res.status(400).json({ message: 'Invalid account type' });
        }
        const db = yield (0, database_1.getDatabase)();
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: { accountType, updated_at: new Date() } });
        res.json({ success: true, message: `Switched to ${accountType} account` });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/professional/insights - Get account insights
router.get('/insights', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        // Dummy data for now, but structured
        const insights = {
            reach: 12500,
            impressions: 45000,
            engagement: {
                total: 8500,
                rate: '4.2%'
            },
            audience: {
                followers: 5400,
                following: 800,
                growth: '+12% this month'
            },
            topPosts: [
                { id: '1', reach: 5000, likes: 450 },
                { id: '2', reach: 4200, likes: 380 }
            ]
        };
        res.json({ success: true, data: insights });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/professional/branded-content - Get branded content settings
router.get('/branded-content', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        const settings = ((_a = user === null || user === void 0 ? void 0 : user.settings) === null || _a === void 0 ? void 0 : _a.brandedContent) || {
            enableBrandedContent: false,
            requireApproval: true,
            showDisclosure: true
        };
        res.json({ success: true, settings });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;

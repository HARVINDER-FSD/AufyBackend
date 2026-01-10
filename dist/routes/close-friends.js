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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const close_friend_1 = __importDefault(require("../models/close-friend"));
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get user's close friends list
router.get('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.userId;
        let closeFriendDoc = yield close_friend_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) })
            .populate('close_friend_ids', 'username full_name avatar_url is_verified');
        if (!closeFriendDoc) {
            // Create empty list if doesn't exist
            closeFriendDoc = yield close_friend_1.default.create({
                user_id: new mongoose_1.default.Types.ObjectId(userId),
                close_friend_ids: []
            });
        }
        res.json({
            success: true,
            data: {
                close_friends: closeFriendDoc.close_friend_ids || [],
                count: ((_a = closeFriendDoc.close_friend_ids) === null || _a === void 0 ? void 0 : _a.length) || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching close friends:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch close friends'
        });
    }
}));
// Add user to close friends
router.post('/add/:friendId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { friendId } = req.params;
        if (userId === friendId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot add yourself to close friends'
            });
        }
        let closeFriendDoc = yield close_friend_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        if (!closeFriendDoc) {
            closeFriendDoc = yield close_friend_1.default.create({
                user_id: new mongoose_1.default.Types.ObjectId(userId),
                close_friend_ids: [new mongoose_1.default.Types.ObjectId(friendId)]
            });
        }
        else {
            // Check if already in list
            const alreadyExists = closeFriendDoc.close_friend_ids.some((id) => id.toString() === friendId);
            if (alreadyExists) {
                return res.status(400).json({
                    success: false,
                    error: 'User already in close friends'
                });
            }
            closeFriendDoc.close_friend_ids.push(new mongoose_1.default.Types.ObjectId(friendId));
            closeFriendDoc.updated_at = new Date();
            yield closeFriendDoc.save();
        }
        res.json({
            success: true,
            message: 'Added to close friends',
            data: {
                count: closeFriendDoc.close_friend_ids.length
            }
        });
    }
    catch (error) {
        console.error('Error adding close friend:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add close friend'
        });
    }
}));
// Remove user from close friends
router.delete('/remove/:friendId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { friendId } = req.params;
        const closeFriendDoc = yield close_friend_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        if (!closeFriendDoc) {
            return res.status(404).json({
                success: false,
                error: 'Close friends list not found'
            });
        }
        closeFriendDoc.close_friend_ids = closeFriendDoc.close_friend_ids.filter((id) => id.toString() !== friendId);
        closeFriendDoc.updated_at = new Date();
        yield closeFriendDoc.save();
        res.json({
            success: true,
            message: 'Removed from close friends',
            data: {
                count: closeFriendDoc.close_friend_ids.length
            }
        });
    }
    catch (error) {
        console.error('Error removing close friend:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to remove close friend'
        });
    }
}));
// Check if user is close friend
router.get('/check/:friendId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { friendId } = req.params;
        const closeFriendDoc = yield close_friend_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        const isCloseFriend = (closeFriendDoc === null || closeFriendDoc === void 0 ? void 0 : closeFriendDoc.close_friend_ids.some((id) => id.toString() === friendId)) || false;
        res.json({
            success: true,
            data: {
                is_close_friend: isCloseFriend
            }
        });
    }
    catch (error) {
        console.error('Error checking close friend:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check close friend status'
        });
    }
}));
exports.default = router;

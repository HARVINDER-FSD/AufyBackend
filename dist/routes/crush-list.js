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
const crush_list_1 = __importDefault(require("../models/crush-list"));
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get user's crush list
router.get('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.userId;
        let crushList = yield crush_list_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) })
            .populate('crush_ids', 'username full_name avatar_url is_verified');
        if (!crushList) {
            crushList = yield crush_list_1.default.create({
                user_id: new mongoose_1.default.Types.ObjectId(userId),
                crush_ids: []
            });
        }
        res.json({
            success: true,
            data: {
                crushes: crushList.crush_ids || [],
                count: ((_a = crushList.crush_ids) === null || _a === void 0 ? void 0 : _a.length) || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching crush list:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch crush list'
        });
    }
}));
// Add user to crush list
router.post('/add/:crushId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { crushId } = req.params;
        if (userId === crushId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot add yourself to crush list'
            });
        }
        let crushList = yield crush_list_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        if (!crushList) {
            crushList = yield crush_list_1.default.create({
                user_id: new mongoose_1.default.Types.ObjectId(userId),
                crush_ids: [new mongoose_1.default.Types.ObjectId(crushId)]
            });
        }
        else {
            const alreadyExists = crushList.crush_ids.some((id) => id.toString() === crushId);
            if (alreadyExists) {
                return res.status(400).json({
                    success: false,
                    error: 'User already in crush list'
                });
            }
            crushList.crush_ids.push(new mongoose_1.default.Types.ObjectId(crushId));
            crushList.updated_at = new Date();
            yield crushList.save();
        }
        res.json({
            success: true,
            message: 'Added to crush list',
            data: {
                count: crushList.crush_ids.length
            }
        });
    }
    catch (error) {
        console.error('Error adding to crush list:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add to crush list'
        });
    }
}));
// Remove user from crush list
router.delete('/remove/:crushId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { crushId } = req.params;
        const crushList = yield crush_list_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        if (!crushList) {
            return res.status(404).json({
                success: false,
                error: 'Crush list not found'
            });
        }
        crushList.crush_ids = crushList.crush_ids.filter((id) => id.toString() !== crushId);
        crushList.updated_at = new Date();
        yield crushList.save();
        res.json({
            success: true,
            message: 'Removed from crush list',
            data: {
                count: crushList.crush_ids.length
            }
        });
    }
    catch (error) {
        console.error('Error removing from crush list:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to remove from crush list'
        });
    }
}));
// Check if user is in crush list
router.get('/check/:crushId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { crushId } = req.params;
        const crushList = yield crush_list_1.default.findOne({ user_id: new mongoose_1.default.Types.ObjectId(userId) });
        const isInCrushList = (crushList === null || crushList === void 0 ? void 0 : crushList.crush_ids.some((id) => id.toString() === crushId)) || false;
        res.json({
            success: true,
            data: {
                is_in_crush_list: isInCrushList
            }
        });
    }
    catch (error) {
        console.error('Error checking crush list:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check crush list'
        });
    }
}));
exports.default = router;

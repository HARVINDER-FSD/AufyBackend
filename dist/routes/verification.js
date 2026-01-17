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
// GET /api/verification/status - Get verification status
router.get('/status', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const db = yield (0, database_1.getDatabase)();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        const status = {
            isVerified: (user === null || user === void 0 ? void 0 : user.verified) || false,
            verificationStatus: (user === null || user === void 0 ? void 0 : user.verificationStatus) || 'none', // none, pending, rejected
            verificationType: (user === null || user === void 0 ? void 0 : user.verificationType) || null,
            verificationDate: (user === null || user === void 0 ? void 0 : user.verificationDate) || null,
            rejectionReason: (user === null || user === void 0 ? void 0 : user.rejectionReason) || null
        };
        res.json({ success: true, data: status });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// POST /api/verification/apply - Apply for verification
router.post('/apply', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { type, fullName, documentType, documentNumber } = req.body;
        if (!type || !fullName || !documentType) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const db = yield (0, database_1.getDatabase)();
        yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, {
            $set: {
                verificationStatus: 'pending',
                verificationType: type,
                verificationRequestDate: new Date(),
                verificationDetails: {
                    fullName,
                    documentType,
                    documentNumber
                }
            }
        });
        res.json({
            success: true,
            message: 'Verification request submitted successfully'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/verification/badges - Get available badges (optional)
router.get('/badges', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const badges = [
        { type: 'blue', name: 'Public Creator', icon: '🔵' },
        { type: 'gold', name: 'Business Owner', icon: '🟡' },
        { type: 'purple', name: 'Developer & Tech', icon: '🟣' },
        { type: 'green', name: 'Company/Startup', icon: '🟢' },
        { type: 'grey', name: 'Special Community', icon: '⚪' }
    ];
    res.json({ success: true, data: badges });
}));
exports.default = router;

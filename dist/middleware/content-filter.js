"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.validateAgeAndContent = void 0;
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
const ADULT_KEYWORDS = ['sex', 'nude', 'porn', 'drugs', 'xxx', 'adult', 'nsfw'];
const validateAgeAndContent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId)
            return next();
        const db = yield (0, database_1.getDatabase)();
        const user = yield db.collection('users').findOne({ _id: new mongodb_1.ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // 1. Check if user is currently blocked
        if (user.isBlocked && user.blockedUntil && new Date() < new Date(user.blockedUntil)) {
            return res.status(403).json({
                status: 'blocked',
                message: 'Your account is temporarily blocked due to content violations',
                blockedUntil: user.blockedUntil
            });
        }
        // If blockedUntil has passed, reset block
        if (user.isBlocked && user.blockedUntil && new Date() >= new Date(user.blockedUntil)) {
            yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: { isBlocked: false, blockedUntil: null, contentWarnings: 0 } });
        }
        // 2. Check content for keywords
        const fieldsToCheck = ['content', 'caption', 'text', 'title', 'description', 'texts'];
        let hasAdultContent = false;
        let foundWord = '';
        for (const field of fieldsToCheck) {
            const fieldValue = req.body[field];
            if (typeof fieldValue === 'string') {
                const badWord = ADULT_KEYWORDS.find(word => fieldValue.toLowerCase().includes(word));
                if (badWord) {
                    hasAdultContent = true;
                    foundWord = badWord;
                    break;
                }
            }
            else if (Array.isArray(fieldValue)) {
                // Handle arrays (e.g., stories texts)
                for (const item of fieldValue) {
                    const strToTest = typeof item === 'string' ? item : (item.text || item.content || '');
                    const badWord = ADULT_KEYWORDS.find(word => strToTest.toLowerCase().includes(word));
                    if (badWord) {
                        hasAdultContent = true;
                        foundWord = badWord;
                        break;
                    }
                }
                if (hasAdultContent)
                    break;
            }
        }
        // 3. AI Behavioral Check (Secondary Layer)
        // This helps catch minors who lie about their DOB but post adult content.
        const fullText = fieldsToCheck.map(f => req.body[f]).filter(Boolean).join(' ');
        const { safetyService } = yield Promise.resolve().then(() => __importStar(require('../services/ai/safetyService')));
        const { estimatedAgeGroup } = yield safetyService.estimateAgeFromBehavior(fullText);
        if (estimatedAgeGroup === 'minor') {
            const birthDate = new Date(user.dob || 0);
            const today = new Date();
            let declaredAge = today.getFullYear() - birthDate.getFullYear();
            // If they behave like a minor but claim to be adult, and content is adult-adjacent
            if (declaredAge >= 18 && hasAdultContent) {
                console.log(`⚠️ DISCREPANCY: User ${user.username} behaves like minor but claims age ${declaredAge}. Blocking content.`);
                yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $inc: { contentWarnings: 1 }, $set: { suspiciousBehavior: true } });
                return res.status(403).json({
                    status: 'blocked',
                    message: 'Our AI has detected behavior inconsistent with your declared age. Content blocked for safety verification.',
                    ai_flag: 'AGE_DISCREPANCY'
                });
            }
        }
        if (hasAdultContent && !user.dob) {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required for content verification'
            });
        }
        if (hasAdultContent) {
            // Calculate Age
            const birthDate = new Date(user.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 18) {
                // Increment warnings
                const newWarnings = (user.contentWarnings || 0) + 1;
                let updateFields = { contentWarnings: newWarnings };
                let message = `Content not allowed for users under 18. Warning ${newWarnings}/3.`;
                let status = 'warning';
                if (newWarnings >= 3) {
                    const blockedUntil = new Date();
                    blockedUntil.setHours(blockedUntil.getHours() + 24);
                    updateFields.isBlocked = true;
                    updateFields.blockedUntil = blockedUntil;
                    message = 'Account blocked for 24h due to 3 content violations.';
                    status = 'blocked';
                }
                yield db.collection('users').updateOne({ _id: new mongodb_1.ObjectId(userId) }, { $set: updateFields });
                return res.status(403).json({
                    status: 'blocked',
                    message,
                    warnings: newWarnings,
                    blockedUntil: updateFields.blockedUntil || null
                });
            }
        }
        next();
    }
    catch (error) {
        console.error('Content filter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.validateAgeAndContent = validateAgeAndContent;

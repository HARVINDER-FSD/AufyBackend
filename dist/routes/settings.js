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
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const database_1 = require("../lib/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get all user settings
router.get('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Ensure privateAccount setting is synced with is_private field
        const settings = user.settings || {};
        if (user.is_private !== undefined && settings.privateAccount === undefined) {
            settings.privateAccount = user.is_private;
            console.log('[Settings] Syncing privateAccount from is_private:', user.is_private);
        }
        res.json({ settings });
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}));
// Update user settings (partial update)
router.patch('/', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Merge new settings with existing settings
        const updatedSettings = Object.assign(Object.assign({}, user.settings), req.body);
        // CRITICAL: Sync is_private field with privateAccount setting
        const updateFields = {
            settings: updatedSettings,
            updated_at: new Date()
        };
        // If privateAccount is being updated, also update is_private
        if ('privateAccount' in req.body) {
            updateFields.is_private = req.body.privateAccount;
            console.log('[Settings] Syncing is_private =', req.body.privateAccount);
        }
        yield usersCollection.updateOne({ _id: user._id }, { $set: updateFields });
        res.json({
            message: 'Settings updated successfully',
            settings: updatedSettings
        });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
}));
// Get specific setting category
router.get('/:category', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { category } = req.params;
        const settings = user.settings || {};
        // Return category-specific settings
        const categorySettings = {};
        switch (category) {
            case 'privacy':
                categorySettings.privateAccount = settings.privateAccount;
                categorySettings.showOnlineStatus = settings.showOnlineStatus;
                categorySettings.whoCanMessage = settings.whoCanMessage;
                categorySettings.whoCanSeeStories = settings.whoCanSeeStories;
                categorySettings.whoCanSeeFollowers = settings.whoCanSeeFollowers;
                break;
            case 'messages':
                categorySettings.whoCanMessage = settings.whoCanMessage;
                categorySettings.groupRequests = settings.groupRequests;
                categorySettings.messageReplies = settings.messageReplies;
                categorySettings.showActivityStatus = settings.showActivityStatus;
                categorySettings.readReceipts = settings.readReceipts;
                break;
            case 'media':
                categorySettings.saveOriginalPhotos = settings.saveOriginalPhotos;
                categorySettings.uploadQuality = settings.uploadQuality;
                categorySettings.autoPlayVideos = settings.autoPlayVideos;
                categorySettings.useLessData = settings.useLessData;
                break;
            case 'wellbeing':
                categorySettings.quietModeEnabled = settings.quietModeEnabled;
                categorySettings.quietModeStart = settings.quietModeStart;
                categorySettings.quietModeEnd = settings.quietModeEnd;
                categorySettings.takeBreakEnabled = settings.takeBreakEnabled;
                categorySettings.takeBreakInterval = settings.takeBreakInterval;
                categorySettings.dailyLimitEnabled = settings.dailyLimitEnabled;
                categorySettings.dailyLimitMinutes = settings.dailyLimitMinutes;
                break;
            default:
                return res.json({ settings: user.settings });
        }
        res.json({ settings: categorySettings });
    }
    catch (error) {
        console.error('Error fetching category settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}));
exports.default = router;

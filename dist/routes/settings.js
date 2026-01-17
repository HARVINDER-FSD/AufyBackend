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
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(req.userId) });
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
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(req.userId) });
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
// Get AI settings
router.get('/ai', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(req.userId) });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const settings = user.settings || {};
        res.json({
            aiEnabled: settings.aiEnabled !== false,
            personalizedResponses: settings.personalizedResponses !== false,
            learningEnabled: settings.learningEnabled || false,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI settings' });
    }
}));
// Update AI settings
router.put('/ai', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const update = {
            'settings.aiEnabled': req.body.aiEnabled,
            'settings.personalizedResponses': req.body.personalizedResponses,
            'settings.learningEnabled': req.body.learningEnabled,
            updated_at: new Date()
        };
        yield usersCollection.updateOne({ _id: new mongodb_1.ObjectId(req.userId) }, { $set: update });
        res.json({ success: true, settings: req.body });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update AI settings' });
    }
}));
// Get specific setting category
router.get('/:category', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const user = yield usersCollection.findOne({ _id: new mongodb_1.ObjectId(req.userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { category } = req.params;
        const settings = user.settings || {};
        // Return category-specific settings
        let categorySettings = {};
        switch (category) {
            case 'privacy':
                categorySettings = {
                    privateAccount: settings.privateAccount || false,
                    showOnlineStatus: settings.showOnlineStatus !== false,
                    allowTagging: settings.allowTagging !== false,
                    allowMentions: settings.allowMentions !== false,
                    showReadReceipts: settings.showReadReceipts !== false,
                    whoCanMessage: settings.whoCanMessage || 'everyone',
                    whoCanSeeStories: settings.whoCanSeeStories || 'everyone',
                    whoCanSeeFollowers: settings.whoCanSeeFollowers || 'everyone',
                };
                break;
            case 'notifications':
                categorySettings = {
                    pauseAll: settings.pauseAll || false,
                    postsStoriesComments: settings.postsStoriesComments || true,
                    followingFollowers: settings.followingFollowers || true,
                    messagesCalls: settings.messagesCalls || true,
                    liveReels: settings.liveReels || true,
                    fundraisers: settings.fundraisers || true,
                    fromAnufy: settings.fromAnufy || true,
                };
                break;
            case 'wellbeing':
                categorySettings = {
                    quietModeEnabled: settings.quietModeEnabled || false,
                    quietModeStart: settings.quietModeStart || '22:00',
                    quietModeEnd: settings.quietModeEnd || '07:00',
                    takeBreakEnabled: settings.takeBreakEnabled || false,
                    takeBreakInterval: settings.takeBreakInterval || 20,
                    dailyLimitEnabled: settings.dailyLimitEnabled || false,
                    dailyLimitMinutes: settings.dailyLimitMinutes || 60,
                };
                break;
            default:
                categorySettings = settings;
        }
        res.json({ settings: categorySettings });
    }
    catch (error) {
        console.error('Error fetching category settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}));
exports.default = router;

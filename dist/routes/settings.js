"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const user_1 = __importDefault(require("../models/user"));
const router = express_1.default.Router();
// Get user settings
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await user_1.default.findById(req.user?.userId).select('settings');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Default settings if not set
        const settings = user.settings || {
            darkMode: true,
            privateAccount: false,
            showOnlineStatus: true,
            allowTagging: true,
            allowMentions: true,
            showReadReceipts: true,
            whoCanMessage: 'everyone',
            whoCanSeeStories: 'everyone',
            whoCanSeeFollowers: 'everyone',
            pushNotifications: true,
            emailNotifications: false,
            likes: true,
            comments: true,
            follows: true,
            mentions: true,
            directMessages: true,
            liveVideos: false,
            stories: true,
            posts: true,
            marketing: false,
            security: true,
        };
        res.json({ settings });
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
// Update user settings
router.patch('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await user_1.default.findById(req.user?.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Merge new settings with existing ones
        user.settings = {
            ...user.settings,
            ...req.body,
        };
        await user.save();
        res.json({
            message: 'Settings updated successfully',
            settings: user.settings
        });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
// Update specific setting
router.put('/:key', auth_1.authenticateToken, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const user = await user_1.default.findById(req.user?.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.settings) {
            user.settings = {};
        }
        user.settings[key] = value;
        await user.save();
        res.json({
            message: 'Setting updated successfully',
            key,
            value,
            settings: user.settings
        });
    }
    catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});
exports.default = router;

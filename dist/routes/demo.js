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
const database_1 = require("../lib/database");
const router = (0, express_1.Router)();
// Demo data seeder - adds sample posts and reels
router.post("/seed", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const postsCollection = db.collection('posts');
        const reelsCollection = db.collection('reels');
        // Get or create demo user
        let demoUser = yield usersCollection.findOne({ username: 'demo_user' });
        if (!demoUser) {
            const demoUserData = {
                username: 'demo_user',
                email: 'demo@anufy.com',
                full_name: 'Demo User',
                password: 'hashed_password', // Not used for login
                avatar_url: 'https://i.pravatar.cc/300?img=1',
                bio: 'Demo account with sample content',
                is_verified: true,
                badge_type: 'blue',
                created_at: new Date(),
                updated_at: new Date()
            };
            const result = yield usersCollection.insertOne(demoUserData);
            demoUser = Object.assign(Object.assign({}, demoUserData), { _id: result.insertedId });
        }
        const demoUserId = demoUser._id;
        // Sample captions
        const captions = [
            "Beautiful sunset 🌅",
            "Living my best life ✨",
            "Good vibes only 🌟",
            "Making memories 📸",
            "Adventure awaits 🗺️",
            "Feeling grateful 🙏",
            "Weekend mood 😎",
            "Nature lover 🌿",
            "Coffee time ☕",
            "Chasing dreams 💫",
            "Happy moments 😊",
            "Stay positive ✌️",
            "Life is beautiful 🌸",
            "Enjoying the view 🏔️",
            "Perfect day 🌞",
            "Blessed 🙌",
            "Smile more 😄",
            "Travel vibes ✈️",
            "Foodie life 🍕",
            "Fitness journey 💪"
        ];
        // Create 100 demo posts using Unsplash API
        const posts = [];
        for (let i = 1; i <= 100; i++) {
            const randomCaption = captions[Math.floor(Math.random() * captions.length)];
            const randomLikes = Math.floor(Math.random() * 1000) + 10;
            const randomComments = Math.floor(Math.random() * 100) + 1;
            posts.push({
                user_id: demoUserId,
                image_url: `https://picsum.photos/1080/1080?random=${i}`,
                caption: `${randomCaption} #${i}`,
                likes_count: randomLikes,
                comments_count: randomComments,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
                updated_at: new Date()
            });
        }
        // Create 100 demo reels using sample video URLs
        const reels = [];
        const videoUrls = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
        ];
        for (let i = 1; i <= 100; i++) {
            const randomCaption = captions[Math.floor(Math.random() * captions.length)];
            const randomLikes = Math.floor(Math.random() * 5000) + 50;
            const randomComments = Math.floor(Math.random() * 200) + 5;
            const randomViews = Math.floor(Math.random() * 10000) + 100;
            const videoUrl = videoUrls[i % videoUrls.length];
            reels.push({
                user_id: demoUserId,
                video_url: videoUrl,
                thumbnail_url: `https://picsum.photos/1080/1920?random=${i + 100}`,
                title: `Reel ${i}`,
                description: `${randomCaption} #reel${i}`,
                likes_count: randomLikes,
                comments_count: randomComments,
                shares_count: Math.floor(Math.random() * 50) + 1,
                view_count: randomViews,
                duration: 15000 + Math.floor(Math.random() * 45000), // 15-60 seconds
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                updated_at: new Date()
            });
        }
        // Insert posts and reels
        const postsResult = yield postsCollection.insertMany(posts);
        const reelsResult = yield reelsCollection.insertMany(reels);
        res.json({
            success: true,
            message: 'Demo data seeded successfully',
            data: {
                posts_created: postsResult.insertedCount,
                reels_created: reelsResult.insertedCount,
                demo_user: {
                    id: demoUserId,
                    username: demoUser.username
                }
            }
        });
    }
    catch (error) {
        console.error('Error seeding demo data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// Clear demo data
router.delete("/clear", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const postsCollection = db.collection('posts');
        const reelsCollection = db.collection('reels');
        // Find demo user
        const demoUser = yield usersCollection.findOne({ username: 'demo_user' });
        if (!demoUser) {
            return res.json({
                success: true,
                message: 'No demo data found'
            });
        }
        // Delete demo posts and reels
        const postsDeleted = yield postsCollection.deleteMany({ user_id: demoUser._id });
        const reelsDeleted = yield reelsCollection.deleteMany({ user_id: demoUser._id });
        // Optionally delete demo user
        // await usersCollection.deleteOne({ _id: demoUser._id })
        res.json({
            success: true,
            message: 'Demo data cleared successfully',
            data: {
                posts_deleted: postsDeleted.deletedCount,
                reels_deleted: reelsDeleted.deletedCount
            }
        });
    }
    catch (error) {
        console.error('Error clearing demo data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// Get demo data stats
router.get("/stats", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = yield (0, database_1.getDatabase)();
        const usersCollection = db.collection('users');
        const postsCollection = db.collection('posts');
        const reelsCollection = db.collection('reels');
        const demoUser = yield usersCollection.findOne({ username: 'demo_user' });
        if (!demoUser) {
            return res.json({
                success: true,
                data: {
                    demo_user_exists: false,
                    posts_count: 0,
                    reels_count: 0
                }
            });
        }
        const postsCount = yield postsCollection.countDocuments({ user_id: demoUser._id });
        const reelsCount = yield reelsCollection.countDocuments({ user_id: demoUser._id });
        res.json({
            success: true,
            data: {
                demo_user_exists: true,
                demo_user_id: demoUser._id,
                posts_count: postsCount,
                reels_count: reelsCount
            }
        });
    }
    catch (error) {
        console.error('Error getting demo stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
exports.default = router;

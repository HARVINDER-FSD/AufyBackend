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
exports.initializeFirebase = initializeFirebase;
exports.sendPushNotification = sendPushNotification;
exports.sendMulticastNotification = sendMulticastNotification;
exports.sendNotificationToUser = sendNotificationToUser;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// Initialize Firebase Admin (only once)
let isInitialized = false;
function initializeFirebase() {
    if (isInitialized)
        return;
    try {
        let serviceAccount;
        // Try to load from environment variable first (for Render/production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                console.log('✅ Loaded Firebase credentials from environment variable');
            }
            catch (parseError) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env variable');
                throw parseError;
            }
        }
        else {
            // Fall back to file (for local development)
            serviceAccount = require('../../firebase-service-account.json');
            console.log('✅ Loaded Firebase credentials from file');
        }
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount)
        });
        isInitialized = true;
        console.log('✅ Firebase Admin initialized successfully');
    }
    catch (error) {
        console.warn('⚠️ Firebase service account not found. Push notifications will not work when app is closed.');
        console.warn('To enable: Add FIREBASE_SERVICE_ACCOUNT environment variable or firebase-service-account.json file');
    }
}
function sendPushNotification(fcmToken, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isInitialized) {
            console.warn('Firebase not initialized, skipping push notification');
            return null;
        }
        try {
            const message = {
                token: fcmToken,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: notification.data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default',
                        priority: 'high',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                            contentAvailable: true,
                        },
                    },
                },
            };
            const response = yield firebase_admin_1.default.messaging().send(message);
            console.log('✅ Push notification sent:', response);
            return response;
        }
        catch (error) {
            console.error('❌ Failed to send push notification:', error.message);
            // Return error code for token cleanup
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                return { error: 'invalid_token' };
            }
            throw error;
        }
    });
}
function sendMulticastNotification(fcmTokens, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isInitialized) {
            console.warn('Firebase not initialized, skipping multicast notification');
            return null;
        }
        try {
            const message = {
                tokens: fcmTokens,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: notification.data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                        },
                    },
                },
            };
            const response = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
            console.log(`✅ Sent ${response.successCount}/${fcmTokens.length} notifications`);
            // Return failed tokens for cleanup
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(fcmTokens[idx]);
                }
            });
            return { successCount: response.successCount, failedTokens };
        }
        catch (error) {
            console.error('❌ Failed to send multicast notification:', error);
            throw error;
        }
    });
}
// Helper to send notification to user by ID
function sendNotificationToUser(userId, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Import User model dynamically to avoid circular dependencies
            const User = require('../models/user').default;
            const user = yield User.findById(userId);
            // Check for FCM token (singular field)
            if (!(user === null || user === void 0 ? void 0 : user.fcmToken)) {
                console.log('No FCM token for user:', userId);
                return;
            }
            // Send to user's device
            const result = yield sendPushNotification(user.fcmToken, {
                title: notification.title,
                body: notification.body,
                data: Object.assign({ type: notification.type }, notification.data)
            });
            // Clean up invalid token
            if (result && typeof result === 'object' && result.error === 'invalid_token') {
                yield User.findByIdAndUpdate(userId, {
                    $set: { fcmToken: null }
                });
                console.log(`Removed invalid FCM token for user ${userId}`);
            }
            return result;
        }
        catch (error) {
            console.error('Error sending notification to user:', error);
        }
    });
}

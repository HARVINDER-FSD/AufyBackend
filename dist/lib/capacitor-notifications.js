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
exports.notificationService = void 0;
// Capacitor Push Notifications & Local Notifications
const push_notifications_1 = require("@capacitor/push-notifications");
const local_notifications_1 = require("@capacitor/local-notifications");
const badge_1 = require("@capacitor/badge");
const core_1 = require("@capacitor/core");
class CapacitorNotificationService {
    constructor() {
        this.isInitialized = false;
        this.fcmToken = null;
        this.unreadCount = 0;
    }
    // Check if running on native platform
    isNative() {
        return core_1.Capacitor.isNativePlatform();
    }
    // Initialize push notifications
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized)
                return;
            if (!this.isNative()) {
                console.log('📱 Not on native platform, using web notifications');
                yield this.initializeWebNotifications();
                return;
            }
            try {
                // Request permission
                const permission = yield push_notifications_1.PushNotifications.requestPermissions();
                if (permission.receive === 'granted') {
                    yield push_notifications_1.PushNotifications.register();
                    console.log('✅ Push notifications registered');
                }
                else {
                    console.warn('⚠️ Push notification permission denied');
                }
                // Listen for registration
                yield push_notifications_1.PushNotifications.addListener('registration', (token) => {
                    this.fcmToken = token.value;
                    console.log('📱 FCM Token:', token.value);
                    // Send token to your backend
                    this.sendTokenToBackend(token.value);
                });
                // Listen for registration errors
                yield push_notifications_1.PushNotifications.addListener('registrationError', (error) => {
                    console.error('❌ Push notification registration error:', error);
                });
                // Listen for push notifications received
                yield push_notifications_1.PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('📨 Push notification received:', notification);
                    this.handleNotificationReceived(notification);
                });
                // Listen for notification actions
                yield push_notifications_1.PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    console.log('👆 Notification action performed:', notification);
                    this.handleNotificationAction(notification);
                });
                // Initialize local notifications
                yield local_notifications_1.LocalNotifications.requestPermissions();
                this.isInitialized = true;
            }
            catch (error) {
                console.error('❌ Error initializing notifications:', error);
            }
        });
    }
    // Initialize web notifications (fallback)
    initializeWebNotifications() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!('Notification' in window)) {
                console.warn('⚠️ Browser does not support notifications');
                return;
            }
            if (Notification.permission === 'default') {
                const permission = yield Notification.requestPermission();
                console.log('🔔 Web notification permission:', permission);
            }
        });
    }
    // Send FCM token to backend
    sendTokenToBackend(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch('/api/notifications/register-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ fcmToken: token })
                });
                if (response.ok) {
                    console.log('✅ FCM token registered with backend');
                }
            }
            catch (error) {
                console.error('❌ Error sending token to backend:', error);
            }
        });
    }
    // Handle notification received (app in foreground)
    handleNotificationReceived(notification) {
        const { title, body, data } = notification;
        // Show local notification
        this.showLocalNotification({
            title: title || 'New notification',
            body: body || '',
            data: data
        });
        // Update badge count
        if ((data === null || data === void 0 ? void 0 : data.type) === 'message') {
            this.incrementBadge();
        }
        // Trigger custom event for UI updates
        window.dispatchEvent(new CustomEvent('notification-received', {
            detail: { title, body, data }
        }));
    }
    // Handle notification action (user tapped notification)
    handleNotificationAction(action) {
        const { notification } = action;
        const data = notification.data;
        // Navigate based on notification type
        if ((data === null || data === void 0 ? void 0 : data.type) === 'message' && (data === null || data === void 0 ? void 0 : data.conversationId)) {
            window.location.href = `/messages?conversation=${data.conversationId}`;
        }
        else if ((data === null || data === void 0 ? void 0 : data.type) === 'like' && (data === null || data === void 0 ? void 0 : data.postId)) {
            window.location.href = `/posts/${data.postId}`;
        }
        else if ((data === null || data === void 0 ? void 0 : data.type) === 'comment' && (data === null || data === void 0 ? void 0 : data.postId)) {
            window.location.href = `/posts/${data.postId}`;
        }
        else if ((data === null || data === void 0 ? void 0 : data.type) === 'follow' && (data === null || data === void 0 ? void 0 : data.userId)) {
            window.location.href = `/profile/${data.userId}`;
        }
        // Clear badge when opening app
        this.clearBadge();
    }
    // Show local notification
    showLocalNotification(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (this.isNative()) {
                    yield local_notifications_1.LocalNotifications.schedule({
                        notifications: [
                            {
                                title: payload.title,
                                body: payload.body,
                                id: Date.now(),
                                extra: payload.data,
                                sound: 'default',
                                smallIcon: 'ic_stat_icon_config_sample',
                                iconColor: '#2dd4bf'
                            }
                        ]
                    });
                }
                else {
                    // Web notification
                    if (Notification.permission === 'granted') {
                        new Notification(payload.title, {
                            body: payload.body,
                            icon: '/anufy-icon.svg',
                            badge: '/anufy-icon.svg',
                            data: payload.data,
                            tag: ((_a = payload.data) === null || _a === void 0 ? void 0 : _a.conversationId) || 'notification'
                        });
                    }
                }
            }
            catch (error) {
                console.error('❌ Error showing local notification:', error);
            }
        });
    }
    // Update badge count
    setBadge(count) {
        return __awaiter(this, void 0, void 0, function* () {
            this.unreadCount = count;
            try {
                if (this.isNative()) {
                    yield badge_1.Badge.set({ count });
                }
                else {
                    // Web badge API
                    if ('setAppBadge' in navigator) {
                        yield navigator.setAppBadge(count);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error setting badge:', error);
            }
        });
    }
    // Increment badge
    incrementBadge() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setBadge(this.unreadCount + 1);
        });
    }
    // Clear badge
    clearBadge() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setBadge(0);
        });
    }
    // Get current badge count
    getBadgeCount() {
        return this.unreadCount;
    }
    // Get FCM token
    getToken() {
        return this.fcmToken;
    }
    // Cleanup
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isNative()) {
                yield push_notifications_1.PushNotifications.removeAllListeners();
                yield local_notifications_1.LocalNotifications.removeAllListeners();
            }
            this.isInitialized = false;
        });
    }
}
// Export singleton instance
exports.notificationService = new CapacitorNotificationService();

"use strict";
// Polling-based notifications (works on Vercel)
// This is a temporary solution until you set up WebSockets on a separate server
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
exports.useNotificationPolling = useNotificationPolling;
exports.useChatPolling = useChatPolling;
const react_1 = require("react");
function useNotificationPolling(userId, interval = 10000) {
    const [notifications, setNotifications] = (0, react_1.useState)([]);
    const [unreadCount, setUnreadCount] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        if (!userId)
            return;
        const fetchNotifications = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = localStorage.getItem('token') ||
                    ((_a = document.cookie.split('; ').find(row => row.startsWith('client-token='))) === null || _a === void 0 ? void 0 : _a.split('=')[1]);
                if (!token) {
                    // No token, skip silently
                    return;
                }
                const response = yield fetch('/api/notifications', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = yield response.json();
                    setNotifications(data.notifications || []);
                    setUnreadCount(data.unread_count || 0);
                }
                else if (response.status === 401) {
                    // Unauthorized, stop polling
                    return;
                }
            }
            catch (error) {
                // Silently fail - don't spam console
            }
        });
        // Fetch immediately
        fetchNotifications();
        // Then poll every interval
        const intervalId = setInterval(fetchNotifications, interval);
        return () => clearInterval(intervalId);
    }, [userId, interval]);
    return { notifications, unreadCount };
}
function useChatPolling(conversationId, interval = 3000) {
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [lastMessageId, setLastMessageId] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (!conversationId)
            return;
        const fetchMessages = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = localStorage.getItem('token') ||
                    ((_a = document.cookie.split('; ').find(row => row.startsWith('client-token='))) === null || _a === void 0 ? void 0 : _a.split('=')[1]);
                const url = lastMessageId
                    ? `/api/messages/conversations/${conversationId}/messages?after=${lastMessageId}`
                    : `/api/messages/conversations/${conversationId}/messages`;
                const response = yield fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = yield response.json();
                    if (data.messages && data.messages.length > 0) {
                        setMessages(prev => [...prev, ...data.messages]);
                        setLastMessageId(data.messages[data.messages.length - 1].id);
                    }
                }
            }
            catch (error) {
                console.error('Failed to fetch messages:', error);
            }
        });
        // Fetch immediately
        fetchMessages();
        // Then poll every interval
        const intervalId = setInterval(fetchMessages, interval);
        return () => clearInterval(intervalId);
    }, [conversationId, lastMessageId, interval]);
    return { messages, setMessages };
}

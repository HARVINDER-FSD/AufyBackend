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
exports.getOrCreateConversation = getOrCreateConversation;
exports.sendMessage = sendMessage;
exports.uploadChatMedia = uploadChatMedia;
exports.subscribeToMessages = subscribeToMessages;
exports.subscribeToConversations = subscribeToConversations;
exports.addReaction = addReaction;
exports.deleteMessage = deleteMessage;
exports.markMessagesAsRead = markMessagesAsRead;
exports.getConversation = getConversation;
// Firebase Chat Service - Real-time messaging
const firestore_1 = require("firebase/firestore");
const firebase_config_1 = require("./firebase-config");
// Create or get conversation
function getOrCreateConversation(userId, recipientId) {
    return __awaiter(this, void 0, void 0, function* () {
        const participants = [userId, recipientId].sort();
        // Check if conversation exists
        const conversationsRef = (0, firestore_1.collection)(firebase_config_1.db, 'conversations');
        const q = (0, firestore_1.query)(conversationsRef, (0, firestore_1.where)('participants', '==', participants));
        const snapshot = yield (0, firestore_1.getDocs)(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }
        // Create new conversation
        const newConversation = {
            participants,
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
            unreadCount: {
                [userId]: 0,
                [recipientId]: 0
            }
        };
        const docRef = yield (0, firestore_1.addDoc)(conversationsRef, newConversation);
        return docRef.id;
    });
}
// Send message
function sendMessage(conversationId_1, senderId_1, content_1) {
    return __awaiter(this, arguments, void 0, function* (conversationId, senderId, content, messageType = 'text', options) {
        const messagesRef = (0, firestore_1.collection)(firebase_config_1.db, 'messages');
        // Build message object without undefined fields
        const message = {
            conversationId,
            senderId,
            content,
            messageType,
            reactions: [],
            createdAt: (0, firestore_1.serverTimestamp)(),
            readBy: [senderId]
        };
        // Only add optional fields if they have values
        if (options === null || options === void 0 ? void 0 : options.mediaUrl) {
            message.mediaUrl = options.mediaUrl;
        }
        if (options === null || options === void 0 ? void 0 : options.sharedContent) {
            message.sharedContent = options.sharedContent;
        }
        if (options === null || options === void 0 ? void 0 : options.replyTo) {
            message.replyTo = options.replyTo;
        }
        const docRef = yield (0, firestore_1.addDoc)(messagesRef, message);
        // Update conversation
        const conversationRef = (0, firestore_1.doc)(firebase_config_1.db, 'conversations', conversationId);
        const conversationDoc = yield (0, firestore_1.getDoc)(conversationRef);
        if (conversationDoc.exists()) {
            const participants = conversationDoc.data().participants;
            const unreadCount = {};
            participants.forEach(participantId => {
                if (participantId !== senderId) {
                    unreadCount[`unreadCount.${participantId}`] = (0, firestore_1.increment)(1);
                }
            });
            yield (0, firestore_1.updateDoc)(conversationRef, Object.assign({ lastMessage: {
                    content: content.substring(0, 100),
                    senderId,
                    timestamp: (0, firestore_1.serverTimestamp)()
                }, updatedAt: (0, firestore_1.serverTimestamp)() }, unreadCount));
        }
        return docRef.id;
    });
}
// Upload media to Cloudinary (instead of Firebase Storage)
function uploadChatMedia(file, conversationId, senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', `chat/${conversationId}`);
        const response = yield fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to upload media');
        }
        const data = yield response.json();
        return data.url;
    });
}
// Listen to messages in real-time
function subscribeToMessages(conversationId, callback) {
    const messagesRef = (0, firestore_1.collection)(firebase_config_1.db, 'messages');
    const q = (0, firestore_1.query)(messagesRef, (0, firestore_1.where)('conversationId', '==', conversationId), (0, firestore_1.orderBy)('createdAt', 'asc'));
    return (0, firestore_1.onSnapshot)(q, (snapshot) => {
        const messages = snapshot.docs
            .map(doc => (Object.assign({ id: doc.id }, doc.data())))
            .filter(msg => !msg.isDeleted); // Filter deleted messages in code instead of query
        callback(messages);
    });
}
// Listen to conversations in real-time
function subscribeToConversations(userId, callback) {
    const conversationsRef = (0, firestore_1.collection)(firebase_config_1.db, 'conversations');
    const q = (0, firestore_1.query)(conversationsRef, (0, firestore_1.where)('participants', 'array-contains', userId), (0, firestore_1.orderBy)('updatedAt', 'desc'));
    return (0, firestore_1.onSnapshot)(q, (snapshot) => {
        const conversations = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        callback(conversations);
    });
}
// Add reaction to message
function addReaction(messageId, userId, emoji) {
    return __awaiter(this, void 0, void 0, function* () {
        const messageRef = (0, firestore_1.doc)(firebase_config_1.db, 'messages', messageId);
        const messageDoc = yield (0, firestore_1.getDoc)(messageRef);
        if (!messageDoc.exists())
            return;
        const reactions = messageDoc.data().reactions || [];
        const existingReaction = reactions.find((r) => r.userId === userId && r.emoji === emoji);
        if (existingReaction) {
            // Remove reaction
            yield (0, firestore_1.updateDoc)(messageRef, {
                reactions: (0, firestore_1.arrayRemove)(existingReaction)
            });
        }
        else {
            // Add reaction
            yield (0, firestore_1.updateDoc)(messageRef, {
                reactions: (0, firestore_1.arrayUnion)({
                    userId,
                    emoji,
                    timestamp: (0, firestore_1.serverTimestamp)()
                })
            });
        }
    });
}
// Delete message
function deleteMessage(messageId) {
    return __awaiter(this, void 0, void 0, function* () {
        const messageRef = (0, firestore_1.doc)(firebase_config_1.db, 'messages', messageId);
        yield (0, firestore_1.updateDoc)(messageRef, {
            isDeleted: true,
            content: 'This message was deleted',
            updatedAt: (0, firestore_1.serverTimestamp)()
        });
    });
}
// Mark messages as read
function markMessagesAsRead(conversationId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const messagesRef = (0, firestore_1.collection)(firebase_config_1.db, 'messages');
        const q = (0, firestore_1.query)(messagesRef, (0, firestore_1.where)('conversationId', '==', conversationId), (0, firestore_1.where)('senderId', '!=', userId));
        const snapshot = yield (0, firestore_1.getDocs)(q);
        const batch = [];
        snapshot.docs.forEach(doc => {
            const readBy = doc.data().readBy || [];
            if (!readBy.includes(userId)) {
                batch.push((0, firestore_1.updateDoc)(doc.ref, {
                    readBy: (0, firestore_1.arrayUnion)(userId)
                }));
            }
        });
        yield Promise.all(batch);
        // Reset unread count
        const conversationRef = (0, firestore_1.doc)(firebase_config_1.db, 'conversations', conversationId);
        yield (0, firestore_1.updateDoc)(conversationRef, {
            [`unreadCount.${userId}`]: 0
        });
    });
}
// Get conversation details
function getConversation(conversationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const conversationRef = (0, firestore_1.doc)(firebase_config_1.db, 'conversations', conversationId);
        const conversationDoc = yield (0, firestore_1.getDoc)(conversationRef);
        if (!conversationDoc.exists())
            return null;
        return Object.assign({ id: conversationDoc.id }, conversationDoc.data());
    });
}

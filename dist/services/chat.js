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
exports.ChatService = void 0;
const database_1 = require("../lib/database");
const websocket_1 = require("../lib/websocket");
const utils_1 = require("../lib/utils");
const config_1 = require("../lib/config");
const conversation_1 = __importDefault(require("../models/conversation"));
const message_1 = __importDefault(require("../models/message"));
const user_1 = __importDefault(require("../models/user"));
class ChatService {
    // Create or get direct conversation
    static getOrCreateDirectConversation(userId1, userId2) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userId1 === userId2) {
                throw utils_1.errors.badRequest("Cannot create conversation with yourself");
            }
            // Check if conversation already exists
            // We want a direct conversation where BOTH users are participants
            const existingConversation = yield conversation_1.default.findOne({
                type: 'direct',
                $and: [
                    { 'participants.user': userId1 },
                    { 'participants.user': userId2 }
                ]
            });
            if (existingConversation) {
                return yield this.getConversationWithParticipants(existingConversation._id.toString(), userId1);
            }
            // Create new conversation
            const newConversation = yield conversation_1.default.create({
                type: 'direct',
                created_by: userId1,
                participants: [
                    { user: userId1, role: 'member', joined_at: new Date() },
                    { user: userId2, role: 'member', joined_at: new Date() }
                ]
            });
            return yield this.getConversationWithParticipants(newConversation._id.toString(), userId1);
        });
    }
    // Create group conversation
    static createGroupConversation(creatorId, name, participantIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!name || name.trim().length === 0) {
                throw utils_1.errors.badRequest("Group name is required");
            }
            if (participantIds.length < 2) {
                throw utils_1.errors.badRequest("Group must have at least 2 participants");
            }
            if (participantIds.length > 100) {
                throw utils_1.errors.badRequest("Group cannot have more than 100 participants");
            }
            // Remove duplicates and ensure creator is included
            const uniqueParticipants = Array.from(new Set([creatorId, ...participantIds]));
            const participants = uniqueParticipants.map(userId => ({
                user: userId,
                role: userId === creatorId ? 'admin' : 'member',
                joined_at: new Date()
            }));
            const newConversation = yield conversation_1.default.create({
                type: 'group',
                name: name.trim(),
                created_by: creatorId,
                participants
            });
            return yield this.getConversationWithParticipants(newConversation._id.toString(), creatorId);
        });
    }
    // Get conversation with participants
    static getConversationWithParticipants(conversationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cacheKey = utils_1.cacheKeys.conversation(conversationId);
            const cachedConversation = yield database_1.cache.get(cacheKey);
            if (cachedConversation) {
                return cachedConversation;
            }
            // Get conversation details
            const conversation = yield conversation_1.default.findById(conversationId)
                .populate('participants.user', 'username full_name avatar_url is_verified')
                .populate({
                path: 'last_message',
                populate: { path: 'sender_id', select: 'username full_name' }
            });
            if (!conversation) {
                throw utils_1.errors.notFound("Conversation not found");
            }
            // Verify user is participant
            const participant = conversation.participants.find(p => p.user && p.user._id.toString() === userId && !p.left_at);
            if (!participant) {
                throw utils_1.errors.forbidden("You are not a participant in this conversation");
            }
            // Get unread count for current user
            const unreadCount = yield message_1.default.countDocuments({
                conversation_id: conversationId,
                sender_id: { $ne: userId },
                is_deleted: false,
                'read_by.user_id': { $ne: userId }
            });
            // Format response
            // Map Mongoose document to Conversation interface
            // Note: The interface in types.ts expects `last_message` as Message type.
            // My Mongoose model has `last_message` as ObjectId or populated doc.
            let lastMessage = null;
            if (conversation.last_message) {
                const lm = conversation.last_message;
                lastMessage = {
                    id: lm._id.toString(),
                    content: lm.content,
                    media_url: lm.media_url,
                    message_type: lm.message_type,
                    created_at: lm.created_at,
                    sender: lm.sender_id ? {
                        username: lm.sender_id.username,
                        full_name: lm.sender_id.full_name
                    } : null
                };
            }
            const participants = conversation.participants
                .filter(p => !p.left_at)
                .map(p => {
                const u = p.user;
                return {
                    id: u._id.toString(),
                    username: u.username,
                    full_name: u.full_name,
                    avatar_url: u.avatar_url,
                    is_verified: u.is_verified,
                    role: p.role,
                    joined_at: p.joined_at
                };
            });
            const conversationWithDetails = {
                id: conversation._id.toString(),
                type: conversation.type,
                name: conversation.name,
                created_by: conversation.created_by.toString(),
                created_at: conversation.created_at, // timestamps
                updated_at: conversation.updated_at,
                participants: participants, // Cast to avoid strict type issues with User interface
                last_message: lastMessage,
                unread_count: unreadCount,
            };
            // Cache the conversation
            yield database_1.cache.set(cacheKey, conversationWithDetails, config_1.config.redis.ttl.user);
            return conversationWithDetails;
        });
    }
    // Get user conversations
    static getUserConversations(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const skip = (validPage - 1) * validLimit;
            // Find conversations where user is a participant and hasn't left
            const query = {
                'participants': {
                    $elemMatch: {
                        user: userId,
                        left_at: null
                    }
                }
            };
            const total = yield conversation_1.default.countDocuments(query);
            const conversationsDocs = yield conversation_1.default.find(query)
                .sort({ updated_at: -1 }) // or updatedAt
                .skip(skip)
                .limit(validLimit);
            const conversations = yield Promise.all(conversationsDocs.map((doc) => __awaiter(this, void 0, void 0, function* () {
                return yield this.getConversationWithParticipants(doc._id.toString(), userId);
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: conversations,
                pagination: paginationMeta,
            };
        });
    }
    // Send message
    static sendMessage(senderId, conversationId, messageData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { content, media_url, media_type, message_type, reply_to_id } = messageData;
            // Validate message
            if (!content && !media_url) {
                throw utils_1.errors.badRequest("Message must have content or media");
            }
            if (content && content.length > 4000) {
                throw utils_1.errors.badRequest("Message content too long (max 4000 characters)");
            }
            // Verify conversation exists and user is participant
            const conversation = yield conversation_1.default.findById(conversationId);
            if (!conversation) {
                throw utils_1.errors.notFound("Conversation not found");
            }
            const isParticipant = conversation.participants.some(p => p.user.toString() === senderId && !p.left_at);
            if (!isParticipant) {
                throw utils_1.errors.forbidden("You are not a participant in this conversation");
            }
            // Verify reply-to message exists (if provided)
            if (reply_to_id) {
                const replyTo = yield message_1.default.findOne({
                    _id: reply_to_id,
                    conversation_id: conversationId,
                    is_deleted: false
                });
                if (!replyTo) {
                    throw utils_1.errors.notFound("Reply-to message not found");
                }
            }
            // Create message
            const newMessage = yield message_1.default.create({
                conversation_id: conversationId,
                sender_id: senderId,
                content,
                media_url,
                media_type,
                message_type: message_type || 'text',
                reply_to_id
            });
            // Update conversation timestamp and last message
            conversation.last_message = newMessage._id;
            // Mongoose handles updatedAt automatically on save
            yield conversation.save();
            // Get sender info
            const sender = yield user_1.default.findById(senderId).select('username full_name avatar_url is_verified');
            // Get reply-to message details if exists
            let replyToMessage = null;
            if (reply_to_id) {
                const rt = yield message_1.default.findById(reply_to_id).populate('sender_id', 'username full_name');
                if (rt) {
                    replyToMessage = {
                        id: rt._id.toString(),
                        content: rt.content,
                        media_url: rt.media_url,
                        message_type: rt.message_type,
                        created_at: rt.created_at,
                        sender: rt.sender_id ? {
                            username: rt.sender_id.username,
                            full_name: rt.sender_id.full_name
                        } : null
                    };
                }
            }
            const messageWithDetails = {
                id: newMessage._id.toString(),
                conversation_id: conversationId,
                sender_id: senderId,
                content: newMessage.content,
                media_url: newMessage.media_url,
                media_type: newMessage.media_type,
                message_type: newMessage.message_type,
                reply_to_id: newMessage.reply_to_id ? newMessage.reply_to_id.toString() : undefined,
                is_deleted: newMessage.is_deleted,
                created_at: newMessage.created_at,
                updated_at: newMessage.updated_at,
                sender: sender ? {
                    id: sender._id.toString(),
                    username: sender.username,
                    full_name: sender.full_name,
                    avatar_url: sender.avatar_url,
                    is_verified: sender.is_verified
                } : undefined,
                reply_to: replyToMessage,
                is_read: false,
            };
            // Clear conversation cache
            yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId));
            // Send real-time message
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendMessageToConversation(conversationId, messageWithDetails);
            return messageWithDetails;
        });
    }
    // Get conversation messages
    static getConversationMessages(conversationId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (conversationId, userId, page = 1, limit = 50) {
            // Verify conversation and participation
            const conversation = yield conversation_1.default.findOne({
                _id: conversationId,
                'participants': { $elemMatch: { user: userId, left_at: null } }
            });
            if (!conversation) {
                throw utils_1.errors.forbidden("You are not a participant in this conversation or it doesn't exist");
            }
            const { page: validPage, limit: validLimit } = utils_1.pagination.validateParams(page.toString(), limit.toString());
            const skip = (validPage - 1) * validLimit;
            const query = {
                conversation_id: conversationId,
                is_deleted: false
            };
            const total = yield message_1.default.countDocuments(query);
            // Get messages with sender info
            const messagesDocs = yield message_1.default.find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(validLimit)
                .populate('sender_id', 'username full_name avatar_url is_verified')
                .populate({
                path: 'reply_to_id',
                populate: { path: 'sender_id', select: 'username full_name' }
            });
            const messages = yield Promise.all(messagesDocs.map((doc) => __awaiter(this, void 0, void 0, function* () {
                const sender = doc.sender_id;
                // Construct reply_to object
                let replyTo = null;
                if (doc.reply_to_id) {
                    const rt = doc.reply_to_id;
                    replyTo = {
                        id: rt._id.toString(),
                        content: rt.content,
                        media_url: rt.media_url,
                        message_type: rt.message_type,
                        created_at: rt.created_at,
                        sender: rt.sender_id ? {
                            username: rt.sender_id.username,
                            full_name: rt.sender_id.full_name
                        } : null
                    };
                }
                // Check is_read
                const isRead = doc.read_by && doc.read_by.some(r => r.user_id.toString() === userId);
                const message = {
                    id: doc._id.toString(),
                    conversation_id: doc.conversation_id.toString(),
                    sender_id: doc.sender_id._id.toString(),
                    content: doc.content,
                    media_url: doc.media_url,
                    media_type: doc.media_type,
                    message_type: doc.message_type,
                    reply_to_id: doc.reply_to_id ? doc.reply_to_id._id.toString() : undefined,
                    is_deleted: doc.is_deleted,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at,
                    sender: {
                        id: sender._id.toString(),
                        username: sender.username,
                        full_name: sender.full_name,
                        avatar_url: sender.avatar_url,
                        is_verified: sender.is_verified,
                    },
                    reply_to: replyTo,
                    is_read: !!isRead
                };
                return message;
            })));
            const paginationMeta = utils_1.pagination.getMetadata(validPage, validLimit, total);
            return {
                success: true,
                data: messages.reverse(), // Reverse to show oldest first
                pagination: paginationMeta,
            };
        });
    }
    // Mark messages as read
    static markMessagesAsRead(userId, messageIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (messageIds.length === 0)
                return;
            // Update messages to add user to read_by array if not already present
            yield message_1.default.updateMany({
                _id: { $in: messageIds },
                'read_by.user_id': { $ne: userId } // Only if not already read by this user
            }, {
                $addToSet: {
                    read_by: {
                        user_id: userId,
                        read_at: new Date()
                    }
                }
            });
            // Get conversation IDs for cache invalidation
            const messages = yield message_1.default.find({ _id: { $in: messageIds } }).distinct('conversation_id');
            for (const conversationId of messages) {
                yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId.toString()));
            }
        });
    }
    // Delete message
    static deleteMessage(messageId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = yield message_1.default.findOne({ _id: messageId, sender_id: userId });
            if (!message) {
                throw utils_1.errors.notFound("Message not found or you don't have permission to delete it");
            }
            message.is_deleted = true;
            yield message.save();
            const conversationId = message.conversation_id.toString();
            yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId));
            // Notify participants about message deletion
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendMessageToConversation(conversationId, {
                type: "message_deleted",
                messageId,
                deletedBy: userId,
                timestamp: new Date(),
            });
        });
    }
    // Add participant to group
    static addParticipant(conversationId, adminId, newParticipantId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify admin permissions
            const conversation = yield conversation_1.default.findOne({
                _id: conversationId,
                'participants': {
                    $elemMatch: {
                        user: adminId,
                        role: 'admin',
                        left_at: null
                    }
                }
            });
            if (!conversation) {
                throw utils_1.errors.forbidden("Only group admins can add participants");
            }
            // Check if user is already a participant
            const existingParticipant = conversation.participants.find(p => p.user.toString() === newParticipantId && !p.left_at);
            if (existingParticipant) {
                throw utils_1.errors.conflict("User is already a participant");
            }
            // Add participant
            // Check if they were previously a participant and left
            const oldParticipantIndex = conversation.participants.findIndex(p => p.user.toString() === newParticipantId);
            if (oldParticipantIndex > -1) {
                conversation.participants[oldParticipantIndex].left_at = undefined;
                conversation.participants[oldParticipantIndex].joined_at = new Date();
            }
            else {
                conversation.participants.push({
                    user: newParticipantId,
                    role: 'member',
                    joined_at: new Date()
                });
            }
            yield conversation.save();
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId));
            // Send notification
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendMessageToConversation(conversationId, {
                type: "participant_added",
                participantId: newParticipantId,
                addedBy: adminId,
                timestamp: new Date(),
            });
        });
    }
    // Remove participant from group
    static removeParticipant(conversationId, adminId, participantId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify admin permissions
            const conversation = yield conversation_1.default.findOne({
                _id: conversationId,
                'participants': {
                    $elemMatch: {
                        user: adminId,
                        role: 'admin',
                        left_at: null
                    }
                }
            });
            if (!conversation) {
                throw utils_1.errors.forbidden("Only group admins can remove participants");
            }
            // Cannot remove yourself as admin
            if (adminId === participantId) {
                throw utils_1.errors.badRequest("Admins cannot remove themselves");
            }
            // Remove participant
            const participantIndex = conversation.participants.findIndex(p => p.user.toString() === participantId && !p.left_at);
            if (participantIndex === -1) {
                throw utils_1.errors.notFound("Participant not found");
            }
            conversation.participants[participantIndex].left_at = new Date();
            yield conversation.save();
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId));
            // Send notification
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendMessageToConversation(conversationId, {
                type: "participant_removed",
                participantId,
                removedBy: adminId,
                timestamp: new Date(),
            });
        });
    }
    // Leave conversation
    static leaveConversation(conversationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield conversation_1.default.findById(conversationId);
            if (!conversation) {
                throw utils_1.errors.notFound("Conversation not found");
            }
            const participantIndex = conversation.participants.findIndex(p => p.user.toString() === userId && !p.left_at);
            if (participantIndex === -1) {
                throw utils_1.errors.notFound("You are not a participant in this conversation");
            }
            conversation.participants[participantIndex].left_at = new Date();
            yield conversation.save();
            // Clear cache
            yield database_1.cache.del(utils_1.cacheKeys.conversation(conversationId));
            // Send notification
            const wsService = (0, websocket_1.getWebSocketService)();
            wsService.sendMessageToConversation(conversationId, {
                type: "participant_left",
                participantId: userId,
                timestamp: new Date(),
            });
        });
    }
}
exports.ChatService = ChatService;

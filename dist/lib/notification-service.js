"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.notifyPostLike = notifyPostLike;
exports.notifyPostComment = notifyPostComment;
exports.notifyFollow = notifyFollow;
exports.notifyMention = notifyMention;
exports.notifyCommentReply = notifyCommentReply;
exports.notifyStoryLike = notifyStoryLike;
exports.notifyStoryReply = notifyStoryReply;
exports.notifyReelLike = notifyReelLike;
exports.notifyReelComment = notifyReelComment;
// Notification Service - Helper functions to create notifications
const notification_1 = __importDefault(require("@/models/notification"));
async function createNotification(params) {
    try {
        // Don't create notification if sender and recipient are the same
        if (params.senderId === params.recipientId) {
            return null;
        }
        // Check if similar notification already exists (prevent duplicates)
        const existingNotification = await notification_1.default.findOne({
            recipient_id: params.recipientId,
            sender_id: params.senderId,
            type: params.type,
            content_id: params.contentId,
            created_at: { $gte: new Date(Date.now() - 60000) } // Within last minute
        });
        if (existingNotification) {
            return existingNotification;
        }
        // Create new notification
        const notification = await notification_1.default.create({
            recipient_id: params.recipientId,
            sender_id: params.senderId,
            type: params.type,
            content_id: params.contentId,
            content_type: params.contentType,
            message: params.message,
            is_read: false
        });
        return notification;
    }
    catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}
// Helper functions for specific notification types
async function notifyPostLike(postOwnerId, likerId, postId) {
    return createNotification({
        recipientId: postOwnerId,
        senderId: likerId,
        type: 'like',
        contentId: postId,
        contentType: 'post'
    });
}
async function notifyPostComment(postOwnerId, commenterId, postId, commentText) {
    return createNotification({
        recipientId: postOwnerId,
        senderId: commenterId,
        type: 'comment',
        contentId: postId,
        contentType: 'post',
        message: commentText.substring(0, 100) // First 100 chars
    });
}
async function notifyFollow(followedUserId, followerId) {
    return createNotification({
        recipientId: followedUserId,
        senderId: followerId,
        type: 'follow'
    });
}
async function notifyMention(mentionedUserId, mentionerId, contentId, contentType) {
    return createNotification({
        recipientId: mentionedUserId,
        senderId: mentionerId,
        type: 'mention',
        contentId,
        contentType
    });
}
async function notifyCommentReply(commentOwnerId, replierId, commentId, replyText) {
    return createNotification({
        recipientId: commentOwnerId,
        senderId: replierId,
        type: 'reply',
        contentId: commentId,
        contentType: 'comment',
        message: replyText.substring(0, 100)
    });
}
async function notifyStoryLike(storyOwnerId, likerId, storyId) {
    return createNotification({
        recipientId: storyOwnerId,
        senderId: likerId,
        type: 'story_like',
        contentId: storyId,
        contentType: 'story'
    });
}
async function notifyStoryReply(storyOwnerId, replierId, storyId, replyText) {
    return createNotification({
        recipientId: storyOwnerId,
        senderId: replierId,
        type: 'story_reply',
        contentId: storyId,
        contentType: 'story',
        message: replyText.substring(0, 100)
    });
}
async function notifyReelLike(reelOwnerId, likerId, reelId) {
    return createNotification({
        recipientId: reelOwnerId,
        senderId: likerId,
        type: 'reel_like',
        contentId: reelId,
        contentType: 'reel'
    });
}
async function notifyReelComment(reelOwnerId, commenterId, reelId, commentText) {
    return createNotification({
        recipientId: reelOwnerId,
        senderId: commenterId,
        type: 'reel_comment',
        contentId: reelId,
        contentType: 'reel',
        message: commentText.substring(0, 100)
    });
}

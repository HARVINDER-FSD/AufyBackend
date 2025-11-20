// Notification Model for MongoDB
import { ObjectId } from 'mongodb';

export interface Notification {
  _id?: ObjectId;
  userId: ObjectId; // Recipient user ID
  actorId: ObjectId; // User who performed the action
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'share' | 'follow_request' | 'follow_accept';
  postId?: ObjectId;
  commentId?: ObjectId;
  conversationId?: string;
  content?: string; // Comment text, message preview, etc.
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationWithActor extends Notification {
  actor: {
    _id: ObjectId;
    username: string;
    fullName?: string;
    avatar?: string;
    verified?: boolean;
  };
  post?: {
    _id: ObjectId;
    image?: string;
  };
}

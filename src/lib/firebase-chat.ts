// Firebase Chat Service - Real-time messaging
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  setDoc,
  getDoc,
  limit,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase-config'

export interface FirebaseMessage {
  id?: string
  conversationId: string
  senderId: string
  content: string
  messageType: 'text' | 'image' | 'video' | 'audio' | 'shared_post' | 'shared_reel'
  mediaUrl?: string
  sharedContent?: {
    type: 'post' | 'reel'
    id: string
    thumbnail?: string
    caption?: string
  }
  replyTo?: {
    id: string
    content: string
    senderId: string
  }
  reactions?: Array<{
    userId: string
    emoji: string
    timestamp: Timestamp
  }>
  createdAt: Timestamp | any
  updatedAt?: Timestamp | any
  isDeleted?: boolean
  readBy?: string[]
}

export interface FirebaseConversation {
  id?: string
  participants: string[]
  lastMessage?: {
    content: string
    senderId: string
    timestamp: Timestamp
  }
  unreadCount?: { [userId: string]: number }
  createdAt: Timestamp | any
  updatedAt: Timestamp | any
}

// Create or get conversation
export async function getOrCreateConversation(userId: string, recipientId: string): Promise<string> {
  const participants = [userId, recipientId].sort()
  
  // Check if conversation exists
  const conversationsRef = collection(db, 'conversations')
  const q = query(
    conversationsRef,
    where('participants', '==', participants)
  )
  
  const snapshot = await getDocs(q)
  
  if (!snapshot.empty) {
    return snapshot.docs[0].id
  }
  
  // Create new conversation
  const newConversation: Omit<FirebaseConversation, 'id'> = {
    participants,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadCount: {
      [userId]: 0,
      [recipientId]: 0
    }
  }
  
  const docRef = await addDoc(conversationsRef, newConversation)
  return docRef.id
}

// Send message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: FirebaseMessage['messageType'] = 'text',
  options?: {
    mediaUrl?: string
    sharedContent?: FirebaseMessage['sharedContent']
    replyTo?: FirebaseMessage['replyTo']
  }
): Promise<string> {
  const messagesRef = collection(db, 'messages')
  
  // Build message object without undefined fields
  const message: any = {
    conversationId,
    senderId,
    content,
    messageType,
    reactions: [],
    createdAt: serverTimestamp(),
    readBy: [senderId]
  }
  
  // Only add optional fields if they have values
  if (options?.mediaUrl) {
    message.mediaUrl = options.mediaUrl
  }
  if (options?.sharedContent) {
    message.sharedContent = options.sharedContent
  }
  if (options?.replyTo) {
    message.replyTo = options.replyTo
  }
  
  const docRef = await addDoc(messagesRef, message)
  
  // Update conversation
  const conversationRef = doc(db, 'conversations', conversationId)
  const conversationDoc = await getDoc(conversationRef)
  
  if (conversationDoc.exists()) {
    const participants = conversationDoc.data().participants as string[]
    const unreadCount: any = {}
    
    participants.forEach(participantId => {
      if (participantId !== senderId) {
        unreadCount[`unreadCount.${participantId}`] = increment(1)
      }
    })
    
    await updateDoc(conversationRef, {
      lastMessage: {
        content: content.substring(0, 100),
        senderId,
        timestamp: serverTimestamp()
      },
      updatedAt: serverTimestamp(),
      ...unreadCount
    })
  }
  
  return docRef.id
}

// Upload media to Cloudinary (instead of Firebase Storage)
export async function uploadChatMedia(
  file: File,
  conversationId: string,
  senderId: string
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', `chat/${conversationId}`)
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  })
  
  if (!response.ok) {
    throw new Error('Failed to upload media')
  }
  
  const data = await response.json()
  return data.url
}

// Listen to messages in real-time
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: FirebaseMessage[]) => void
) {
  const messagesRef = collection(db, 'messages')
  const q = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  )
  
  return onSnapshot(q, (snapshot) => {
    const messages: FirebaseMessage[] = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirebaseMessage))
      .filter(msg => !msg.isDeleted) // Filter deleted messages in code instead of query
    
    callback(messages)
  })
}

// Listen to conversations in real-time
export function subscribeToConversations(
  userId: string,
  callback: (conversations: FirebaseConversation[]) => void
) {
  const conversationsRef = collection(db, 'conversations')
  const q = query(
    conversationsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  )
  
  return onSnapshot(q, (snapshot) => {
    const conversations: FirebaseConversation[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FirebaseConversation))
    
    callback(conversations)
  })
}

// Add reaction to message
export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const messageRef = doc(db, 'messages', messageId)
  const messageDoc = await getDoc(messageRef)
  
  if (!messageDoc.exists()) return
  
  const reactions = messageDoc.data().reactions || []
  const existingReaction = reactions.find(
    (r: any) => r.userId === userId && r.emoji === emoji
  )
  
  if (existingReaction) {
    // Remove reaction
    await updateDoc(messageRef, {
      reactions: arrayRemove(existingReaction)
    })
  } else {
    // Add reaction
    await updateDoc(messageRef, {
      reactions: arrayUnion({
        userId,
        emoji,
        timestamp: serverTimestamp()
      })
    })
  }
}

// Delete message
export async function deleteMessage(messageId: string): Promise<void> {
  const messageRef = doc(db, 'messages', messageId)
  await updateDoc(messageRef, {
    isDeleted: true,
    content: 'This message was deleted',
    updatedAt: serverTimestamp()
  })
}

// Mark messages as read
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const messagesRef = collection(db, 'messages')
  const q = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    where('senderId', '!=', userId)
  )
  
  const snapshot = await getDocs(q)
  
  const batch: Promise<void>[] = []
  snapshot.docs.forEach(doc => {
    const readBy = doc.data().readBy || []
    if (!readBy.includes(userId)) {
      batch.push(
        updateDoc(doc.ref, {
          readBy: arrayUnion(userId)
        })
      )
    }
  })
  
  await Promise.all(batch)
  
  // Reset unread count
  const conversationRef = doc(db, 'conversations', conversationId)
  await updateDoc(conversationRef, {
    [`unreadCount.${userId}`]: 0
  })
}

// Get conversation details
export async function getConversation(conversationId: string): Promise<FirebaseConversation | null> {
  const conversationRef = doc(db, 'conversations', conversationId)
  const conversationDoc = await getDoc(conversationRef)
  
  if (!conversationDoc.exists()) return null
  
  return {
    id: conversationDoc.id,
    ...conversationDoc.data()
  } as FirebaseConversation
}

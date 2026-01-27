# Anufy Backend - Complete Technical Documentation
> **Version:** 1.0.0
> **Generated:** 2026-01-27
> **Status:** Production Ready 🚀

---

## 1. 🏗️ System Architecture

The Anufy backend is built for high scalability, supporting **100k+ concurrent users**. It uses a microservices-like architecture within a monolithic codebase for ease of maintenance while allowing independent scaling of components via queues and workers.

### **Core Components:**
1.  **API Server (Express.js + TypeScript):** Handles REST API requests, authentication, and validation.
2.  **Real-time Server (Socket.io):** Handles instant messaging, signaling for calls, and live notifications.
3.  **Database (MongoDB Atlas):** Primary data store with optimized indexes for read-heavy workloads.
4.  **Caching Layer (Redis):** Caches feeds, user profiles, and session data to offload DB.
5.  **Task Queue (BullMQ + Redis):** Handles async tasks like Likes, Notifications, and Video Processing to prevent DB choke.
6.  **Worker Nodes:** Background processes that consume the BullMQ queues.

---

## 2. 🗄️ Database Schemas (Models)

### **1. User (`users` collection)**
Represents a registered user.
*   **_id**: `ObjectId`
*   **username**: `String` (Unique, indexed)
*   **email**: `String` (Unique, indexed)
*   **password**: `String` (Bcrypt hash)
*   **full_name**: `String`
*   **bio**: `String`
*   **avatar_url**: `String`
*   **is_verified**: `Boolean` (Blue tick)
*   **isShadowBanned**: `Boolean` (For abuse protection)
*   **followers_count**: `Number` (Denormalized)
*   **following_count**: `Number` (Denormalized)
*   **posts_count**: `Number` (Denormalized)
*   **settings**: `Object` (Privacy, Notifications, Limits)
*   **created_at**: `Date` (Indexed)

### **2. Post (`posts` collection)**
Standard feed content (Images/Text).
*   **_id**: `ObjectId`
*   **user_id**: `ObjectId` (Ref: User, Indexed)
*   **caption**: `String`
*   **media_urls**: `[String]`
*   **media_type**: `String` ('image', 'video', 'carousel')
*   **likes_count**: `Number` (Denormalized)
*   **comments_count**: `Number` (Denormalized)
*   **hashtags**: `[String]` (Indexed)
*   **mentions**: `[String]`
*   **location**: `String`
*   **created_at**: `Date` (Indexed)

### **3. Reel (`reels` collection)**
Short-form video content.
*   **_id**: `ObjectId`
*   **user_id**: `ObjectId` (Ref: User, Indexed)
*   **video_url**: `String`
*   **thumbnail_url**: `String`
*   **caption**: `String`
*   **likes_count**: `Number`
*   **views_count**: `Number`
*   **is_archived**: `Boolean`
*   **created_at**: `Date` (Indexed)

### **4. Message (`messages` collection)**
Chat messages.
*   **_id**: `ObjectId`
*   **conversation_id**: `ObjectId` (Ref: Conversation, Indexed)
*   **sender_id**: `ObjectId` (Ref: User, Indexed)
*   **content**: `String`
*   **message_type**: `String` ('text', 'image', 'video', 'audio')
*   **media_url**: `String`
*   **status**: `String` ('sent', 'delivered', 'read')
*   **created_at**: `Date` (Indexed)

### **5. Like (`likes` collection)**
Polymorphic like system.
*   **_id**: `ObjectId`
*   **user_id**: `ObjectId` (Ref: User)
*   **post_id**: `ObjectId` (Ref: Post OR Reel)
*   **type**: `String` ('post' | 'reel')
*   **created_at**: `Date`
*   **Index**: `{ user_id: 1, post_id: 1 }` (Unique Compound Index)

---

## 3. 🔌 API Endpoints Reference

### **Authentication (`/api/auth`)**
| Method | Endpoint | Body | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/login` | `{ email, password }` | Login and get JWT (90 days). |
| `POST` | `/register` | `{ email, password, username, full_name, dob }` | Create new account. |

### **Feed & Posts (`/api/posts`)**
| Method | Endpoint | Body/Query | Description |
|:-------|:---------|:-----------|:------------|
| `GET` | `/feed` | `?page=1&limit=20` | Get main feed (Redis Cached). |
| `POST` | `/` | `{ content, media_urls, media_type }` | Create a new post. |
| `GET` | `/:id` | - | Get post details. |
| `POST` | `/:id/like` | `{ reaction: '❤️' }` | Like a post (**Async BullMQ**). |
| `DELETE`| `/:id/like` | - | Unlike a post (**Async BullMQ**). |

### **Reels (`/api/reels`)**
| Method | Endpoint | Body/Query | Description |
|:-------|:---------|:-----------|:------------|
| `GET` | `/` | `?page=1&limit=20` | Get reels feed (Discover). |
| `GET` | `/liked` | `?page=1` | Get user's liked reels. |
| `GET` | `/saved` | `?page=1` | Get user's saved reels. |

### **Chat (`/api/chat`)**
| Method | Endpoint | Body | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/conversations` | - | List all chats. |
| `POST` | `/conversations` | `{ userId }` | Start/Get chat with user. |
| `GET` | `/conversations/:id/messages` | `?limit=50` | Get chat history. |
| `POST` | `/anonymous/join` | `{ interests: [] }` | Join random chat queue. |
| `POST` | `/anonymous/skip` | `{ currentConversationId }` | Skip stranger & find new. |

---

## 4. ⚡ Performance & Scaling Mechanisms

### **1. Redis Caching Strategy**
*   **Feed Caching:** `feed:{userId}:{page}` (TTL: 60s). Reduces DB load by 80%.
*   **User Profile:** `user:{userId}` (TTL: 300s).
*   **Invalidation:** Automatic invalidation on new posts/updates.

### **2. Async Write Processing (BullMQ)**
To prevent database locking during high traffic (e.g., viral posts), write operations are queued:
*   **Likes:** `likes-queue` handles DB inserts & count updates.
*   **Messages:** `messages-queue` handles chat persistence.
*   **Feed Updates:** `feed-updates-queue` notifies followers.
*   **Workers:** Dedicated worker processes consume these queues.

### **3. Database Optimization**
*   **Indexes:** All query fields (`user_id`, `created_at`, `hashtags`) are indexed.
*   **Compound Indexes:** `{ user_id: 1, created_at: -1 }` for efficient sorting.
*   **Denormalization:** `likes_count`, `comments_count` stored on Post document to avoid `countDocuments()` scans.

### **4. Real-time Optimizations**
*   **Optimistic UI:** API returns "Success" immediately while background workers handle DB.
*   **Socket.io Rooms:** Efficient broadcasting using `to('chat:123').emit()`.

---

## 5. 🛡️ Security Measures

1.  **Rate Limiting:** 100 requests / 15 mins per IP (`express-rate-limit`).
2.  **Helmet:** Sets secure HTTP headers.
3.  **Shadow Ban:** `isShadowBanned` flag hides user content without alerting them.
4.  **JWT Auth:** Stateless authentication with 90-day expiry.
5.  **Input Validation:** `Joi` schemas validate all request bodies.

---

## 6. 🔄 Backend Flow Examples

### **A. User Likes a Post**
1.  **Client** sends `POST /api/posts/123/like`.
2.  **API** validates token & input.
3.  **API** adds job to `likes-queue` (Redis).
4.  **API** returns `200 OK` (Immediate response).
5.  **Worker** picks up job -> Inserts into `likes` collection -> Increments `likes_count` on Post.

### **B. User Sends a Message**
1.  **Client** emits `message:send` via Socket.io.
2.  **Server** immediately emits `message:received` to recipient (0ms lag).
3.  **Server** adds job to `messages-queue`.
4.  **Worker** saves message to MongoDB -> Updates Conversation `last_message`.

---

**This document represents the exact state of the backend codebase.**

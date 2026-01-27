# 📘 Complete Social Media Backend Documentation
**Project:** Social Media Backend (Final)
**Version:** 1.0.0 (Production Ready)
**Architecture:** "Makhan Mode" (Zero-Latency)
**Scale:** 100k+ Concurrent Users

---

## 🏗️ 1. Architecture Overview
The backend is designed for **high-scale** and **zero perceived latency**. It uses an **Optimistic UI/Server** pattern where user actions (Likes, Messages) are acknowledged immediately, while heavy database operations happen in the background.

### **Core Stack**
*   **API Server:** Node.js + Express (TypeScript)
*   **Database:** MongoDB Atlas (Primary Storage)
*   **Caching:** Redis (Upstash) - For Feeds & Session Storage
*   **Queue System:** BullMQ - For Async Writes (Likes, Messages)
*   **Real-Time:** Socket.io - For Chat & Notifications
*   **Storage:** Cloudinary - For Images & Videos

### **Data Flow Diagram (Makhan Mode)**
```mermaid
graph TD
    User[📱 Mobile App] -->|HTTPS| LB[🛡️ Nginx / Load Balancer]
    LB --> API[🚀 API Server]
    
    subgraph "Synchronous (Instant Response)"
        API -->|1. Validate| Auth[🔐 Auth Middleware]
        API -->|2. Optimistic Response| User
        API -->|3. Emit Event| Socket[🔌 Socket.io]
        Socket -->|Real-time| Recipient[👤 Other User]
    end
    
    subgraph "Asynchronous (Background)"
        API -->|4. Add Job| Queue[📨 BullMQ (Redis)]
        Queue -->|5. Process Job| Worker[👷 Background Worker]
        Worker -->|6. Persist| DB[(🍃 MongoDB)]
    end
```

---

## 🔌 2. API Reference (Detailed Fields)

### **A. Authentication (`/api/auth`)**
| Endpoint | Method | Body Parameters | Response |
| :--- | :--- | :--- | :--- |
| `/login` | `POST` | `email`, `password` | `{ token, user: { _id, username, ... } }` |
| `/register` | `POST` | `email`, `password`, `username`, `full_name`, `dob` | `{ token, user }` |

### **B. Posts & Feed (`/api/posts`)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/feed` | `GET` | `page`, `limit` | Returns personalized feed (Cached in Redis 60s). |
| `/create` | `POST` | `caption`, `image_url` (Array), `location`, `tags` | Creates a new post. |
| `/:id/like` | `POST` | *None* | **Async:** Adds like via BullMQ. |
| `/:id/comments` | `GET` | `page`, `limit` | Fetches comments (paginated). |

### **C. Reels (`/api/reels`)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `page`, `limit`, `username` | **Infinite Scroll:** Returns reels (CamelCase response). |
| `/create` | `POST` | `video_url`, `thumbnail_url`, `description`, `duration` | Uploads a new reel. |
| `/:id/like` | `POST` | *None* | **Async:** Adds like via BullMQ (Zero Latency). |
| `/:id/share` | `POST` | *None* | Increments share count. |
| `/liked` | `GET` | `page`, `limit` | Get reels liked by current user. |
| `/saved` | `GET` | `page`, `limit` | Get reels saved by current user. |

**Reel Response Object (CamelCase):**
```json
{
  "_id": "ObjectId",
  "videoUrl": "String",
  "thumbnail": "String",
  "title": "String",
  "description": "String",
  "duration": "Number",
  "likesCount": "Number",
  "viewsCount": "Number",
  "commentsCount": "Number",
  "sharesCount": "Number",
  "createdAt": "Date",
  "author": {
    "_id": "ObjectId",
    "username": "String",
    "avatar": "String"
  }
}
```

### **D. Chat & Messaging (`/api/chat`)**
**Features:** 1-on-1, Group, Anonymous Mode (Omegle-style).

**1. WebSocket Events (Primary - Zero Latency)**
*   `message:send` (Client -> Server): `{ chatId, content, recipientId }`
    *   **Behavior:** Emits `message:received` immediately to room, then queues DB save.
*   `message:received` (Server -> Client): Full message object.
*   `chat:join` / `chat:leave`: Manage room presence.

**2. REST Endpoints (Secondary / History)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/conversations` | `GET` | *None* | Inbox list (Last message, unread count). |
| `/conversations/:id/messages` | `GET` | `limit`, `before` | Get chat history (Reverse chronological). |
| `/conversations/:id/messages` | `POST` | `content`, `image`, `type` | **Sync:** Send msg. Types: `text`, `image`, `lottie_voice`. |
| `/anonymous/join`| `POST` | `interests` | Join random chat queue. |
| `/anonymous/skip`| `POST` | `currentConversationId` | End current & find next partner. |

**Message Object Structure:**
```json
{
  "id": "ObjectId",
  "conversation_id": "ObjectId",
  "sender": {
    "id": "ObjectId",
    "username": "String",
    "avatar_url": "String",
    "is_anonymous": "Boolean"
  },
  "content": "String (or Emoji ID)",
  "message_type": "text | image | lottie_voice",
  "media_url": "String (Audio URL for lottie_voice)",
  "is_read": "Boolean",
  "created_at": "Date"
}
```

### **E. Stories (`/api/stories`)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | *None* | Active stories of following users (Strict Privacy). |
| `/` | `POST` | `media_url`, `media_type`, `caption` | Post a new story (24h expiry). |
| `/:id/view` | `POST` | *None* | Track view (Upsert logic). |
| `/:id/viewers` | `GET` | *None* | Get list of viewers (Owner only). |

**Story Object Structure:**
```json
{
  "id": "ObjectId",
  "user_id": "ObjectId",
  "username": "String",
  "avatar_url": "String",
  "media_url": "String",
  "expires_at": "Date",
  "views_count": "Number",
  "is_verified": "Boolean"
}
```

### **F. Notifications (`/api/notifications`)**
| Endpoint | Method | Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `limit`, `skip`, `unreadOnly` | Get user notifications. |
| `/unread-count` | `GET` | *None* | Get raw count of unread items. |
| `/read-all` | `PUT` | *None* | Mark all as read. |

**Notification Object Structure:**
```json
{
  "id": "ObjectId",
  "type": "String (like_post, comment, follow, etc.)",
  "user": { "username": "String", "avatar": "String" },
  "content": "String",
  "post": { "id": "ObjectId", "image": "String" },
  "isRead": "Boolean",
  "timestamp": "String (e.g. '2m ago')"
}
```

---

## 🛡️ 3. Security & Scalability

### **Scalability Strategy**
1.  **Database Optimization:**
    *   **Indexes:** `{ user_id: 1, created_at: -1 }` on Posts/Reels for fast user profile loads.
    *   **Denormalization:** Likes/Comments counts are stored on the Post document to avoid `countDocuments()` queries on every read.
2.  **Async Writes (BullMQ):**
    *   Likes and Messages are NOT written to MongoDB immediately.
    *   They go to a **Redis Queue** first, then a background worker saves them in batches.
    *   **Benefit:** Database never gets choked during viral spikes.
3.  **Redis Caching:**
    *   Feed results are cached for **60 seconds**.
    *   User profiles are cached for **5 minutes**.

### **Security Measures**
1.  **Shadow Ban System:**
    *   Users marked as `isShadowBanned: true` can post, but their content is **hidden** from the public feed.
    *   They are excluded from "Verified" lists.
2.  **Rate Limiting:**
    *   Global limit: **100 requests / 15 mins** per IP.
    *   Login limit: **20 attempts / 15 mins**.
3.  **Headers:**
    *   `Helmet` enabled for HTTP security headers.
    *   `CORS` restricted in production.
    *   `Joi` Validation for all inputs.

---

## 🛠️ 4. Maintenance & Monitoring
*   **Logs:** stored in `logs/` directory (Winston).
*   **Health Check:** `/health` endpoint checks MongoDB & Redis connectivity.
*   **Metrics:** Prometheus middleware enabled at `/metrics`.

---

**Prepared for:** User / ChatGPT Analysis
**Generated by:** Trae AI

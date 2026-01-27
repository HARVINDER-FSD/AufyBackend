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

**Post Object Structure:**
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (Ref: User)",
  "caption": "String",
  "media": [
    { "url": "String", "type": "image/video" }
  ],
  "likes_count": "Number (Denormalized)",
  "comments_count": "Number (Denormalized)",
  "created_at": "Date (Indexed)"
}
```

### **C. Reels (`/api/reels`)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `page`, `limit` | **Infinite Scroll:** Returns random/algo-sorted reels. |
| `/create` | `POST` | `video_url`, `thumbnail_url`, `description`, `duration` | Uploads a new reel. |
| `/:id/like` | `POST` | *None* | **Async:** Adds like via BullMQ. |
| `/:id/share` | `POST` | *None* | Increments share count. |

**Reel Object Structure:**
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "video_url": "String",
  "thumbnail_url": "String",
  "duration": "Number (seconds)",
  "likes_count": "Number",
  "views_count": "Number",
  "shares_count": "Number"
}
```

### **D. Chat & Messaging (`/api/chat`)**
**Features:** 1-on-1, Group, Anonymous Mode (Omegle-style).

| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/conversations` | `GET` | *None* | List all active conversations (Inbox). |
| `/conversations` | `POST` | `userId` | Start/Get conversation with a user. |
| `/:id/messages` | `GET` | `limit`, `before` (Cursor) | Get chat history. |
| `/:id/messages` | `POST` | `content`, `image` | **Optimistic:** Sends message & queues DB save. |
| `/anonymous/join`| `POST` | `interests` (Array) | Join random chat queue. |
| `/anonymous/skip`| `POST` | `currentConversationId` | End current & find next partner. |

**Message Object Structure:**
```json
{
  "_id": "ObjectId",
  "conversation_id": "ObjectId",
  "sender_id": "ObjectId",
  "content": "String",
  "media_url": "String (Optional)",
  "read": "Boolean (Default: false)",
  "created_at": "Date"
}
```

### **E. Stories (`/api/stories`)**
| Endpoint | Method | Body / Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | *None* | Get active stories of following users (24h expiry). |
| `/` | `POST` | `media_url`, `media_type`, `caption` | Post a new story. |
| `/:id/view` | `POST` | *None* | Mark story as viewed (Tracks viewer list). |

### **F. Notifications (`/api/notifications`)**
| Endpoint | Method | Query | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `limit`, `skip`, `unreadOnly` | Get user notifications. |
| `/read-all` | `PUT` | *None* | Mark all as read. |

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

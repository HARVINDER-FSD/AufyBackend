# AnuFy Backend API

Social media backend API built with Node.js, Express, and MongoDB.

## Features

- 🔐 Authentication (JWT)
- 👤 User management
- 📝 Posts, Reels, Stories
- 💬 Comments & Likes
- 🔔 Notifications
- 💌 Direct messaging
- 🔍 Search functionality
- 📊 Analytics
- ⚙️ Settings management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **Authentication**: JWT + bcrypt
- **Language**: TypeScript

## Prerequisites

- Node.js 16+ 
- MongoDB (local or Atlas)
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your MongoDB URI and JWT secret
```

## Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5001
NODE_ENV=development
```

## Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5001`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/me` - Get current user
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users/username/:username` - Get user by username
- `PUT /api/users/profile` - Update profile
- `POST /api/users/:userId/follow` - Follow/Unfollow user
- `GET /api/users/:userId/followers` - Get followers
- `GET /api/users/:userId/following` - Get following

### Posts
- `GET /api/feed` - Get feed
- `POST /api/posts` - Create post
- `GET /api/posts/:postId` - Get post
- `DELETE /api/posts/:postId` - Delete post
- `POST /api/posts/:postId/like` - Like post
- `GET /api/posts/:postId/comments` - Get comments
- `POST /api/posts/:postId/comments` - Add comment

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

### Other
- `GET /api/explore` - Explore content
- `GET /api/search` - Search users/posts
- `GET /api/analytics` - Get analytics

## Performance Optimizations

- ✅ Connection pooling for MongoDB
- ✅ Database indexes on frequently queried fields
- ✅ Optimized bcrypt rounds (8) for faster authentication
- ✅ Efficient query patterns

## Project Structure

```
api-server/
├── src/
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── lib/            # Utilities and helpers
│   ├── services/       # Business logic
│   └── index.ts        # Entry point
├── scripts/            # Utility scripts
├── .env               # Environment variables (not in git)
├── package.json       # Dependencies
└── tsconfig.json      # TypeScript config
```

## Deployment

### Deploy to Railway

1. Create account at [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add environment variables
4. Deploy!

### Deploy to Heroku

```bash
heroku create anufy-backend
heroku config:set MONGODB_URI=your_uri
heroku config:set JWT_SECRET=your_secret
git push heroku main
```

## Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- CORS enabled for mobile app
- Environment variables for sensitive data

## License

MIT

## Author

Harvinder Singh

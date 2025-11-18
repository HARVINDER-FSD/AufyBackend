# Deploy to Railway (Recommended for Express Apps)

Railway is much better for Node.js/Express apps than Vercel.

## Steps:

### 1. Go to Railway
https://railway.app

### 2. Sign in with GitHub

### 3. New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose `AufyBackend`

### 4. Add Environment Variables
Click on your service → Variables → Add all these:

```
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true
JWT_SECRET=4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=dcm470yhl
CLOUDINARY_API_KEY=832377464323471
CLOUDINARY_API_SECRET=RV8uRIhI2IL5eyl6InvU5s8OX2g
```

### 5. Configure Start Command
- Go to Settings → Deploy
- Start Command: `npm run dev`
- Or: `npx tsx src/index.ts`

### 6. Deploy
Railway will automatically deploy!

### 7. Get Your URL
After deployment, you'll get a URL like:
```
https://anufy-backend-production.up.railway.app
```

## Update Mobile App

Update `mobile-app/lib/api-config.ts`:
```typescript
const API_BASE_URL = 'https://anufy-backend-production.up.railway.app'
```

## Why Railway is Better:

✅ **No build configuration needed** - Just works with Express
✅ **Supports long-running processes** - Perfect for Node.js servers
✅ **Better for WebSockets** - If you add real-time features
✅ **Easier debugging** - Better logs and monitoring
✅ **Free tier** - $5 credit per month (enough for development)

## Test After Deployment

```bash
curl https://your-railway-url.railway.app/health
```

Should return:
```json
{"status":"ok","message":"Anufy API Server is running"}
```

---

## Alternative: Render.com

If Railway doesn't work, try Render:

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `npm run dev`
6. Add environment variables
7. Deploy!

---

## Summary

**Vercel** = Good for Next.js, serverless functions
**Railway** = Good for Express, Node.js servers ✅ (Recommended)
**Render** = Good alternative to Railway

Your Express app will work much better on Railway!

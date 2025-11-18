# Deploy to Render.com

Render is excellent for Node.js/Express apps and has a generous free tier.

## Quick Deploy Steps:

### 1. Go to Render
https://render.com

### 2. Sign Up/Login
- Sign in with GitHub (easiest)

### 3. Create New Web Service
- Click "New +" → "Web Service"
- Connect your GitHub account
- Select repository: `AufyBackend`

### 4. Configure Service

**Basic Settings:**
- Name: `anufy-backend`
- Region: Choose closest to you
- Branch: `main`
- Root Directory: (leave empty)
- Runtime: `Node`

**Build & Deploy:**
- Build Command: `npm install`
- Start Command: `npm run dev`

### 5. Add Environment Variables

Click "Advanced" → Add Environment Variables:

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

### 6. Deploy
- Click "Create Web Service"
- Wait 2-3 minutes for deployment

### 7. Get Your URL
After deployment, you'll get a URL like:
```
https://anufy-backend.onrender.com
```

---

## Update Mobile App

Once deployed, update `mobile-app/lib/api-config.ts`:
```typescript
const API_BASE_URL = 'https://anufy-backend.onrender.com'
```

Also update `mobile-app/app.json`:
```json
"extra": {
  "API_URL": "https://anufy-backend.onrender.com"
}
```

---

## Test Your Deployment

```bash
curl https://anufy-backend.onrender.com/health
```

Should return:
```json
{"status":"ok","message":"Anufy API Server is running"}
```

---

## Render Features

✅ **Free Tier**: 750 hours/month (enough for 1 service)
✅ **Auto-deploy**: Pushes to GitHub trigger deployments
✅ **SSL**: Free HTTPS certificates
✅ **Logs**: Easy to view and debug
✅ **No credit card**: Required for free tier
✅ **Always on**: Unlike Vercel, keeps your server running

---

## Important Notes

### Free Tier Limitations:
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 750 hours/month limit

### Upgrade to Paid ($7/month):
- No spin-down
- Faster performance
- More resources

---

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify `package.json` has all dependencies
- Make sure `npm install` works locally

### Service Won't Start
- Check logs for errors
- Verify environment variables are set
- Test start command locally: `npm run dev`

### Can't Connect
- Check if service is running (green status)
- Verify URL is correct
- Test health endpoint first

---

## Comparison

| Feature | Render | Railway | Vercel |
|---------|--------|---------|--------|
| Express Support | ✅ Excellent | ✅ Excellent | ⚠️ Limited |
| Free Tier | ✅ 750hrs | ✅ $5 credit | ✅ Serverless |
| Setup | Easy | Easiest | Complex |
| Always On | ❌ Spins down | ✅ Yes | N/A |
| Best For | Node.js apps | Node.js apps | Next.js |

---

## Recommended: Render or Railway

Both are great for your Express backend:

**Choose Render if:**
- You want simple setup
- Free tier is enough
- Don't mind 30s cold start

**Choose Railway if:**
- You want always-on service
- Need WebSockets
- Want better performance

---

## After Deployment

1. ✅ Deploy backend to Render
2. ✅ Get production URL
3. ✅ Update mobile app API URL
4. ✅ Rebuild mobile app APK
5. ✅ Test on phone

Your backend will be live at: `https://anufy-backend.onrender.com`

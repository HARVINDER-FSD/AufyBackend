# Deploy Backend to Vercel

## Quick Deploy (Recommended)

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with GitHub
3. **Import Project**: Click "Add New" → "Project"
4. **Select Repository**: Choose `AufyBackend`
5. **Configure**:
   - Framework Preset: Other
   - Root Directory: `./`
   - Build Command: `npm install`
   - Output Directory: (leave empty)
6. **Add Environment Variables** (click "Environment Variables"):

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

7. **Deploy**: Click "Deploy"

---

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd api-server
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? anufy-backend
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET

# Deploy to production
vercel --prod
```

---

## After Deployment

### 1. Get Your API URL
After deployment, Vercel will give you a URL like:
```
https://anufy-backend.vercel.app
```

### 2. Update Mobile App
Update `mobile-app/lib/api-config.ts`:
```typescript
const API_BASE_URL = 'https://anufy-backend.vercel.app'
```

### 3. Test Your API
```bash
curl https://anufy-backend.vercel.app/health
```

Should return:
```json
{"status":"ok","message":"Anufy API Server is running"}
```

---

## Environment Variables to Add on Vercel

Copy these exactly as they are:

| Variable | Value |
|----------|-------|
| `PORT` | `5001` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://harvindersinghharvinder9999_db_user:sardar123@cluster0.ssl5fvx.mongodb.net/socialmedia?retryWrites=true&w=majority&appName=Cluster0&tls=true&tlsAllowInvalidCertificates=true` |
| `JWT_SECRET` | `4d9f1c8c6b27a67e9f3a81d2e5b0f78c72d1e7a64d59c83fb20e5a72a8c4d192` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLOUDINARY_CLOUD_NAME` | `dcm470yhl` |
| `CLOUDINARY_API_KEY` | `832377464323471` |
| `CLOUDINARY_API_SECRET` | `RV8uRIhI2IL5eyl6InvU5s8OX2g` |

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Make sure all dependencies are in `package.json`
- Verify `vercel.json` is correct

### API Not Working
- Check function logs in Vercel dashboard
- Verify environment variables are set
- Test MongoDB connection

### CORS Issues
- Backend already has CORS enabled for all origins
- If needed, update in `src/index.ts`

---

## Vercel Configuration

Your `vercel.json` is already configured:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ]
}
```

---

## Alternative: Railway (Easier for Node.js)

If Vercel doesn't work well, try Railway:

1. Go to: https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub
4. Select `AufyBackend`
5. Add environment variables
6. Deploy!

Railway is better for long-running Node.js apps.

---

## Next Steps After Deployment

1. ✅ Deploy backend to Vercel
2. ✅ Get production URL
3. ✅ Update mobile app API URL
4. ✅ Rebuild mobile app APK
5. ✅ Test on phone

Your backend will be live at: `https://anufy-backend.vercel.app`

# 🚨 URGENT SECURITY ACTIONS REQUIRED

Your credentials were exposed. Follow these steps immediately:

## 1. Change MongoDB Password

1. Go to: https://cloud.mongodb.com
2. Login to your account
3. Go to Database Access
4. Find user: `harvindersinghharvinder9999_db_user`
5. Click "Edit" → "Edit Password"
6. Generate a new strong password
7. Update your local `.env` file with new password

## 2. Rotate Cloudinary Keys

1. Go to: https://cloudinary.com/console
2. Login to your account
3. Go to Settings → Security
4. Click "Regenerate API Secret"
5. Update your local `.env` file with new keys

## 3. Generate New JWT Secret

Run this command to generate a secure random key:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update your `.env` file with the new key.

## 4. Update Your .env File

Your `.env` file should look like this (with YOUR new credentials):

```env
PORT=5001
NODE_ENV=development

MONGODB_URI=mongodb+srv://username:NEW_PASSWORD@cluster0.xxxxx.mongodb.net/socialmedia?retryWrites=true&w=majority

JWT_SECRET=your_new_generated_secret_here

CLOUDINARY_CLOUD_NAME=dcm470yhl
CLOUDINARY_API_KEY=your_new_api_key
CLOUDINARY_API_SECRET=your_new_api_secret
```

## 5. Never Share These Again

❌ **NEVER** share:
- `.env` file contents
- MongoDB passwords
- API keys/secrets
- JWT secrets

✅ **ALWAYS** use:
- `.env.example` (with placeholder values)
- Environment variables in deployment platforms
- Secrets management tools

## 6. Check for Unauthorized Access

1. **MongoDB**: Check recent connections in Atlas
2. **Cloudinary**: Check usage/activity logs
3. **Monitor**: Watch for unusual activity

## 7. Deploy Safely

When deploying to Railway/Render/Heroku:
- Add environment variables in their dashboard
- Never commit `.env` to git
- Use their secrets management

---

## Prevention Checklist

✅ `.env` is in `.gitignore`
✅ Only `.env.example` is committed
✅ Credentials are rotated
✅ Monitoring is enabled
✅ Team knows security practices

---

**Remember**: Treat credentials like passwords - never share them publicly!

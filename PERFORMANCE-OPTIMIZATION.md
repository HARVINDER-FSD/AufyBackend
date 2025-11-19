# Performance Optimization Guide

## Current Performance Issues

### 1. Render Free Tier Cold Starts (30-60 seconds)
**Problem**: Server spins down after 15 minutes of inactivity
**Solutions**:
- Upgrade to Render paid plan ($7/month) - keeps server always running
- Use a different host (Railway, Fly.io, or DigitalOcean)
- Add a cron job to ping the server every 10 minutes (keeps it warm)

### 2. No Database Indexes (Slow queries)
**Problem**: MongoDB queries scan entire collections
**Solution**: Run the index creation script

```bash
npm run add-indexes
```

This adds indexes for:
- User lookups (username, email)
- Follower/following queries
- Post queries by user and date
- Like and comment lookups
- Notifications

**Expected improvement**: 10-100x faster queries

### 3. No Caching
**Problem**: Every request hits the database
**Solution**: Already configured Redis (Upstash) - just needs implementation

## Quick Wins (Do These Now)

### 1. Add Database Indexes
```bash
cd api-server
npm run add-indexes
```

### 2. Keep Server Warm (Free Solution)
Use a service like UptimeRobot or cron-job.org to ping your API every 10 minutes:
- URL to ping: `https://aufybackend.onrender.com/api/health`
- Interval: Every 10 minutes

### 3. Optimize Frontend Loading
The mobile app can show cached data immediately while fetching fresh data:
- Show skeleton loaders
- Cache previous data in AsyncStorage
- Use optimistic updates

## Long-term Solutions

### 1. Upgrade Hosting ($7-15/month)
**Render Starter**: $7/month - No cold starts
**Railway**: $5/month usage-based
**Fly.io**: ~$5-10/month
**DigitalOcean App Platform**: $5/month

### 2. Implement Redis Caching
Cache frequently accessed data:
- User profiles (5 min TTL)
- Follower/following lists (10 min TTL)
- Post feeds (2 min TTL)

### 3. Add CDN for Images
Use Cloudinary's CDN (already configured) with optimized image URLs

### 4. Database Connection Pooling
Already implemented with Mongoose

## Performance Monitoring

Add these endpoints to track performance:
- `/api/health` - Server health check
- `/api/metrics` - Response times and query counts

## Expected Results After Optimization

| Metric | Before | After Indexes | After Paid Hosting |
|--------|--------|---------------|-------------------|
| Cold start | 30-60s | 30-60s | 0s |
| Followers query | 2-5s | 50-200ms | 50-200ms |
| Feed load | 3-8s | 200-500ms | 200-500ms |
| Profile load | 2-4s | 100-300ms | 100-300ms |

## Cost Comparison

| Solution | Cost | Performance Gain |
|----------|------|------------------|
| Add indexes | Free | 10-100x faster queries |
| Keep warm (cron) | Free | Eliminates cold starts |
| Render Starter | $7/mo | Always fast |
| Railway | $5/mo | Always fast |
| Fly.io | $5-10/mo | Always fast |

## Recommendation

**Immediate (Free)**:
1. Run `npm run add-indexes`
2. Set up UptimeRobot to ping every 10 minutes

**Next Month ($7)**:
Upgrade to Render Starter plan for production-ready performance

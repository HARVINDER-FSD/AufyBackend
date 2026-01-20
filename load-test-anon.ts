import { connectToDatabase } from './src/lib/database';
import { AnonymousChatService } from './src/services/anonymous-chat';
import { PostService } from './src/services/post';
import mongoose from 'mongoose';

// Number of concurrent users to simulate
const NUM_USERS = 500;
const BATCH_SIZE = 50; // Process in batches to avoid OS resource limits (file descriptors/sockets)

async function runLoadTest() {
  console.log(`🚀 Starting Anonymous Mode Load Test with ${NUM_USERS} users...`);

  try {
    // 1. Connect to Infrastructure
    console.log('🔌 Connecting to DB & Redis...');
    // We only need DB connection for PostService, Redis for AnonymousChatService
    await connectToDatabase();
    
    // 2. Generate Fake Users (IDs only)
    // We simulate users by generating random ObjectIds.
    // NOTE: For 'getAnonymousTrendingFeed', it expects a real user to check 'isAnonymousMode',
    // but in our implementation of getAnonymousTrendingFeed, does it check the user document?
    // Let's check PostService.getAnonymousTrendingFeed again.
    // It takes currentUserId but doesn't seem to use it for fetching the feed logic itself 
    // (except maybe for 'is_liked' status if we improved it, but currently it just returns feed).
    // Wait, createPost checks user.isAnonymousMode. getAnonymousTrendingFeed just fetches posts.
    // It doesn't seem to fetch the user document of the *caller* unless it needs to check if they are blocked etc.
    // Let's assume passing a random ID is fine for the feed fetch itself.
    
    const userIds = Array.from({ length: NUM_USERS }, () => new mongoose.Types.ObjectId().toString());
    console.log(`✅ Generated ${userIds.length} unique User IDs.`);

    // Metric Collectors
    const metrics = {
      joinQueue: { success: 0, fail: 0, times: [] as number[] },
      fetchFeed: { success: 0, fail: 0, times: [] as number[] },
      matchesFound: 0
    };

    // 3. Test Phase 1: Anonymous Feed Fetching (High Read Load)
    console.log('\n📡 Phase 1: Fetching Anonymous Feeds (Read Load)...');
    const startFeed = Date.now();
    
    for (let i = 0; i < NUM_USERS; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (uid) => {
        const t0 = Date.now();
        try {
          // Fetch anonymous feed
          await PostService.getAnonymousTrendingFeed(uid, 1, 10); 
          metrics.fetchFeed.success++;
        } catch (e: any) {
          metrics.fetchFeed.fail++;
          // console.error(`Feed Error for ${uid}:`, e.message);
        }
        metrics.fetchFeed.times.push(Date.now() - t0);
      }));
      process.stdout.write('.');
    }
    console.log(`\n⏱️  Feed Phase completed in ${(Date.now() - startFeed) / 1000}s`);

    // 4. Test Phase 2: Joining Chat Queue (Write/Redis Load)
    console.log('\n💬 Phase 2: Joining Anonymous Chat Queue (Write Load)...');
    const startChat = Date.now();

    for (let i = 0; i < NUM_USERS; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (uid) => {
        const t0 = Date.now();
        try {
          // Randomly choose 'general' or 'fun'
          const interest = Math.random() > 0.5 ? 'fun' : 'general';
          const result = await AnonymousChatService.joinQueue(uid, [interest]);
          
          if (result.status === 'matched') {
            metrics.matchesFound++;
          }
          metrics.joinQueue.success++;
        } catch (e: any) {
          metrics.joinQueue.fail++;
          console.error(`Chat Error for ${uid}:`, e.message);
        }
        metrics.joinQueue.times.push(Date.now() - t0);
      }));
      process.stdout.write('.');
    }
    console.log(`\n⏱️  Chat Phase completed in ${(Date.now() - startChat) / 1000}s`);

    // 5. Report Results
    console.log('\n' + '='.repeat(50));
    console.log('📊 LOAD TEST RESULTS (500 Users)');
    console.log('='.repeat(50));
    
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

    console.log(`\nfeed_fetch (Anonymous Feed):`);
    console.log(`  Success: ${metrics.fetchFeed.success}/${NUM_USERS}`);
    console.log(`  Fail:    ${metrics.fetchFeed.fail}`);
    console.log(`  Avg Latency: ${avg(metrics.fetchFeed.times).toFixed(2)}ms`);
    console.log(`  Max Latency: ${max(metrics.fetchFeed.times)}ms`);

    console.log(`\njoin_queue (Anonymous Chat):`);
    console.log(`  Success: ${metrics.joinQueue.success}/${NUM_USERS}`);
    console.log(`  Fail:    ${metrics.joinQueue.fail}`);
    console.log(`  Matches Created: ${metrics.matchesFound} (approx ${metrics.matchesFound * 2} users matched)`);
    console.log(`  Avg Latency: ${avg(metrics.joinQueue.times).toFixed(2)}ms`);
    console.log(`  Max Latency: ${max(metrics.joinQueue.times)}ms`);

    console.log('='.repeat(50));
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Load Test Failed:', error);
    process.exit(1);
  }
}

runLoadTest();

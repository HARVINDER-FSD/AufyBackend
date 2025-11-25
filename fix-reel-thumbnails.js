// Script to add thumbnails to existing reels that don't have them
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

async function fixReelThumbnails() {
  console.log('🔧 Fixing reel thumbnails...');
  
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db();
  const reelsCollection = db.collection('reels');

  try {
    // Find all reels without proper thumbnails (null, missing, or pointing to video files)
    const reelsWithoutThumbnails = await reelsCollection.find({
      $or: [
        { thumbnail_url: null },
        { thumbnail_url: { $exists: false } },
        { thumbnail_url: /\.(mp4|mov|avi|webm)$/i } // Thumbnail pointing to video file
      ]
    }).toArray();

    console.log(`Found ${reelsWithoutThumbnails.length} reels without thumbnails`);

    if (reelsWithoutThumbnails.length === 0) {
      console.log('✅ All reels already have thumbnails!');
      await client.close();
      return;
    }

    // Update each reel to generate thumbnail from video URL
    let updated = 0;
    for (const reel of reelsWithoutThumbnails) {
      if (reel.video_url) {
        // Generate thumbnail URL from video URL
        // Cloudinary can generate thumbnails by replacing extension with .jpg
        const thumbnailUrl = reel.video_url.replace(/\.(mp4|mov|avi|webm)$/i, '.jpg');
        
        await reelsCollection.updateOne(
          { _id: reel._id },
          { 
            $set: { 
              thumbnail_url: thumbnailUrl,
              updated_at: new Date()
            } 
          }
        );
        
        updated++;
        console.log(`✅ Updated reel ${reel._id}: ${thumbnailUrl}`);
      } else {
        console.log(`⚠️  Reel ${reel._id} has no video_url, skipping`);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} reels with thumbnails!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixReelThumbnails();

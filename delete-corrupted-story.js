const mongoose = require('mongoose');
require('dotenv').config();

const storySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  media_url: { type: String, required: true },
  media_type: { type: String, enum: ['image', 'video'], required: true },
  caption: String,
  created_at: { 
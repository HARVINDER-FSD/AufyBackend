// src/worker-entry.ts
import dotenv from 'dotenv';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

import './workers/index';
import { logger } from './middleware/logger';

logger.info('🛠️ Worker process is now running...');

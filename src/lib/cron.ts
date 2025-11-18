import { queue } from './queue';

// Cron job scheduler
class CronScheduler {
  private static instance: CronScheduler;
  private jobs: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  private constructor() {}

  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  // Schedule a recurring job
  schedule(name: string, taskType: string, data: any, intervalMs: number) {
    if (this.jobs.has(name)) {
      this.unschedule(name);
    }

    const job = setInterval(async () => {
      try {
        await queue.enqueue(taskType, data, 1);
      } catch (error) {
        console.error(`Error in scheduled job ${name}:`, error);
      }
    }, intervalMs);

    this.jobs.set(name, job);
    console.log(`Scheduled job ${name} to run every ${intervalMs}ms`);
  }

  // Schedule a one-time job
  scheduleOnce(name: string, taskType: string, data: any, delayMs: number) {
    const job = setTimeout(async () => {
      try {
        await queue.enqueue(taskType, data, 1);
        this.jobs.delete(name);
      } catch (error) {
        console.error(`Error in one-time job ${name}:`, error);
      }
    }, delayMs);

    this.jobs.set(name, job);
    console.log(`Scheduled one-time job ${name} to run in ${delayMs}ms`);
  }

  // Unschedule a job
  unschedule(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      clearInterval(job);
      clearTimeout(job);
      this.jobs.delete(name);
      console.log(`Unscheduled job ${name}`);
    }
  }

  // Start all default scheduled jobs
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting cron scheduler...');

    // Clean up expired stories every hour
    this.schedule(
      'cleanup_expired_stories',
      'cleanup_expired_data',
      { type: 'stories', olderThan: new Date() },
      60 * 60 * 1000 // 1 hour
    );

    // Clean up expired sessions every 30 minutes
    this.schedule(
      'cleanup_expired_sessions',
      'cleanup_expired_data',
      { type: 'sessions', olderThan: new Date() },
      30 * 60 * 1000 // 30 minutes
    );

    // Clean up temporary files every 2 hours
    this.schedule(
      'cleanup_temp_files',
      'cleanup_expired_data',
      { type: 'temp_files', olderThan: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      2 * 60 * 60 * 1000 // 2 hours
    );

    // Generate daily analytics reports at midnight
    this.schedule(
      'daily_analytics',
      'generate_analytics_report',
      { period: 'daily' },
      24 * 60 * 60 * 1000 // 24 hours
    );

    // Weekly user data backup on Sundays at 2 AM
    this.schedule(
      'weekly_backup',
      'backup_user_data',
      { backupType: 'weekly' },
      7 * 24 * 60 * 60 * 1000 // 7 days
    );

    console.log('Cron scheduler started with default jobs');
  }

  // Stop all scheduled jobs
  stop() {
    this.isRunning = false;
    for (const [name, job] of this.jobs) {
      clearInterval(job);
      clearTimeout(job);
      console.log(`Stopped job ${name}`);
    }
    this.jobs.clear();
    console.log('Cron scheduler stopped');
  }

  // Get status of all jobs
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }
}

// Initialize and start the cron scheduler
const cronScheduler = CronScheduler.getInstance();

// Start the scheduler when the module is imported
if (process.env.NODE_ENV === 'production') {
  cronScheduler.start();
}

export { cronScheduler };
export default cronScheduler;

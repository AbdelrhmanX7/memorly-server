import { cleanupExpiredUploads } from "../utils/chunk-upload.service";

/**
 * Run cleanup of expired chunked uploads
 * This should be called periodically (e.g., via cron job or interval)
 */
export const runCleanup = async (): Promise<void> => {
  try {
    console.log("Starting cleanup of expired uploads...");
    const cleanedCount = await cleanupExpiredUploads();

    if (cleanedCount > 0) {
      console.log(`✅ Cleanup completed: ${cleanedCount} expired uploads removed`);
    } else {
      console.log("✅ Cleanup completed: No expired uploads found");
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
};

/**
 * Start periodic cleanup
 * Runs every 6 hours by default
 */
export const startPeriodicCleanup = (intervalHours: number = 6): NodeJS.Timeout => {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`🧹 Starting periodic cleanup (every ${intervalHours} hours)`);

  // Run immediately on startup
  runCleanup();

  // Then run periodically
  return setInterval(runCleanup, intervalMs);
};

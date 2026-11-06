import cron from "node-cron";
import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { shiprocketTrackingQueue } from "../queues/shiprocketTracking.queue.js";
import { shiprocketConfig, isShiprocketConfigured } from "../config/shiprocket.js";
import { runShiprocketTrackingSync } from "../modules/shiprocket/shiprocketSync.service.js";
import logger from "../utils/logger.js";

(async () => {
  if (await isShiprocketConfigured()) {
    cron.schedule(
      shiprocketConfig.trackingSyncCron,
      () => {
        shiprocketTrackingQueue.add("sync-tracking", {}).catch((err) => {
          logger.error(`[shiprocket-tracking-sync] failed to enqueue job: ${err.message}`);
        });
      },
      { timezone: "Asia/Kolkata" },
    );

    logger.info(`[shiprocket-tracking-sync] cron scheduled: ${shiprocketConfig.trackingSyncCron}`);
  } else {
    logger.info("[shiprocket-tracking-sync] disabled (no Shiprocket email/password configured)");
  }
})();

new Worker(
  "shiprocket-tracking",
  async (job) => {
    if (job.name === "sync-tracking") {
      return runShiprocketTrackingSync();
    }
  },
  { connection: redisConnection },
);

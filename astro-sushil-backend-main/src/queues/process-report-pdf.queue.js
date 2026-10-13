import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const processReportPDFQueue = new Queue("process-report-pdf", {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 10,

    backoff: {
      type: "exponential",
      delay: 5000, // 5s → 10s → 20s … capped at ~5 min per retry
    },

    removeOnComplete: {
      count: 100,
    },

    removeOnFail: {
      count: 200,
    },
  },
});

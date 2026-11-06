import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const shiprocketTrackingQueue = new Queue("shiprocket-tracking", {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 2,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: {
      count: 20,
    },

    removeOnFail: {
      count: 50,
    },
  },
});

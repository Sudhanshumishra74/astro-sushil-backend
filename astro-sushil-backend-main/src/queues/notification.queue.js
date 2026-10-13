import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 3000,
    },

    removeOnComplete: {
      count: 100,
    },

    removeOnFail: {
      count: 200,
    },
  },
});

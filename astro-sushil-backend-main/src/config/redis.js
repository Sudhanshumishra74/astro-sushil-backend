
export const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || "default",
  password: process.env.REDIS_PASSWORD || undefined,
  ...(process.env.REDIS_HOST?.includes("upstash.io")
    ? { tls: {} }
    : {}),
};

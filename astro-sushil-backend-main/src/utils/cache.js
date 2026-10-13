import Redis from "ioredis";
import { redisConnection } from "../config/redis.js";

// Lazy singleton — created on first use, shared across all imports.
let _client = null;

function getClient() {
  if (!_client) {
    _client = new Redis(redisConnection);
    _client.on("error", (err) =>
      console.error("[Redis cache]", err.message),
    );
  }
  return _client;
}

// 24-hour TTL as a safety net; mutations always invalidate explicitly.
const DEFAULT_TTL = 86400;

/**
 * Returns the parsed cached value for `key`, or null on miss / Redis error.
 * Errors are swallowed so a Redis outage never breaks a request.
 */
export async function getCache(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Serialises `data` and stores it under `key` with an optional TTL (seconds).
 * Errors are swallowed — a failed cache write is non-critical.
 */
export async function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    await getClient().set(key, JSON.stringify(data), "EX", ttl);
  } catch {
    // non-critical
  }
}

/**
 * Deletes one or more cache keys in a single Redis round-trip.
 * Pass keys as individual arguments: delCache(key1, key2, …)
 */
export async function delCache(...keys) {
  try {
    if (keys.length) await getClient().del(...keys);
  } catch {
    // non-critical
  }
}

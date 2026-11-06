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

// In-process fallback used only while Redis itself is unreachable. Without
// this, a Redis outage used to silently disable both getCache/setCache
// (every call became a permanent cache miss — getCache swallowed the error
// and returned null even for keys that genuinely had a value moments ago)
// and checkRateLimit (failed open/unlimited) at once. Mirroring every
// successful Redis write into this Map — and reading from it only when
// Redis itself errors — keeps both behaviors intact per-process until Redis
// recovers. Capped and FIFO-trimmed since keys can accumulate over a
// long-lived process and there's no TTL sweep on a plain Map.
const MAX_MEM_CACHE_ENTRIES = 2000;
const memCache = new Map(); // key -> { value, expiresAt }
const memRateLimits = new Map(); // key -> { count, resetAt }

function memCacheGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

function memCacheSet(key, value, ttlSeconds) {
  if (memCache.size >= MAX_MEM_CACHE_ENTRIES && !memCache.has(key)) {
    const oldestKey = memCache.keys().next().value;
    memCache.delete(oldestKey);
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memCheckRateLimit(key, max, windowMs) {
  const now = Date.now();
  let entry = memRateLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memRateLimits.set(key, entry);
  }

  entry.count += 1;
  return entry.count <= max;
}

/**
 * Returns the parsed cached value for `key`, or null on genuine miss.
 * Falls back to the in-process mirror if Redis itself is unreachable.
 */
export async function getCache(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return memCacheGet(key);
  }
}

/**
 * Serialises `data` and stores it under `key` with an optional TTL (seconds).
 * Always mirrored in-process first so the fallback stays warm even if the
 * Redis write itself fails.
 */
export async function setCache(key, data, ttl = DEFAULT_TTL) {
  memCacheSet(key, data, ttl);

  try {
    await getClient().set(key, JSON.stringify(data), "EX", ttl);
  } catch {
    // non-critical — already mirrored in-process above
  }
}

/**
 * Deletes one or more cache keys in a single Redis round-trip.
 * Pass keys as individual arguments: delCache(key1, key2, …)
 */
export async function delCache(...keys) {
  keys.forEach((key) => memCache.delete(key));

  try {
    if (keys.length) await getClient().del(...keys);
  } catch {
    // non-critical
  }
}

/**
 * Fixed-window rate limiter shared across app instances via Redis.
 * Returns true if the call under `key` is allowed (increments the counter),
 * false if `max` has already been hit within the current `windowMs` window.
 * Falls back to an in-process (per-instance, not cluster-wide) fixed-window
 * counter on Redis errors, rather than failing fully open — an outage no
 * longer means unlimited outbound traffic against whatever API this guards.
 */
export async function checkRateLimit(key, max, windowMs) {
  try {
    const client = getClient();
    const count = await client.incr(key);

    if (count === 1) {
      await client.pexpire(key, windowMs);
    }

    return count <= max;
  } catch {
    return memCheckRateLimit(key, max, windowMs);
  }
}

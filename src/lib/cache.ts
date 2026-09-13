import "server-only";

import { createClient } from "redis";

import { getCached, type CacheStore } from "@/lib/cache-helpers";

type RedisLike = ReturnType<typeof createClient> | null;

const globalForCache = globalThis as unknown as { redisClient?: RedisLike };
let redis = globalForCache.redisClient ?? null;

/**
 * Lazy, resilient Redis client. Returns `null` when Redis is not configured
 * or unreachable so every consumer can degrade gracefully. On failure the
 * singleton is discarded so the next call retries a fresh connection.
 */
export async function getRedisClient(): Promise<RedisLike> {
  if (redis) {
    return redis;
  }
  if (!process.env.REDIS_URL) {
    return null;
  }

  redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: false, // no reconnect: on error we discard + reopen fresh
      keepAlive: true,
    },
    disableOfflineQueue: true,
  });

  // Swallow library-level errors: with disableOfflineQueue commands fail fast
  // while disconnected and callers fall back. Without a listener node-redis
  // would crash.
  redis.on("error", () => {
    redis = null;
    globalForCache.redisClient = null;
  });

  globalForCache.redisClient = redis;
  try {
    await redis.connect();
    await redis.ping();
  } catch {
    const failed = redis;
    redis = null;
    globalForCache.redisClient = null;
    try {
      await failed.destroy();
    } catch {
      // ignore
    }
  }
  return redis;
}

function toStore(client: NonNullable<RedisLike>): CacheStore {
  return {
    get: (key) => client.get(key),
    set: (key, value, ttlSeconds) => client.set(key, value, { EX: ttlSeconds }).then(() => undefined),
    delete: (...keys) => client.del(keys).then(() => undefined),
  };
}

/** Read-through cache: Redis when available, transparent source fallback. */
export async function withRedisCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const client = await getRedisClient();
  return getCached(client ? toStore(client) : null, key, ttlSeconds, loader);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const raw = await client.get(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // cache disponível é um extra; falhas não devem derrubar o pedido
  }
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.del(keys);
  } catch {
    // ignore
  }
}
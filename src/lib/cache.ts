import "server-only";

import { createClient } from "redis";

type RedisLike = ReturnType<typeof createClient> | null;

const globalForCache = globalThis as unknown as { redisClient?: RedisLike };
let redis = globalForCache.redisClient ?? null;

export async function getRedisClient(): Promise<RedisLike> {
  return getClient();
}

async function getClient(): Promise<RedisLike> {
  if (redis) {
    return redis;
  }
  if (!process.env.REDIS_URL) {
    return null;
  }
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on("error", () => {
    redis = null;
  });
  globalForCache.redisClient = redis;
  try {
    await redis.connect();
  } catch {
    redis = null;
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (!client) {
    return null;
  }
  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  const client = await getClient();
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
  const client = await getClient();
  if (!client) {
    return;
  }
  try {
    await client.del(keys);
  } catch {
    // ignore
  }
}
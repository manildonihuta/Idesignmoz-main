import "server-only";
import type { NextRequest } from "next/server";
import { getRedisClient } from "@/lib/cache";

type MemoryBucket = { count: number; resetAt: number };

const memory = new Map<string, MemoryBucket>();

function cleanupMemory(now: number) {
  if (memory.size < 1000) return;
  for (const [key, bucket] of memory) {
    if (bucket.resetAt <= now) memory.delete(key);
  }
}

function memoryHit(key: string, limit: number, windowSec: number) {
  const now = Date.now();
  cleanupMemory(now);
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true as const };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false as const,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true as const };
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const fullKey = `rl:${key}`;

  const client = await getRedisClient();
  if (client) {
    try {
      const count = await client.incr(fullKey);
      if (count === 1) {
        await client.expire(fullKey, windowSec);
      }
      if (count > limit) {
        const ttl = await client.ttl(fullKey);
        return { ok: false, retryAfterSec: Math.max(1, ttl < 0 ? windowSec : ttl) };
      }
      return { ok: true };
    } catch {
      // fall through to the in-memory limiter
    }
  }

  return memoryHit(fullKey, limit, windowSec);
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    { ok: false, error: "Demasiados pedidos. Tenta novamente mais tarde." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function applyRateLimit(
  request: NextRequest,
  opts: { prefix: string; limit: number; windowSec: number; ip?: string },
): Promise<RateLimitResult> {
  const ip = opts.ip ?? clientIp(request);
  return rateLimit({ key: `${opts.prefix}:${ip}`, limit: opts.limit, windowSec: opts.windowSec });
}
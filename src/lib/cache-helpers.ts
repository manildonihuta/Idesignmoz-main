/**
 * Pure cache helpers (framework/client agnostic) so the cache behaviour can
 * be unit-tested without a live Redis. The real Redis client in `@/lib/cache`
 * adapts to the minimal `CacheStore` shape below.
 */

export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
};

/**
 * Read-through cache.
 *
 *  - cache hit  -> parse JSON and return
 *  - cache miss -> run `loader`, store the result for `ttlSeconds`, return it
 *  - any cache failure (get, parse, set) -> transparently fall back to `loader`
 */
export async function getCached<T>(
  store: CacheStore | null,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (store) {
    try {
      const raw = await store.get(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
      const value = await loader();
      try {
        await store.set(key, JSON.stringify(value), ttlSeconds);
      } catch {
        // storing is best-effort; a failed write must not fail the request
      }
      return value;
    } catch {
      // cache unavailable / unreadable: serve from source
    }
  }
  return loader();
}
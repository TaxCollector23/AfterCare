/**
 * Redis caching for pipeline stages, keyed by file_hash.
 *
 * - Extraction results: TTL 7d (a given uploaded document rarely changes).
 * - Explanations: TTL 30d (medical term definitions are stable).
 *
 * If REDIS_URL isn't set (e.g. local dev without Redis running), every call
 * degrades to a no-op cache miss rather than throwing — caching is a
 * performance optimization, not a pipeline dependency.
 */
import { createClient, type RedisClientType } from "redis";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

async function getClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client) return client;
  if (!connecting) {
    connecting = (async () => {
      try {
        const c: RedisClientType = createClient({ url });
        c.on("error", () => undefined);
        await c.connect();
        client = c;
        return c;
      } catch {
        return null;
      }
    })();
  }
  return connecting;
}

async function getJson<T>(key: string): Promise<T | null> {
  const c = await getClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const c = await getClient();
  if (!c) return;
  try {
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    return;
  }
}

/**
 * Wraps a stage function with cache-aside behavior: on hit, returns the
 * cached value without calling `compute`; on miss, computes and returns.
 * The computed value is only cached when `shouldCache` says it's worth
 * keeping — a failed StageResult (transient LLM/network error) must NOT be
 * cached, or a single bad request poisons every retry for the full TTL.
 * Cache errors never surface to the caller — they degrade to a cache miss.
 */
async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  shouldCache: (value: T) => boolean,
): Promise<T> {
  const cached = await getJson<T>(key);
  if (cached !== null) return cached;
  const value = await compute();
  if (shouldCache(value)) {
    await setJson(key, value, ttlSeconds);
  }
  return value;
}

export function extractionCacheKey(fileHash: string): string {
  return `extraction:${fileHash}`;
}

export function explanationCacheKey(fileHash: string): string {
  return `explanations:${fileHash}`;
}

/** Only cache a StageResult when it actually succeeded. */
function isSuccessfulStageResult(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === true
  );
}

/** Cache-aside wrapper for the extraction stage, keyed by file_hash. TTL 7d. Never caches a failed result. */
export function cacheExtraction<T>(
  fileHash: string,
  compute: () => Promise<T>,
): Promise<T> {
  return cacheAside(
    extractionCacheKey(fileHash),
    SEVEN_DAYS_SECONDS,
    compute,
    isSuccessfulStageResult,
  );
}

/** Cache-aside wrapper for the explanation-generation stage, keyed by file_hash. TTL 30d. Never caches a failed result. */
export function cacheExplanations<T>(
  fileHash: string,
  compute: () => Promise<T>,
): Promise<T> {
  return cacheAside(
    explanationCacheKey(fileHash),
    THIRTY_DAYS_SECONDS,
    compute,
    isSuccessfulStageResult,
  );
}

/** Closes the Redis connection. Call on graceful shutdown; safe to call even if never connected. */
export async function closeCache(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    connecting = null;
  }
}

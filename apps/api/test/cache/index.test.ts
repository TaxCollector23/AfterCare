import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fake standing in for a real Redis server, so we can exercise
// the actual get/set-around-TTL code path (not just the REDIS_URL-unset
// no-op path already covered by pipeline/index.test.ts).
const store = new Map<string, string>();
vi.mock('redis', () => ({
  createClient: () => ({
    on: () => {},
    connect: async () => {},
    quit: async () => {},
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
  }),
}));

import { cacheExtraction, cacheExplanations, closeCache } from '../../src/cache/index.js';

beforeEach(async () => {
  store.clear();
  process.env.REDIS_URL = 'redis://fake-for-tests';
  await closeCache(); // drop the cached client singleton between tests
});

describe('cacheExtraction / cacheExplanations', () => {
  it('caches a successful StageResult and skips recomputation on the next call', async () => {
    const compute = vi.fn(async () => ({ success: true, data: 'ok', confidence: 90, sourceLines: [] }));

    const first = await cacheExtraction('hash-a', compute);
    const second = await cacheExtraction('hash-a', compute);

    expect(first).toEqual(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache a failed StageResult — a transient error must not poison the TTL', async () => {
    const compute = vi.fn(async () => ({ success: false, data: null, confidence: 0, error: 'boom', sourceLines: [] }));

    await cacheExtraction('hash-b', compute);
    await cacheExtraction('hash-b', compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('same failure-is-not-cached behavior applies to explanations', async () => {
    const compute = vi.fn(async () => ({ success: false, data: null, confidence: 0, error: 'boom', sourceLines: [] }));

    await cacheExplanations('hash-c', compute);
    await cacheExplanations('hash-c', compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });
});

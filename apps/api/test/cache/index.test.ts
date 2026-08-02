import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake standing in for a real Redis server, so we can exercise
// the actual get/set-around-TTL code path (not just the REDIS_URL-unset
// no-op path already covered by pipeline/index.test.ts).
const store = new Map<string, string>();
vi.mock("redis", () => ({
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

import {
  cacheExtraction,
  cacheExplanations,
  cacheOcr,
  closeCache,
  ocrCacheSize,
  resetOcrCache,
} from "../../src/cache/index.js";

beforeEach(async () => {
  store.clear();
  resetOcrCache();
  process.env.REDIS_URL = "redis://fake-for-tests";
  await closeCache(); // drop the cached client singleton between tests
});

describe("cacheExtraction / cacheExplanations", () => {
  it("caches a successful StageResult and skips recomputation on the next call", async () => {
    const compute = vi.fn(async () => ({
      success: true,
      data: "ok",
      confidence: 90,
      sourceLines: [],
    }));

    const first = await cacheExtraction("hash-a", compute);
    const second = await cacheExtraction("hash-a", compute);

    expect(first).toEqual(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache a failed StageResult ? a transient error must not poison the TTL", async () => {
    const compute = vi.fn(async () => ({
      success: false,
      data: null,
      confidence: 0,
      error: "boom",
      sourceLines: [],
    }));

    await cacheExtraction("hash-b", compute);
    await cacheExtraction("hash-b", compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("same failure-is-not-cached behavior applies to explanations", async () => {
    const compute = vi.fn(async () => ({
      success: false,
      data: null,
      confidence: 0,
      error: "boom",
      sourceLines: [],
    }));

    await cacheExplanations("hash-c", compute);
    await cacheExplanations("hash-c", compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe("cacheOcr", () => {
  it("returns a cached successful result without re-running compute", async () => {
    const compute = vi.fn(async () => ({
      success: true,
      data: "ocr text",
      confidence: 99,
      sourceLines: [1],
    }));

    const first = await cacheOcr("ocr:hash-a", compute, (r) => r.success);
    const second = await cacheOcr("ocr:hash-a", compute, (r) => r.success);

    expect(first).toEqual(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache a failed OCR result so transient failures still retry", async () => {
    const compute = vi.fn(async () => ({
      success: false,
      data: null,
      confidence: 0,
      error: "vision provider down",
      sourceLines: [],
    }));

    await cacheOcr("ocr:hash-b", compute, (r) => r.success);
    await cacheOcr("ocr:hash-b", compute, (r) => r.success);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("does not share entries across different keys", async () => {
    const compute = vi.fn(async () => ({ success: true }));
    await cacheOcr("ocr:one", compute, () => true);
    await cacheOcr("ocr:two", compute, () => true);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("stays bounded under heavy distinct-document load", async () => {
    const compute = vi.fn(async () => ({ success: true }));
    for (let i = 0; i < 600; i++) {
      await cacheOcr(`ocr:bulk-${i}`, compute, () => true);
    }
    expect(ocrCacheSize()).toBe(500);
  });
});

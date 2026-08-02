import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/errors.js";
import { deriveStorageEncryptionKey } from "../../src/integrations/storage.js";

describe("deriveStorageEncryptionKey", () => {
  it("accepts a 32-byte base64 key", () => {
    const key = randomBytes(32);
    expect(deriveStorageEncryptionKey(key.toString("base64"))).toEqual(key);
  });

  it("accepts a 32-byte base64url key", () => {
    const key = randomBytes(32);
    expect(deriveStorageEncryptionKey(key.toString("base64url"))).toEqual(key);
  });

  it("accepts a 64-character hex key", () => {
    const key = randomBytes(32);
    expect(deriveStorageEncryptionKey(key.toString("hex"))).toEqual(key);
  });

  it("derives a stable key from a long raw secret", () => {
    const secret = "render-secret-generated-as-plain-text-64-chars-minimum";
    expect(deriveStorageEncryptionKey(secret)).toEqual(
      createHash("sha256").update(secret).digest(),
    );
  });

  it("rejects short placeholder secrets", () => {
    expect(() =>
      deriveStorageEncryptionKey("base64-encoded-32-byte-key"),
    ).toThrow(AppError);
  });

  it("keeps production memory storage usable when a placeholder key is set", async () => {
    const previousEnv = { ...process.env };
    const bytes = Buffer.from("fake pdf bytes");
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_ACCESS_SECRET = "x".repeat(32);
      process.env.JWT_REFRESH_SECRET = "y".repeat(32);
      process.env.STORAGE_ENCRYPTION_KEY = "base64-encoded-32-byte-key";
      delete process.env.S3_BUCKET;

      vi.resetModules();
      const storage = await import("../../src/integrations/storage.js");
      const storageKey = await storage.storeDocument("user-1", "doc-1", bytes);

      await expect(storage.loadDocument(storageKey)).resolves.toEqual(bytes);
      expect(storage.storageStatus().encryption.ready).toBe(true);
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previousEnv);
      vi.resetModules();
    }
  });
});

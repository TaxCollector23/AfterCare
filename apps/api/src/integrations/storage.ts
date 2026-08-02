import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { config } from "../config.js";
import { AppError } from "../errors.js";

const s3 = config.S3_BUCKET
  ? new S3Client({ region: config.AWS_REGION })
  : null;
const memoryObjects = new Map<string, Buffer>();

function tryDecodeKey(
  value: string,
  encoding: "base64" | "base64url",
): Buffer | null {
  const pattern =
    encoding === "base64" ? /^[A-Za-z0-9+/]+={0,2}$/ : /^[A-Za-z0-9_-]+={0,2}$/;
  if (!pattern.test(value) || value.length % 4 === 1) return null;
  const decoded = Buffer.from(value, encoding);
  return decoded.length === 32 ? decoded : null;
}

export function deriveStorageEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  const decoded =
    tryDecodeKey(trimmed, "base64") ?? tryDecodeKey(trimmed, "base64url");
  if (decoded) return decoded;

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (Buffer.byteLength(trimmed, "utf8") >= 32) {
    return createHash("sha256").update(trimmed).digest();
  }

  throw new AppError(
    500,
    "STORAGE_ENCRYPTION_KEY must be a 32-byte base64/base64url key, a 64-character hex key, or a 32+ byte raw secret",
    "BAD_CONFIG",
  );
}

function hasConfiguredStorageKey() {
  return Boolean(config.STORAGE_ENCRYPTION_KEY?.trim());
}

function runtimeStorageKey() {
  return createHash("sha256")
    .update(config.JWT_ACCESS_SECRET)
    .update(":storage")
    .digest();
}

function encryptionKey() {
  if (hasConfiguredStorageKey()) {
    try {
      return deriveStorageEncryptionKey(config.STORAGE_ENCRYPTION_KEY!);
    } catch (error) {
      if (s3 && config.S3_BUCKET) throw error;
      return runtimeStorageKey();
    }
  }
  if (config.NODE_ENV === "production" && s3 && config.S3_BUCKET) {
    throw new AppError(
      500,
      "Storage encryption is not configured",
      "BAD_CONFIG",
    );
  }
  return runtimeStorageKey();
}

function encrypt(bytes: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(payload: Buffer) {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function streamToBuffer(body: AsyncIterable<Uint8Array>) {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function hashFile(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function storeDocument(
  userId: string,
  documentId: string,
  bytes: Buffer,
) {
  const storageKey = `users/${userId}/documents/${documentId}.enc`;
  const encrypted = encrypt(bytes);
  if (s3 && config.S3_BUCKET) {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: storageKey,
        Body: encrypted,
        ACL: "private",
        ServerSideEncryption: "AES256",
        ContentType: "application/octet-stream",
        Metadata: { owner: userId, encryption: "aes-256-gcm" },
      }),
    );
  } else {
    memoryObjects.set(storageKey, encrypted);
  }
  return storageKey;
}

export async function loadDocument(storageKey: string) {
  if (s3 && config.S3_BUCKET) {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: storageKey }),
    );
    if (!result.Body)
      throw new AppError(404, "Stored document not found", "NOT_FOUND");
    return decrypt(
      await streamToBuffer(result.Body as AsyncIterable<Uint8Array>),
    );
  }
  const object = memoryObjects.get(storageKey);
  if (!object)
    throw new AppError(404, "Stored document not found", "NOT_FOUND");
  return decrypt(object);
}

export async function deleteStoredDocument(storageKey: string) {
  if (s3 && config.S3_BUCKET) {
    await s3.send(
      new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: storageKey }),
    );
  } else {
    memoryObjects.delete(storageKey);
  }
}

export function storageStatus() {
  let encryptionReady = false;
  try {
    encryptionKey();
    encryptionReady = true;
  } catch {
    encryptionReady = false;
  }

  return {
    configured: Boolean(s3 && config.S3_BUCKET),
    mode: s3 ? "s3" : "memory",
    encryption: {
      configured: hasConfiguredStorageKey() || config.NODE_ENV !== "production",
      ready: encryptionReady,
    },
  } as const;
}

export function resetStorage() {
  memoryObjects.clear();
}

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

const KEY_HELP =
  'generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"';

/**
 * Decodes a configured key to exactly 32 bytes, accepting any of the encodings
 * a 32-byte key is usually pasted in. Returns null when the value can't be one.
 *
 * base64 decoding never throws — it skips characters outside the alphabet — so
 * a wrong-length result is the only signal that the value isn't a real key.
 */
function decodeKey(value: string): Buffer | null {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;
  const base64url = Buffer.from(trimmed, "base64url");
  if (base64url.length === 32) return base64url;
  return null;
}

/** Whether the process is configured well enough to store an upload. */
export function encryptionStatus() {
  if (!config.STORAGE_ENCRYPTION_KEY) {
    return config.NODE_ENV === "production"
      ? { configured: false as const, problem: "STORAGE_ENCRYPTION_KEY is not set" }
      : { configured: true as const, problem: null };
  }
  return decodeKey(config.STORAGE_ENCRYPTION_KEY)
    ? { configured: true as const, problem: null }
    : {
        configured: false as const,
        problem: "STORAGE_ENCRYPTION_KEY must decode to 32 bytes",
      };
}

function encryptionKey() {
  if (config.STORAGE_ENCRYPTION_KEY) {
    const decoded = decodeKey(config.STORAGE_ENCRYPTION_KEY);
    if (!decoded) {
      throw new AppError(
        500,
        `STORAGE_ENCRYPTION_KEY must decode to 32 bytes — ${KEY_HELP}`,
        "BAD_CONFIG",
      );
    }
    return decoded;
  }
  if (config.NODE_ENV === "production") {
    throw new AppError(
      500,
      `Storage encryption is not configured — set STORAGE_ENCRYPTION_KEY. ${KEY_HELP}`,
      "BAD_CONFIG",
    );
  }
  return createHash("sha256").update(config.JWT_ACCESS_SECRET).digest();
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
  const encryption = encryptionStatus();
  return {
    configured: Boolean(s3 && config.S3_BUCKET),
    mode: s3 ? "s3" : "memory",
    // Surfaced here so a bad key is visible from /health. Without it the only
    // symptom is every upload returning a 500 that nothing else explains.
    encryption: encryption.configured ? "ok" : "misconfigured",
    encryptionProblem: encryption.problem,
  } as const;
}

export function resetStorage() {
  memoryObjects.clear();
}

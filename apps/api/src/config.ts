import { randomBytes } from "node:crypto";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(500),
  UPLOAD_RATE_LIMIT: z.coerce.number().int().positive().default(100),
  // /ask is the most expensive endpoint (real LLM calls), so it gets its own
  // tighter per-user budget on top of the general API limit.
  ASK_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  WEB_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  STORAGE_ENCRYPTION_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-west-2"),
  S3_BUCKET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  GEMINI_API_KEY_PRIMARY: z.string().optional(),
  GEMINI_API_KEY_FALLBACK: z.string().optional(),
  // Validated for ops; the live value is read at call time by
  // integrations/openai.ts (which supports tests overriding it per-call).
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_STATE_SECRET: z.string().min(32).optional(),
  MOCK_INTEGRATIONS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const parsed = schema.parse(process.env);
if (
  parsed.NODE_ENV === "production" &&
  (!parsed.JWT_ACCESS_SECRET || !parsed.JWT_REFRESH_SECRET)
) {
  throw new Error(
    "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production",
  );
}
if (
  parsed.NODE_ENV === "production" &&
  (parsed.GOOGLE_CLIENT_ID ||
    parsed.GOOGLE_CLIENT_SECRET ||
    parsed.GOOGLE_REDIRECT_URI) &&
  !parsed.GOOGLE_STATE_SECRET
) {
  throw new Error(
    "GOOGLE_STATE_SECRET is required in production when Google Drive is configured",
  );
}

const ephemeralSecret = () => randomBytes(32).toString("base64url");
export const config = {
  ...parsed,
  JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET ?? ephemeralSecret(),
  JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET ?? ephemeralSecret(),
  GOOGLE_STATE_SECRET: parsed.GOOGLE_STATE_SECRET ?? ephemeralSecret(),
};

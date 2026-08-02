import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).default("development-access-secret-change-me-123456"),
  JWT_REFRESH_SECRET: z.string().min(32).default("development-refresh-secret-change-me-12345"),
  STORAGE_ENCRYPTION_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-west-2"),
  S3_BUCKET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:3001/drive/callback"),
  GOOGLE_STATE_SECRET: z.string().min(32).default("development-google-state-secret-change-me"),
  MOCK_INTEGRATIONS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
});

export const config = schema.parse(process.env);

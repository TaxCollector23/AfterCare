import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const key = (req: Request) => req.userId ?? ipKeyGenerator(req.ip ?? "127.0.0.1");

export const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 500,
  keyGenerator: key,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "API rate limit exceeded. Try again later.", code: "RATE_LIMITED" }
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  keyGenerator: key,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Upload rate limit exceeded. Try again later.", code: "UPLOAD_RATE_LIMITED" }
});

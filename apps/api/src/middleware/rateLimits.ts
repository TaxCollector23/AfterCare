import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const key = (req: Request) =>
  req.userId ?? ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");

export const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.API_RATE_LIMIT,
  keyGenerator: key,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "API rate limit exceeded. Try again later.",
    code: "RATE_LIMITED",
  },
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.UPLOAD_RATE_LIMIT,
  keyGenerator: key,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Upload rate limit exceeded. Try again later.",
    code: "UPLOAD_RATE_LIMITED",
  },
});

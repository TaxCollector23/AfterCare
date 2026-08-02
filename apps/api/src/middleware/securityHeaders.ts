import type { NextFunction, Request, Response } from "express";

/**
 * HIPAA-minded response headers applied to every response.
 *
 * The API returns protected health information (plans, medications,
 * appointments, extracted text). `Cache-Control: no-store` keeps PHI out of
 * shared caches, browser back/forward caches, and any intermediary that
 * might otherwise retain it. The remaining headers harden the surface:
 * no MIME sniffing, no referrer leakage, and no framing.
 *
 * Placed before every route so even 404s and error responses carry them.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  // Only meaningful over HTTPS; harmless elsewhere since browsers ignore it.
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  next();
}

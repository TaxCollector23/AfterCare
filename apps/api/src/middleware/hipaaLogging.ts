import type { NextFunction, Request, Response } from "express";

export function hipaaAuditLog(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on("finish", () => {
    // Never log request bodies, filenames, extracted text, questions, or answers.
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "discharge-guide-api",
        userId: req.userId,
        action: `${req.method} ${req.route?.path ?? req.path}`,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        ipAddress: req.ip
      })
    );
  });
  next();
}

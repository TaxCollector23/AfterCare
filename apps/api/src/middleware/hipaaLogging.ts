import type { NextFunction, Request, Response } from "express";
import { repository } from "../db/repository.js";

export function hipaaAuditLog(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    // Never record bodies, filenames, extracted text, questions, answers, or tokens.
    repository.recordAudit({
      userId: req.userId,
      action: `${req.method} ${req.route?.path ?? req.path}`,
      resource: String(
        req.params.documentId ??
          req.params.medicationId ??
          req.params.appointmentId ??
          "api",
      ),
      timestamp: new Date().toISOString(),
      ipAddress: req.ip ?? "0.0.0.0",
      statusCode: res.statusCode,
    });
  });
  next();
}

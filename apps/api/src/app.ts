import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { databaseStatus } from "./db/client.js";
import { AppError } from "./errors.js";
import { googleDriveStatus } from "./integrations/googleDrive.js";
import { storageStatus } from "./integrations/storage.js";
import { authenticate } from "./middleware/auth.js";
import { hipaaAuditLog } from "./middleware/hipaaLogging.js";
import { apiRateLimit } from "./middleware/rateLimits.js";
import { accessibilityRouter } from "./routes/accessibility.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { askRouter } from "./routes/ask.js";
import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { driveCallbackRouter, driveRouter } from "./routes/drive.js";
import { medicationsRouter } from "./routes/medications.js";
import { processRouter } from "./routes/process.js";
import { uploadRouter } from "./routes/upload.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Last-Event-ID"]
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(hipaaAuditLog);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "discharge-guide-api",
      database: databaseStatus(),
      storage: storageStatus(),
      integrations: [googleDriveStatus()]
    });
  });
  app.use("/auth", apiRateLimit, authRouter);
  app.use("/drive", driveCallbackRouter);

  app.use(authenticate);
  app.use(apiRateLimit);
  app.use("/upload", uploadRouter);
  app.use("/process", processRouter);
  app.use("/medications", medicationsRouter);
  app.use("/appointments", appointmentsRouter);
  app.use("/ask", askRouter);
  app.use("/drive", driveRouter);
  app.use("/accessibility", accessibilityRouter);
  app.use("/documents", documentsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Route not found", code: "NOT_FOUND" }));

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message, code: error.code, details: error.details });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Invalid request", code: "INVALID_INPUT", details: error.issues });
        return;
      }
      if (error instanceof Error && error.message === "Unsupported file type") {
        res.status(415).json({ error: error.message, code: "UNSUPPORTED_MEDIA_TYPE" });
        return;
      }
      console.error("Unhandled API error", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "Unexpected server error", code: "INTERNAL_ERROR" });
    }
  );
  return app;
}

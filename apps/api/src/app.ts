import cors from "cors";
import express from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { cacheStatus, pingCache } from "./cache/index.js";
import { config } from "./config.js";
import { databaseHealth } from "./db/client.js";
import { AiApiError, AppError } from "./errors.js";
import { googleDriveStatus } from "./integrations/googleDrive.js";
import { storageStatus } from "./integrations/storage.js";
import { authenticate } from "./middleware/auth.js";
import { hipaaAuditLog } from "./middleware/hipaaLogging.js";
import { apiRateLimit } from "./middleware/rateLimits.js";
import { pipelineQueue, type PipelineQueue } from "./queue/pipelineQueue.js";
import { accessibilityRouter } from "./routes/accessibility.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { createAskRouter, type AskGroundedFunction } from "./routes/ask.js";
import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { driveCallbackRouter, driveRouter } from "./routes/drive.js";
import { medicationsRouter } from "./routes/medications.js";
import { createProcessRouter } from "./routes/process.js";
import { createUploadRouter } from "./routes/upload.js";

interface CreateAppOptions {
  queue?: PipelineQueue;
  askGrounded?: AskGroundedFunction;
  heartbeatMs?: number;
}

export function createApp(options: CreateAppOptions = {}) {
  const queue = options.queue ?? pipelineQueue;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: config.WEB_ORIGIN ?? false,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Last-Event-ID"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(hipaaAuditLog);

  app.get("/health", async (_req, res) => {
    // /health is Render's healthCheckPath: it must fail loudly (503) when a
    // configured dependency is down so a degraded instance gets restarted
    // instead of serving "ok" from a broken backend. Unconfigured pieces
    // (memory DB, no Redis) are healthy by definition.
    const database = await databaseHealth();
    const cache = cacheStatus();
    const databaseOk = database.ok;
    const cacheOk = !cache.configured || (await pingCache());
    const ok = databaseOk && cacheOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      service: "discharge-guide-api",
      database,
      storage: storageStatus(),
      cache,
      queue: queue.getStats(),
      integrations: [googleDriveStatus()],
      // Ops visibility into the free-tier AI waterfall: which providers are
      // configured (never their keys) and the per-provider request timeout.
      ai: {
        timeoutMs: config.AI_TIMEOUT_MS,
        waterfall: {
          openai: Boolean(config.OPENAI_API_KEY),
          openrouter: Boolean(config.OPENROUTER_API_KEY),
          geminiPrimary: Boolean(config.GEMINI_API_KEY_PRIMARY),
          geminiFallback: Boolean(config.GEMINI_API_KEY_FALLBACK),
        },
      },
    });
  });
  app.use("/auth", apiRateLimit, authRouter);
  app.use("/drive", driveCallbackRouter);

  app.use(authenticate);
  app.use(apiRateLimit);
  app.use("/upload", createUploadRouter(queue));
  app.use(
    "/process",
    createProcessRouter(queue, options.heartbeatMs ?? 15_000),
  );
  app.use("/medications", medicationsRouter);
  app.use("/appointments", appointmentsRouter);
  app.use("/ask", createAskRouter(options.askGrounded));
  app.use("/drive", driveRouter);
  app.use("/accessibility", accessibilityRouter);
  app.use("/documents", documentsRouter);

  app.use((_req, res) =>
    res.status(404).json({ error: "Route not found", code: "NOT_FOUND" }),
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof AiApiError) {
        res.status(error.statusCode).json(error.publicError);
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          details: error.details,
        });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Invalid request",
          code: "INVALID_INPUT",
          details: error.issues,
        });
        return;
      }
      if (error instanceof Error && error.message === "Unsupported file type") {
        res.status(415).json({
          error: "Please upload a PDF or a photo (JPG, PNG, or WebP).",
          code: "UNSUPPORTED_MEDIA_TYPE",
        });
        return;
      }
      // Without this, an oversized file surfaces as a bare 500 and the browser
      // shows "Unexpected server error" for something the user can act on.
      if (error instanceof MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error:
              "That file is over 20MB. Try a smaller scan, fewer pages, or a lower-resolution photo.",
            code: "FILE_TOO_LARGE",
          });
          return;
        }
        res
          .status(400)
          .json({ error: "That upload wasn't readable.", code: error.code });
        return;
      }
      res
        .status(500)
        .json({ error: "Unexpected server error", code: "INTERNAL_ERROR" });
    },
  );
  return app;
}

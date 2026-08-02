import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { anthropicStatus } from "./integrations/anthropic.js";
import { googleDriveStatus } from "./integrations/googleDrive.js";
import { auth } from "./middleware/auth.js";
import { hipaaAuditLog } from "./middleware/hipaaLogging.js";
import { accessibilityRouter } from "./routes/accessibility.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { askRouter } from "./routes/ask.js";
import { driveRouter } from "./routes/drive.js";
import { medicationsRouter } from "./routes/medications.js";
import { processRouter } from "./routes/process.js";
import { uploadRouter } from "./routes/upload.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(auth);
  app.use(hipaaAuditLog);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "discharge-guide-api",
      integrations: [anthropicStatus(), googleDriveStatus()]
    });
  });
  app.use("/upload", uploadRouter);
  app.use("/process", processRouter);
  app.use("/medications", medicationsRouter);
  app.use("/appointments", appointmentsRouter);
  app.use("/ask", askRouter);
  app.use("/drive", driveRouter);
  app.use("/accessibility", accessibilityRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error.message === "Unsupported file type" ? error.message : "Unexpected server error";
    res.status(error.message === "Unsupported file type" ? 415 : 500).json({ error: message });
  });
  return app;
}

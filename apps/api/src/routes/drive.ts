import { Router } from "express";
import { getDriveAuthorization, googleDriveStatus } from "../integrations/googleDrive.js";

export const driveRouter = Router();

driveRouter.get("/status", (_req, res) => res.json(googleDriveStatus()));
driveRouter.post("/auth", (_req, res) => res.json(getDriveAuthorization()));

const unavailable = (_req: import("express").Request, res: import("express").Response) => {
  res.status(503).json({
    error: "Google Drive integration is not configured.",
    isPlaceholder: true,
    requiredScope: "https://www.googleapis.com/auth/drive.file"
  });
};

driveRouter.post("/import", unavailable);
driveRouter.post("/backup", unavailable);

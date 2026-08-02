import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository.js";
import {
  backupDriveFile,
  completeDriveAuthorization,
  getDriveAuthorization,
  googleDriveStatus,
  importDriveFile
} from "../integrations/googleDrive.js";
import { hashFile, storeDocument } from "../integrations/storage.js";
import { pipelineQueue } from "../queue/pipelineQueue.js";

export const driveRouter = Router();
export const driveCallbackRouter = Router();

driveRouter.get("/status", (_req, res) => res.json(googleDriveStatus()));
driveRouter.post("/auth", (req, res, next) => {
  try {
    res.json(getDriveAuthorization(req.userId!));
  } catch (error) {
    next(error);
  }
});

driveCallbackRouter.get("/callback", async (req, res, next) => {
  try {
    const parsed = z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(req.query);
    const result = await completeDriveAuthorization(parsed.code, parsed.state);
    req.userId = result.userId;
    res.json({ connected: true });
  } catch (error) {
    next(error);
  }
});

driveRouter.post("/import", async (req, res, next) => {
  try {
    const { fileId } = z.object({ fileId: z.string().min(1) }).parse(req.body);
    const imported = await importDriveFile(req.userId!, fileId);
    const fileHash = hashFile(imported.bytes);
    const duplicate = repository.findDocumentByHash(fileHash, req.userId!);
    if (duplicate) {
      res.json({ documentId: duplicate.id, status: duplicate.status, deduplicated: true });
      return;
    }
    const documentId = randomUUID();
    const storageKey = await storeDocument(req.userId!, documentId, imported.bytes);
    repository.createDocument({
      id: documentId,
      userId: req.userId!,
      filename: imported.name,
      mimeType: imported.mimeType,
      fileHash,
      storageKey,
      uploadedAt: new Date().toISOString(),
      status: "uploaded"
    });
    pipelineQueue.enqueue(documentId);
    res.status(202).json({ documentId, status: "processing", deduplicated: false });
  } catch (error) {
    next(error);
  }
});

driveRouter.post("/backup", async (req, res, next) => {
  try {
    const { documentId } = z.object({ documentId: z.string().uuid() }).parse(req.body);
    const document = repository.findDocument(documentId, req.userId!);
    if (!document?.plan) {
      res.status(404).json({ error: "Recovery plan not found" });
      return;
    }
    const bytes = Buffer.from(JSON.stringify(document.plan, null, 2));
    const result = await backupDriveFile(req.userId!, `recovery-guide-${documentId}.json`, bytes);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { documents } from "../db/schema.js";
import { createEmptyPlan, processDocument } from "../pipeline/orchestrator.js";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("Unsupported file type"));
      return;
    }
    callback(null, true);
  }
});

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("document"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Attach a PDF, JPG, or PNG in the document field." });
    return;
  }

  const documentId = randomUUID();
  documents.set(documentId, {
    id: documentId,
    userId: req.userId,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString(),
    status: "uploaded",
    plan: createEmptyPlan(documentId)
  });

  void processDocument(documentId, req.file.buffer);
  res.status(202).json({
    documentId,
    status: "processing",
    processUrl: `/process/${documentId}`,
    isPlaceholder: true
  });
});

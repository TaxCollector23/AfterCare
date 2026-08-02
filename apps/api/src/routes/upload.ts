import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { repository } from "../db/repository.js";
import { hashFile, storeDocument } from "../integrations/storage.js";
import { uploadRateLimit } from "../middleware/rateLimits.js";
import { pipelineQueue } from "../queue/pipelineQueue.js";

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

uploadRouter.post("/", uploadRateLimit, upload.single("document"), async (req, res, next) => {
  try {
  if (!req.file) {
    res.status(400).json({ error: "Attach a PDF, JPG, or PNG in the document field." });
    return;
  }

  const userId = req.userId!;
  const fileHash = hashFile(req.file.buffer);
  const duplicate = repository.findDocumentByHash(fileHash, userId);
  if (duplicate) {
    res.status(200).json({
      documentId: duplicate.id,
      status: duplicate.status,
      processUrl: `/process/${duplicate.id}`,
      deduplicated: true
    });
    return;
  }

  const documentId = randomUUID();
  const storageKey = await storeDocument(userId, documentId, req.file.buffer);
  repository.createDocument({
    id: documentId,
    userId,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    fileHash,
    storageKey,
    uploadedAt: new Date().toISOString(),
    status: "uploaded"
  });

  pipelineQueue.enqueue(documentId);
  res.status(202).json({
    documentId,
    status: "processing",
    processUrl: `/process/${documentId}`,
    originalDocumentUrl: `/documents/${documentId}/original`,
    deduplicated: false
  });
  } catch (error) {
    next(error);
  }
});

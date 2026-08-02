import { Router } from "express";
import { repository } from "../db/repository.js";
import { deleteStoredDocument, loadDocument } from "../integrations/storage.js";
import { pipelineQueue } from "../queue/pipelineQueue.js";

export const documentsRouter = Router();

documentsRouter.get("/", (req, res) => {
  const documents = repository
    .listDocuments(req.userId!)
    .map((document) => ({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      status: document.status,
      uploadedAt: document.uploadedAt,
      failure: document.failure ?? null,
      originalUrl: `/documents/${document.id}/original`,
      planReady: document.status === "ready" && document.plan !== undefined,
    }));
  res.json({ data: documents });
});

// Re-run a document whose pipeline failed, without a re-upload. A transient
// AI outage is the common cause; retry is the recovery a user can do on their
// own instead of deleting and re-adding the same file.
documentsRouter.post("/:documentId/retry", (req, res) => {
  const document = repository.findDocument(
    req.params.documentId,
    req.userId!,
  );
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (document.status !== "failed") {
    res.status(409).json({
      error: "Only a failed document can be retried.",
      code: "NOT_RETRYABLE",
    });
    return;
  }
  repository.updateDocument(document.id, {
    status: "uploaded",
    failure: undefined,
    failureOriginalDocumentUrl: undefined,
  });
  const job = pipelineQueue.requeue(document.id);
  if (!job) {
    res.status(409).json({
      error: "That document is already processing.",
      code: "NOT_RETRYABLE",
    });
    return;
  }
  res.status(202).json({
    documentId: document.id,
    status: "processing",
    processUrl: `/process/${document.id}`,
  });
});

documentsRouter.get("/:documentId/original", async (req, res, next) => {
  try {
    const document = repository.findDocument(
      req.params.documentId,
      req.userId!,
    );
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const bytes = await loadDocument(document.storageKey);
    res.type(document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});

documentsRouter.delete("/:documentId", async (req, res, next) => {
  try {
    const document = repository.findDocument(
      req.params.documentId,
      req.userId!,
    );
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await deleteStoredDocument(document.storageKey);
    repository.deleteDocument(document.id, req.userId!);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

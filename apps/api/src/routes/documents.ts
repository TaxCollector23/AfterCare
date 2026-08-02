import { Router } from "express";
import { repository } from "../db/repository.js";
import { deleteStoredDocument, loadDocument } from "../integrations/storage.js";

export const documentsRouter = Router();

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

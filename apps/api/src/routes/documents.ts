import { Router } from "express";
import { repository } from "../db/repository.js";
import { loadDocument } from "../integrations/storage.js";

export const documentsRouter = Router();

documentsRouter.get("/:documentId/original", async (req, res, next) => {
  try {
    const document = repository.findDocument(req.params.documentId, req.userId!);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const bytes = await loadDocument(document.storageKey);
    res.type(document.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(document.filename)}`);
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});

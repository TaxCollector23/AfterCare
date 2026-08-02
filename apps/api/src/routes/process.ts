import type { ProcessingEvent } from "@discharge-guide/shared-types";
import { Router } from "express";
import { documents, processingEvents, processingHistory } from "../db/schema.js";

export const processRouter = Router();

function writeEvent(res: import("express").Response, event: ProcessingEvent) {
  res.write(`event: ${event.stage}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

processRouter.get("/:documentId", (req, res) => {
  const { documentId } = req.params;
  if (!documents.has(documentId)) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const history = processingHistory.get(documentId) ?? [];
  for (const event of history) writeEvent(res, event);
  if (history.at(-1)?.stage === "complete") {
    res.end();
    return;
  }

  const listener = (event: ProcessingEvent) => {
    writeEvent(res, event);
    if (event.stage === "complete" || event.status === "failed") res.end();
  };
  processingEvents.on(documentId, listener);
  req.on("close", () => processingEvents.off(documentId, listener));
});

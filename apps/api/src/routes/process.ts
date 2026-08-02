import { Router } from "express";
import { repository } from "../db/repository.js";
import { pipelineQueue, type StreamEvent } from "../queue/pipelineQueue.js";

export const processRouter = Router();

function writeEvent(res: import("express").Response, event: StreamEvent) {
  res.write(`event: ${event.stage}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

processRouter.get("/:documentId", (req, res) => {
  const { documentId } = req.params;
  const document = repository.findDocument(documentId, req.userId!);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const history = pipelineQueue.getHistory(documentId);
  for (const event of history) writeEvent(res, event);
  if (document.status === "ready") {
    res.write(`event: complete\ndata: ${JSON.stringify(document.plan)}\n\n`);
    res.end();
    return;
  }
  if (document.status === "failed") {
    res.write(`event: failed\ndata: ${JSON.stringify({ message: document.failureMessage })}\n\n`);
    res.end();
    return;
  }

  const unsubscribe = pipelineQueue.subscribe(documentId, (event) => writeEvent(res, event));
  const unsubscribeComplete = pipelineQueue.onComplete(documentId, (plan) => {
    res.write(`event: complete\ndata: ${JSON.stringify(plan)}\n\n`);
    res.end();
  });
  const unsubscribeFailure = pipelineQueue.onFailure(documentId, (message) => {
    res.write(`event: failed\ndata: ${JSON.stringify({ message })}\n\n`);
    res.end();
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    unsubscribeComplete();
    unsubscribeFailure();
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

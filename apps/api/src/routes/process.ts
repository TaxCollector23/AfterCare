import { Router } from "express";
import { repository } from "../db/repository.js";
import {
  pipelineQueue,
  type PipelineQueue,
  type StreamEvent,
} from "../queue/pipelineQueue.js";

function writeEvent(res: import("express").Response, event: StreamEvent) {
  res.write(`event: ${event.stage}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createProcessRouter(
  queue: PipelineQueue = pipelineQueue,
  heartbeatMs = 15_000,
) {
  const router = Router();
  router.get("/:documentId", (req, res) => {
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

    const history = queue.getHistory(documentId);
    for (const event of history) writeEvent(res, event);
    if (document.status === "ready") {
      res.write(`event: complete\ndata: ${JSON.stringify(document.plan)}\n\n`);
      res.end();
      return;
    }
    if (document.status === "failed") {
      res.write(
        `event: failed\ndata: ${JSON.stringify({
          ...(document.failure ?? {
            code: "AI_PROVIDER_UNAVAILABLE",
            message: "AI processing is temporarily unavailable.",
            retryable: true,
          }),
          originalDocumentUrl: document.failureOriginalDocumentUrl,
        })}\n\n`,
      );
      res.end();
      return;
    }

    const unsubscribe = queue.subscribe(documentId, (event) =>
      writeEvent(res, event),
    );
    const unsubscribeComplete = queue.onComplete(documentId, (plan) => {
      res.write(`event: complete\ndata: ${JSON.stringify(plan)}\n\n`);
      res.end();
    });
    const unsubscribeFailure = queue.onFailure(documentId, (error) => {
      res.write(`event: failed\ndata: ${JSON.stringify(error)}\n\n`);
      res.end();
    });
    const heartbeat = setInterval(
      () => res.write(": heartbeat\n\n"),
      heartbeatMs,
    );
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      unsubscribeComplete();
      unsubscribeFailure();
    };
    req.on("close", cleanup);
    res.on("close", cleanup);
  });
  return router;
}

export const processRouter = createProcessRouter();

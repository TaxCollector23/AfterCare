import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository.js";
import { isStructuredAiError, toAiApiError } from "../errors.js";
import { askGrounded } from "../pipeline/ask.js";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(1_000),
  documentId: z.string().uuid(),
});

export type AskGroundedFunction = typeof askGrounded;

export function createAskRouter(ask: AskGroundedFunction = askGrounded) {
  const router = Router();
  router.post("/", async (req, res, next) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "A question and valid documentId are required." });
      return;
    }
    const document = repository.findDocument(
      parsed.data.documentId,
      req.userId!,
    );
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    try {
      const answer = await ask(parsed.data);
      if (isStructuredAiError(answer)) {
        next(toAiApiError(answer));
        return;
      }
      res.json(answer);
    } catch (error) {
      next(toAiApiError(error));
    }
  });
  return router;
}

export const askRouter = createAskRouter();

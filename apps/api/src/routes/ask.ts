import { Router } from "express";
import { z } from "zod";
import { documents } from "../db/schema.js";
import { askGroundedQuestion } from "../integrations/anthropic.js";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(1_000),
  documentId: z.string().uuid()
});

export const askRouter = Router();

askRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A question and valid documentId are required." });
    return;
  }
  const document = documents.get(parsed.data.documentId);
  if (!document || document.userId !== req.userId) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // OCR text is intentionally not persisted by the placeholder pipeline.
  const answer = await askGroundedQuestion(parsed.data.question, "");
  res.json(answer);
});

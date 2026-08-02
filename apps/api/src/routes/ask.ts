import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository.js";
import { askGrounded } from "../pipeline/ask.js";

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
  const document = repository.findDocument(parsed.data.documentId, req.userId!);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const answer = await askGrounded(parsed.data);
  res.json(answer);
});

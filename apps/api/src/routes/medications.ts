import { Router } from "express";
import { documents, findMedication } from "../db/schema.js";

export const medicationsRouter = Router();

medicationsRouter.get("/", (req, res) => {
  const documentId = String(req.query.documentId ?? "");
  const document = documents.get(documentId);
  if (!document || document.userId !== req.userId) {
    res.status(404).json({ error: "Recovery plan not found" });
    return;
  }
  res.json({ data: document.plan.medications, isPlaceholder: document.plan.isPlaceholder });
});

medicationsRouter.post("/:medicationId/taken", (req, res) => {
  const medication = findMedication(req.params.medicationId, req.userId);
  if (!medication) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }
  const takenAt = new Date().toISOString();
  medication.takenAt.push(takenAt);
  res.json({ medicationId: medication.id, takenAt });
});

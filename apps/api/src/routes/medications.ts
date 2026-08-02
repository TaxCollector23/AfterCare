import { Router } from "express";
import { repository } from "../db/repository.js";

export const medicationsRouter = Router();

medicationsRouter.get("/", (req, res) => {
  const documentId = String(req.query.documentId ?? "");
  const medications = repository.listMedications(documentId, req.userId!);
  if (!medications) {
    res.status(404).json({ error: "Recovery plan not found" });
    return;
  }
  res.json({ data: medications });
});

medicationsRouter.post("/:medicationId/taken", (req, res) => {
  const medication = repository.findMedication(
    req.params.medicationId,
    req.userId!,
  );
  if (!medication) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }
  const takenAt = new Date().toISOString();
  const adherence = repository.recordTaken(medication.id, req.userId!, takenAt);
  res.status(201).json(adherence);
});

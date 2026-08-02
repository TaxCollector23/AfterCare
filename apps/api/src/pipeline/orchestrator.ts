import type { ProcessingEvent, RecoveryPlan } from "@discharge-guide/shared-types";
import { randomUUID } from "node:crypto";
import { documents, processingEvents, processingHistory } from "../db/schema.js";
import { detectAppointments } from "./appointmentDetection.js";
import { generateExplanations } from "./explanationGenerator.js";
import { extractMedicalInformation } from "./extraction.js";
import { detectMedications } from "./medicationDetection.js";
import { runOcr } from "./ocr.js";
import { buildTimeline } from "./timelineBuilder.js";
import { detectWarnings } from "./warningDetection.js";

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function emit(event: ProcessingEvent) {
  const history = processingHistory.get(event.documentId) ?? [];
  history.push(event);
  processingHistory.set(event.documentId, history);
  processingEvents.emit(event.documentId, event);
}

function progress(
  documentId: string,
  stage: ProcessingEvent["stage"],
  value: number,
  message: string,
  partial?: unknown
) {
  emit({
    documentId,
    stage,
    status: stage === "complete" ? "completed" : "completed",
    progress: value,
    message,
    partial,
    timestamp: new Date().toISOString()
  });
}

export async function processDocument(documentId: string, bytes: Buffer) {
  const document = documents.get(documentId);
  if (!document) return;
  document.status = "processing";

  const ocr = await runOcr(bytes);
  progress(documentId, "ocr", 15, "Document read", ocr);
  await pause(30);

  const extraction = await extractMedicalInformation(ocr.data.text);
  progress(documentId, "extract", 30, "Medical information structured", extraction);
  await pause(30);

  const medications = await detectMedications(ocr.data.text);
  progress(documentId, "detect_medications", 45, "Medications checked", medications);
  await pause(30);

  const appointments = await detectAppointments(ocr.data.text);
  progress(documentId, "detect_appointments", 60, "Appointments checked", appointments);
  await pause(30);

  const warnings = await detectWarnings(ocr.data.text);
  progress(documentId, "detect_warnings", 72, "Warning signs checked", warnings);
  await pause(30);

  const timeline = await buildTimeline(ocr.data.text);
  progress(documentId, "build_timeline", 86, "Recovery timeline built", timeline);
  await pause(30);

  const explanations = await generateExplanations(extraction.data.terms);
  progress(documentId, "generate_explanations", 95, "Explanations prepared", explanations);

  const plan: RecoveryPlan = {
    documentId,
    status: "ready",
    disclaimer: "This app explains instructions; it never replaces medical advice.",
    medications: medications.data,
    appointments: appointments.data,
    warnings: warnings.data,
    timeline: timeline.data,
    isPlaceholder: true
  };
  document.plan = plan;
  document.status = "ready";
  progress(documentId, "complete", 100, "Recovery guide ready", plan);
}

export function createEmptyPlan(documentId = randomUUID()): RecoveryPlan {
  return {
    documentId,
    status: "processing",
    disclaimer: "This app explains instructions; it never replaces medical advice.",
    medications: [],
    appointments: [],
    warnings: [],
    timeline: [],
    isPlaceholder: true
  };
}

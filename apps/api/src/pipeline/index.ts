/**
 * Pipeline orchestrator ? the single entry point Person B's SSE route
 * (`GET /process/:documentId`) calls. This file is the only place that
 * knows the stage order; it never touches Express, req/res, or the DB.
 *
 * Contract: `runPipeline(documentId, emit)` -> Promise<RecoveryPlan>.
 * `emit` is called after every stage transition so the Processing screen
 * gets live partial results instead of waiting for the whole thing.
 */
import { createHash } from "node:crypto";
import { runOcr, type OcrInput } from "./ocr.js";
import { runExtraction } from "./extraction.js";
import { detectMedications } from "./medicationDetection.js";
import { detectAppointments } from "./appointmentDetection.js";
import { detectWarnings } from "./warningDetection.js";
import { buildTimeline } from "./timelineBuilder.js";
import { generateExplanations } from "./explanationGenerator.js";
import { applyJudgeVerdicts, judgeConfidence, judgeFindings } from "./judge.js";
import { cacheExtraction, cacheExplanations } from "../cache/index.js";
import type {
  PipelineEmitter,
  PipelineRecoveryPlan,
  StageResult,
} from "./types.js";

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface RunPipelineInput extends OcrInput {
  documentId: string;
}

function emitStage(
  emit: PipelineEmitter,
  stage: Parameters<PipelineEmitter>[0]["stage"],
) {
  return {
    started: () => emit({ stage, status: "started" }),
    done: (result: StageResult<unknown>) =>
      emit({
        stage,
        status: "done",
        data: result.data,
        confidence: result.confidence,
      }),
    error: (message: string) =>
      emit({ stage, status: "error", error: message }),
    /** Reports a degradable stage's outcome without the caller branching on `.success`. */
    settle: (result: StageResult<unknown>, fallbackError: string) => {
      if (result.success) {
        emit({
          stage,
          status: "done",
          data: result.data,
          confidence: result.confidence,
        });
      } else {
        emit({ stage, status: "error", error: result.error ?? fallbackError });
      }
    },
  };
}

/**
 * Runs the full OCR -> Extraction -> Detection -> Timeline -> Explanations
 * pipeline for one document, emitting progress as it goes.
 *
 * Throws only on unrecoverable failure (OCR/extraction). Individual
 * detection stages degrade gracefully ? a failed stage contributes an
 * empty array plus a `session.error`-style emit, rather than aborting the
 * whole run, so one bad section doesn't block the entire dashboard.
 */
export async function runPipeline(
  input: RunPipelineInput,
  emit: PipelineEmitter,
): Promise<PipelineRecoveryPlan> {
  const { documentId, ...ocrInput } = input;
  const hash = fileHash(ocrInput.buffer);

  const ocrEvents = emitStage(emit, "ocr");
  ocrEvents.started();
  const ocrResult = await runOcr(ocrInput);
  if (!ocrResult.success || !ocrResult.data) {
    ocrEvents.error(ocrResult.error ?? "OCR failed");
    throw new Error(ocrResult.error ?? "OCR failed");
  }
  ocrEvents.done(ocrResult);
  const ocr = ocrResult.data;

  const extractEvents = emitStage(emit, "extract");
  extractEvents.started();
  const extraction = await cacheExtraction(hash, () => runExtraction(ocr));
  if (!extraction.success || !extraction.data) {
    extractEvents.error(extraction.error ?? "Extraction failed");
    throw new Error(extraction.error ?? "Extraction failed");
  }
  extractEvents.done(extraction);
  const sections = extraction.data;

  const medsEvents = emitStage(emit, "meds");
  medsEvents.started();
  const medsResult = await detectMedications(sections.medicationsText, ocr);
  medsEvents.settle(medsResult, "Medication detection failed");
  let medications = medsResult.data ?? [];

  const apptsEvents = emitStage(emit, "appts");
  apptsEvents.started();
  const apptsResult = await detectAppointments(sections.appointmentsText, ocr);
  apptsEvents.settle(apptsResult, "Appointment detection failed");
  let appointments = apptsResult.data ?? [];

  const warningsEvents = emitStage(emit, "warnings");
  warningsEvents.started();
  const warningsResult = await detectWarnings(sections.warningsText, ocr);
  warningsEvents.settle(warningsResult, "Warning detection failed");
  let warnings = warningsResult.data ?? [];

  const timelineEvents = emitStage(emit, "timeline");
  timelineEvents.started();
  const timelineResult = await buildTimeline(
    sections.timelineText,
    { medications, appointments },
    ocr,
  );
  timelineEvents.settle(timelineResult, "Timeline building failed");
  const timeline = timelineResult.data ?? [];

  const explainEvents = emitStage(emit, "explain");
  explainEvents.started();
  const explainResult = await cacheExplanations(hash, () =>
    generateExplanations(ocr),
  );
  explainEvents.settle(explainResult, "Explanation generation failed");
  const explanations = explainResult.data ?? [];

  // Stage 6: the LLM judge re-verifies the structured findings against the
  // source text. Degrades gracefully: if judging fails, the original findings
  // are kept untouched and the stage contributes full confidence.
  const judgeEvents = emitStage(emit, "judge");
  judgeEvents.started();
  const judgeResult = await judgeFindings(ocr, {
    medications,
    appointments,
    warnings,
  });
  let judgeConf = 100;
  if (judgeResult.success && judgeResult.data) {
    const judged = applyJudgeVerdicts(
      { medications, appointments, warnings },
      judgeResult.data,
    );
    medications = judged.medications;
    appointments = judged.appointments;
    warnings = judged.warnings;
    judgeConf = judgeConfidence(judgeResult.data);
    judgeEvents.done({
      ...judgeResult,
      data: {
        overall: judgeResult.data.overall,
        reviewReasons: judged.reviewReasons,
      },
    });
  } else {
    judgeEvents.settle(judgeResult, "Verification failed");
  }

  const allConfidences = [
    ocrResult.confidence,
    extraction.confidence,
    medsResult.confidence,
    apptsResult.confidence,
    warningsResult.confidence,
    timelineResult.confidence,
    explainResult.confidence,
    judgeConf,
  ];

  return {
    documentId,
    generatedAt: new Date().toISOString(),
    medications,
    appointments,
    warnings,
    timeline,
    explanations,
    overallConfidence: Math.min(...allConfidences),
  };
}

export { askGrounded, citedText } from "./ask.js";
export * from "./grounding.js";

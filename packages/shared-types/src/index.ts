/**
 * Shared contracts between the API, the pipeline, and the web app.
 *
 * Phase 0 of the backend split: Person A (pipeline) and Person B (API) both
 * import from here, so changes need agreement from both.
 */

/** Every pipeline stage returns this envelope. Never throw across a stage boundary. */
export interface StageResult<T> {
  success: boolean;
  data: T | null;
  /** 0-100. Below CONFIDENCE_THRESHOLD the UI shows "check the original document". */
  confidence: number;
  error?: string;
  /** 1-indexed line numbers in the OCR text that support `data`. */
  sourceLines: number[];
}

/** Confidence below this triggers the inline "please check the original document" warning. */
export const CONFIDENCE_THRESHOLD = 80;

export function ok<T>(
  data: T,
  confidence: number,
  sourceLines: number[] = [],
): StageResult<T> {
  return { success: true, data, confidence, sourceLines };
}

export function fail<T>(error: string): StageResult<T> {
  return { success: false, data: null, confidence: 0, error, sourceLines: [] };
}

export function needsReview(result: StageResult<unknown>): boolean {
  return result.confidence < CONFIDENCE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export interface OcrLine {
  /** 1-indexed. This is what every `sourceLines` value refers to. */
  line: number;
  text: string;
  /** 0-100 confidence that this line was transcribed correctly. */
  confidence: number;
}

export interface OcrResult {
  lines: OcrLine[];
  /** All lines joined with "\n" — convenience for prompts that don't need numbers. */
  text: string;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Extracted clinical content
// ---------------------------------------------------------------------------

export interface Medication {
  id: string;
  name: string;
  /** Verbatim from the document. Never normalized or recalculated. */
  dose: string;
  /** e.g. "twice daily", "every 6 hours" — verbatim. */
  frequency: string;
  /** e.g. "morning and bedtime", "with food" — verbatim, may be empty. */
  timing: string;
  instructions: string;
  sourceLines: number[];
  confidence: number;
}

export interface Appointment {
  id: string;
  /** ISO 8601 date, or null when the document only gives a relative date. */
  date: string | null;
  /** Verbatim date text when `date` could not be resolved, e.g. "in 2 weeks". */
  dateText: string;
  doctor: string;
  specialty: string;
  location: string;
  notes: string;
  sourceLines: number[];
  confidence: number;
}

/** An ER red-flag symptom. Shown on the always-pinned Emergency screen. */
export interface Warning {
  id: string;
  symptom: string;
  /** What the patient should do — call the office, go to the ER, etc. */
  action: string;
  severity: 'call-doctor' | 'emergency';
  sourceLines: number[];
  confidence: number;
}

export type TimelineBucket = 'today' | 'tomorrow' | 'this-week' | 'later';

export interface TimelineEntry {
  id: string;
  bucket: TimelineBucket;
  title: string;
  detail: string;
  sourceLines: number[];
  confidence: number;
}

/** Plain-language definition of a medical term found in the document. */
export interface Explanation {
  id: string;
  term: string;
  plainText: string;
  sourceLines: number[];
  confidence: number;
}

export interface RecoveryPlan {
  documentId: string;
  generatedAt: string;
  medications: Medication[];
  appointments: Appointment[];
  warnings: Warning[];
  timeline: TimelineEntry[];
  explanations: Explanation[];
  /** Lowest stage confidence — drives the document-level review banner. */
  overallConfidence: number;
}

// ---------------------------------------------------------------------------
// Grounded Q&A (/ask)
// ---------------------------------------------------------------------------

export interface GroundedAnswer {
  answer: string;
  confidence: number;
  /** Empty when the document doesn't cover the question. */
  sourceLines: number[];
  /**
   * `document` — answered from the uploaded discharge papers.
   * `general` — general health education, explicitly not from the document.
   * `not-found` — the document doesn't cover it and no safe general answer exists.
   */
  source: 'document' | 'general' | 'not-found';
}

// ---------------------------------------------------------------------------
// SSE contract (Person B wires this to the /process/:documentId endpoint)
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'ocr'
  | 'extract'
  | 'meds'
  | 'appts'
  | 'warnings'
  | 'timeline'
  | 'explain';

export interface PipelineEvent {
  stage: PipelineStage;
  status: 'started' | 'done' | 'error';
  /** Partial result for this stage, surfaced to the Processing screen immediately. */
  data?: unknown;
  confidence?: number;
  error?: string;
}

/** Callback the API layer passes into `runPipeline`. */
export type PipelineEmitter = (event: PipelineEvent) => void;

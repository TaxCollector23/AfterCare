/** Internal pipeline contracts. The public API contract remains in shared-types. */
export interface StageResult<T> {
  success: boolean;
  data: T | null;
  confidence: number;
  error?: string;
  sourceLines: number[];
}

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

export interface OcrLine {
  line: number;
  text: string;
  confidence: number;
}

export interface OcrResult {
  lines: OcrLine[];
  text: string;
  pageCount: number;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  timing: string;
  instructions: string;
  sourceLines: number[];
  confidence: number;
}

export interface Appointment {
  id: string;
  date: string | null;
  dateText?: string;
  doctor: string;
  specialty: string;
  location: string;
  notes: string;
  sourceLines: number[];
  confidence: number;
}

export interface Warning {
  id: string;
  symptom: string;
  action: string;
  severity?: "call-doctor" | "emergency";
  sourceLines: number[];
  confidence: number;
}

export type TimelineBucket = "today" | "tomorrow" | "this-week" | "later";

export interface TimelineEntry {
  id: string;
  bucket: TimelineBucket;
  title: string;
  detail: string;
  sourceLines: number[];
  confidence: number;
}

export interface Explanation {
  id: string;
  term: string;
  plainText: string;
  sourceLines: number[];
  confidence: number;
}

export interface GroundedAnswer {
  answer: string;
  confidence: number;
  sourceLines: number[];
  source: "document" | "general" | "not-found";
}

export type PipelineStage =
  "ocr" | "extract" | "meds" | "appts" | "warnings" | "timeline" | "explain";

export interface PipelineStageEvent {
  stage: PipelineStage;
  status: "started" | "done" | "error";
  data?: unknown;
  confidence?: number;
  error?: string;
}

export type PipelineEmitter = (event: PipelineStageEvent) => void;

export interface PipelineRecoveryPlan {
  documentId: string;
  generatedAt: string;
  medications: Medication[];
  appointments: Appointment[];
  warnings: Warning[];
  timeline: TimelineEntry[];
  explanations: Explanation[];
  overallConfidence: number;
}

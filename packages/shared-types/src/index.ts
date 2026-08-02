export type PipelineStage = "ocr" | "extract" | "meds" | "appts" | "warnings" | "timeline" | "explain";

export interface GroundedResult<T> {
  success: boolean;
  data: T;
  confidence: number;
  sourceLines: number[];
  error?: string;
  warning?: string;
  isPlaceholder?: boolean;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  timing: string;
  instructions: string;
  takenAt: string[];
  confidence: number;
  sourceLines: number[];
}

export interface Appointment {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  location: string;
  notes: string;
  confidence: number;
  sourceLines: number[];
}

export interface WarningSign {
  id: string;
  symptom: string;
  action: "call_provider" | "emergency_room" | "call_911";
  confidence: number;
  sourceLines: number[];
}

export interface TimelineEntry {
  id: string;
  label: string;
  date: string | null;
  instructions: string;
  confidence: number;
  sourceLines: number[];
}

export interface RecoveryPlan {
  documentId: string;
  status: "processing" | "ready" | "failed";
  disclaimer: string;
  medications: Medication[];
  appointments: Appointment[];
  warnings: WarningSign[];
  timeline: TimelineEntry[];
  isPlaceholder: boolean;
}

export interface PipelineEvent {
  stage: PipelineStage;
  status: "started" | "completed" | "failed";
  data: unknown;
  error?: string;
}

export type PipelineEmit = (event: PipelineEvent) => void;

export interface AskGroundedInput {
  question: string;
  documentId: string;
}

export interface AskGroundedResult {
  answer: string;
  confidence: number;
  source: {
    documentId: string;
    sourceLines: number[];
  };
}

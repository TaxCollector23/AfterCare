export type PipelineStage =
  | "ocr"
  | "extract"
  | "detect_medications"
  | "detect_appointments"
  | "detect_warnings"
  | "build_timeline"
  | "generate_explanations"
  | "complete";

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

export interface TimelineItem {
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
  timeline: TimelineItem[];
  isPlaceholder: boolean;
}

export interface ProcessingEvent {
  documentId: string;
  stage: PipelineStage;
  status: "started" | "completed" | "failed";
  progress: number;
  message: string;
  partial?: unknown;
  timestamp: string;
}

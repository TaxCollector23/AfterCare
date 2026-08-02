import type { WarningSign } from "@discharge-guide/shared-types";

/** Re-exported so screens import one view-model module rather than two. */
export type { WarningSign };

export type DocumentStatus = "uploaded" | "processing" | "ready" | "error";

export interface UploadedDocument {
  id: string;
  ownerUid: string;
  fileName: string;
  source: "upload" | "google-drive";
  status: DocumentStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  storagePath?: string;
  driveFileId?: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dose: string;
  frequency: string;
  purpose: string;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  foodInstructions?: string;
  sideEffects?: string[];
  missedDoseInstructions?: string;
  /** Raw timing text from the document, kept so Today's Plan can re-derive slots. */
  timing?: string;
  /** ISO timestamps of recorded doses. Absent until a dose is logged. */
  takenAt?: string[];
  sourceLines?: number[];
}

export interface Appointment {
  id: string;
  providerName: string;
  specialty?: string;
  location?: string;
  address?: string;
  /** Localised for display; not parseable back into an instant. */
  date: string;
  time: string;
  notes?: string;
  /** Machine-readable appointment instant, when the document gave a real date. */
  isoDate?: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  title: string;
  description: string;
  status: "done" | "today" | "upcoming";
  /** ISO date the document placed this step on, or null when it stated none. */
  date?: string | null;
  sourceLines?: number[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  plainLanguage: string;
  sourceExcerpt?: string;
  /** Document lines this explanation was grounded in. */
  sourceLines?: number[];
  confidence?: number;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  sourceLabel?: string;
  /** Document line numbers this answer was grounded in. */
  sourceLines?: number[];
}

export interface Restriction {
  id: string;
  label: string;
}

/** Everything derived from the patient's own uploaded paperwork. Nothing here is invented — every
 *  field is either empty/absent or was extracted from a document the patient provided. */
export interface RecoveryData {
  documentId: string;
  medications: Medication[];
  appointments: Appointment[];
  timeline: TimelineEvent[];
  glossary: GlossaryTerm[];
  faq: FaqEntry[];
  restrictions: Restriction[];
  /** Display strings for the Emergency screen ("symptom — what to do"). */
  redFlagSymptoms: string[];
  /**
   * The same warning signs with their structured action intact. Needed by the
   * symptom check-in, which escalates on the action the document prescribed.
   * Absent for guides written before warnings were carried through.
   */
  warnings?: WarningSign[];
  /** When the pipeline finished this guide — the day-1 anchor for Today's Plan. */
  processedAt?: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  createdAt: number;
  caregiverEmails?: string[];
}

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
}

export interface Appointment {
  id: string;
  providerName: string;
  specialty?: string;
  location?: string;
  address?: string;
  date: string;
  time: string;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  title: string;
  description: string;
  status: "done" | "today" | "upcoming";
}

export interface GlossaryTerm {
  id: string;
  term: string;
  plainLanguage: string;
  sourceExcerpt?: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  sourceLabel?: string;
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
  redFlagSymptoms: string[];
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  createdAt: number;
  caregiverEmails?: string[];
}

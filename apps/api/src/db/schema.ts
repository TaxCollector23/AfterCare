import type {
  Appointment,
  Medication,
  RecoveryPlan,
  StructuredAiError
} from "@discharge-guide/shared-types";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  fileHash: string;
  storageKey: string;
  uploadedAt: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  failure?: StructuredAiError;
  failureOriginalDocumentUrl?: string;
  plan?: RecoveryPlan;
}

export interface AccessibilityPreferences {
  textSize: "large" | "very_large";
  darkMode: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  voiceReading: boolean;
}

export interface AuditLogRecord {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  statusCode: number;
}

export interface AdherenceRecord {
  id: string;
  medicationId: string;
  userId: string;
  takenAt: string;
}

export interface DatabaseState {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  documents: Map<string, DocumentRecord>;
  medications: Map<string, Medication>;
  appointments: Map<string, Appointment>;
  adherence: AdherenceRecord[];
  preferences: Map<string, AccessibilityPreferences>;
  auditLogs: AuditLogRecord[];
}

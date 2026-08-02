import type {
  Appointment,
  ProcessingEvent,
  RecoveryPlan
} from "@discharge-guide/shared-types";
import { EventEmitter } from "node:events";

export interface DocumentRecord {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  plan: RecoveryPlan;
}

export interface AccessibilityPreferences {
  textSize: "large" | "very_large";
  darkMode: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  voiceReading: boolean;
}

export const documents = new Map<string, DocumentRecord>();
export const processingHistory = new Map<string, ProcessingEvent[]>();
export const processingEvents = new EventEmitter();
export const accessibilityPreferences = new Map<string, AccessibilityPreferences>();

export function findMedication(medicationId: string, userId: string) {
  for (const document of documents.values()) {
    if (document.userId !== userId) continue;
    const medication = document.plan.medications.find(({ id }) => id === medicationId);
    if (medication) return medication;
  }
  return undefined;
}

export function findAppointment(appointmentId: string, userId: string): Appointment | undefined {
  for (const document of documents.values()) {
    if (document.userId !== userId) continue;
    const appointment = document.plan.appointments.find(({ id }) => id === appointmentId);
    if (appointment) return appointment;
  }
  return undefined;
}

export function resetStore() {
  documents.clear();
  processingHistory.clear();
  accessibilityPreferences.clear();
  processingEvents.removeAllListeners();
}

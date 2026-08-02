/**
 * Daily check-in log.
 *
 * Kept on the device for the same reason as the dose log (see adherence.ts):
 * in firebase mode the recovery guide itself is `allow write: if false`, so
 * patient-entered records live outside it. When the session is backed by a
 * Firebase account, concerning check-ins are also written to
 * `users/{uid}/alerts` so the care circle can actually see them.
 */

import {
  overallCheckInLevel,
  shouldAlertCaregivers,
  type CheckInAnswers,
  type CheckInRecord,
} from "@discharge-guide/shared-types";
import { recordCaregiverAlert } from "./caregivers";
import type { AppUser } from "./session";

const LOG_KEY = "aftercare:checkins";
const MAX_STORED = 60;

const listeners = new Set<() => void>();

function readAll(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as CheckInRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CheckInRecord[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(records.slice(0, MAX_STORED)));
  } catch {
    /* quota exceeded — the check-in log is best-effort */
  }
  listeners.forEach((cb) => cb());
}

/** Subscribe to check-in changes, mirroring localStore's subscribe pattern. */
export function subscribeCheckIns(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Check-in history for one document, newest first. */
export function checkInsFor(documentId: string): CheckInRecord[] {
  return readAll()
    .filter((record) => record.documentId === documentId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Saves a check-in and, when the patient reported anything amber or red,
 * records an alert against the care circle.
 *
 * The check-in is stored first so a failure to reach the care circle never
 * loses what the patient reported. The returned record carries the emails the
 * alert reached, so the screen can say plainly who was told.
 */
export async function submitCheckIn(
  user: AppUser | null,
  documentId: string,
  answers: CheckInAnswers,
): Promise<CheckInRecord> {
  const overall = overallCheckInLevel(answers);
  const record: CheckInRecord = {
    id: crypto.randomUUID(),
    documentId,
    answers,
    overall,
    createdAt: Date.now(),
    acknowledgedAt: null,
    notifiedEmails: [],
  };

  writeAll([record, ...readAll()]);

  if (!shouldAlertCaregivers(overall)) return record;

  const alert = await recordCaregiverAlert(user, {
    documentId,
    // A traffic-light check-in isn't tied to document warning-sign ids.
    warningIds: [],
    symptoms: Object.entries(answers)
      .filter(([, level]) => level === overall)
      .map(([question]) => `${question}: ${overall}`),
    // The care-circle alert schema speaks in warning-sign actions; an amber or
    // red self-report is a "contact your provider" signal, not an instruction
    // the document gave, so it never escalates past call_provider here.
    action: "call_provider",
  });

  const notified = { ...record, notifiedEmails: alert.notifiedEmails };
  writeAll(readAll().map((r) => (r.id === record.id ? notified : r)));
  return notified;
}

/** The most recent check-in for a document, or null when there are none. */
export function latestCheckIn(documentId: string): CheckInRecord | null {
  return checkInsFor(documentId)[0] ?? null;
}

/** Marks a concerning check-in as dealt with, clearing it from follow-up priority. */
export function acknowledgeCheckIn(id: string): void {
  writeAll(
    readAll().map((record) =>
      record.id === id ? { ...record, acknowledgedAt: Date.now() } : record,
    ),
  );
}

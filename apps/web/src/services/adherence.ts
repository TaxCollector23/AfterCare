/**
 * Dose log for Today's Plan.
 *
 * Kept on the device in every mode. The recovery guide itself is not a valid
 * home for this: in firebase mode `users/{uid}/.../recovery/{id}` is
 * `allow write: if false` (see firestore.rules) because only the trusted
 * pipeline may write a patient's guide, so a client-side dose tick has to live
 * somewhere else.
 *
 * In backend mode the API is still the system of record — `recordDose` posts to
 * `POST /medications/:id/taken` as well, and a failure there surfaces to the
 * caller rather than being swallowed, so the UI never shows a dose as synced
 * when it wasn't.
 */

import { currentMode } from "./config";
import { backendMarkTaken } from "./backend";

const LOG_KEY = "aftercare:doses";

/** documentId -> medicationId -> ISO timestamps. */
type DoseLog = Record<string, Record<string, string[]>>;

const listeners = new Set<() => void>();

function readLog(): DoseLog {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as DoseLog) : {};
  } catch {
    return {};
  }
}

function writeLog(log: DoseLog): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* quota exceeded — the dose log is best-effort */
  }
  listeners.forEach((cb) => cb());
}

/** Subscribe to dose-log changes, mirroring localStore's subscribe pattern. */
export function subscribeDoses(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Recorded doses for one document, by medication id. */
export function dosesFor(documentId: string): Record<string, string[]> {
  return readLog()[documentId] ?? {};
}

/**
 * Records one dose as taken now.
 *
 * The local entry is written first so the checkbox responds immediately, then
 * the backend is told. If the backend rejects it the local entry is rolled back
 * and the error is rethrown — a tick that didn't reach the server must not look
 * like one that did.
 */
export async function recordDose(
  documentId: string,
  medicationId: string
): Promise<void> {
  const takenAt = new Date().toISOString();
  const log = readLog();
  const forDocument = log[documentId] ?? {};
  const previous = forDocument[medicationId] ?? [];
  writeLog({
    ...log,
    [documentId]: { ...forDocument, [medicationId]: [...previous, takenAt] },
  });

  if (currentMode() !== "backend") return;

  try {
    await backendMarkTaken(medicationId);
  } catch (error) {
    const rollback = readLog();
    const rollbackDoc = rollback[documentId] ?? {};
    writeLog({
      ...rollback,
      [documentId]: { ...rollbackDoc, [medicationId]: previous },
    });
    throw error;
  }
}

/**
 * Every recorded dose for a medication: what the plan already knew plus what
 * this device has logged since.
 *
 * Exact-duplicate timestamps are collapsed. A server timestamp and the local
 * timestamp for the same tap differ by milliseconds, so they are not treated as
 * one entry — in practice the plan is only re-read when a document is
 * reprocessed, so the two lists do not overlap.
 */
export function mergeTakenAt(
  planTakenAt: readonly string[] | undefined,
  loggedTakenAt: readonly string[] | undefined
): string[] {
  return [...new Set([...(planTakenAt ?? []), ...(loggedTakenAt ?? [])])];
}

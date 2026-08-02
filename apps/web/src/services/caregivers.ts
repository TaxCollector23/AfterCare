/**
 * The patient's care circle, and the alerts raised to it.
 *
 * Mirrors the mode routing in documents.ts: a signed-in Firebase account keeps
 * the list (and any alerts) on the account so a caregiver can actually read
 * them; every other mode keeps them on this device.
 *
 * Alerts are records, not deliveries. There is no email infrastructure in
 * apps/api, so nothing here claims to have sent mail — `recordCaregiverAlert`
 * writes an alert row that caregivers with read access can see, and the caller
 * tells the patient plainly who was notified and who wasn't.
 */

import { currentMode } from "./config";
import type { AppUser } from "./session";
import type { WarningAction } from "@discharge-guide/shared-types";

const CAREGIVERS_KEY = "aftercare:caregivers";
const ALERTS_KEY = "aftercare:alerts";

export interface CaregiverAlert {
  id: string;
  documentId: string;
  /** Warning-sign ids from the document — never free text. */
  warningIds: string[];
  symptoms: string[];
  action: WarningAction;
  notifiedEmails: string[];
  createdAt: number;
}

/** True when this session is backed by a Firebase account that can sync. */
export function isAccountSynced(user: AppUser | null): boolean {
  return currentMode() === "firebase" && Boolean(user) && !user!.isLocal;
}

function readLocalCaregivers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CAREGIVERS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeLocalCaregivers(emails: string[]): void {
  localStorage.setItem(CAREGIVERS_KEY, JSON.stringify(emails));
}

/**
 * Subscribes to the care circle. Calls back immediately with what is known and
 * again whenever it changes. Never rejects — a Firestore failure falls back to
 * the on-device list rather than leaving the screen empty.
 */
export function watchCaregivers(
  user: AppUser | null,
  cb: (emails: string[]) => void
): () => void {
  if (!user) {
    cb([]);
    return () => {};
  }
  if (!isAccountSynced(user)) {
    cb(readLocalCaregivers());
    return () => {};
  }

  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  (async () => {
    try {
      const { doc, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      if (cancelled) return;
      unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
        cb((snap.data()?.caregiverEmails as string[]) ?? []);
      });
    } catch {
      cb(readLocalCaregivers());
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** One-shot read, for flows that act once rather than render continuously. */
export async function listCaregivers(user: AppUser | null): Promise<string[]> {
  if (!user) return [];
  if (!isAccountSynced(user)) return readLocalCaregivers();
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../firebase");
    const snap = await getDoc(doc(db, "users", user.uid));
    return (snap.data()?.caregiverEmails as string[]) ?? [];
  } catch {
    return readLocalCaregivers();
  }
}

export async function addCaregiver(
  user: AppUser,
  email: string
): Promise<void> {
  const value = email.trim().toLowerCase();
  if (!value) return;
  if (isAccountSynced(user)) {
    const { addCaregiverEmail } = await import("./firestore");
    await addCaregiverEmail(user.uid, value);
    return;
  }
  writeLocalCaregivers([...new Set([...readLocalCaregivers(), value])]);
}

function readLocalAlerts(): CaregiverAlert[] {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) ?? "[]") as CaregiverAlert[];
  } catch {
    return [];
  }
}

/**
 * Records a check-in alert for the care circle.
 *
 * Returns the emails the alert was recorded against so the caller can tell the
 * patient exactly who can see it — including the empty case, where the honest
 * message is that nobody has been added yet.
 */
export async function recordCaregiverAlert(
  user: AppUser | null,
  alert: Omit<CaregiverAlert, "id" | "createdAt" | "notifiedEmails">
): Promise<CaregiverAlert> {
  const notifiedEmails = await listCaregivers(user);
  const record: CaregiverAlert = {
    ...alert,
    id: crypto.randomUUID(),
    notifiedEmails,
    createdAt: Date.now(),
  };

  if (user && isAccountSynced(user)) {
    try {
      const { addDoc, collection, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../firebase");
      await addDoc(collection(db, "users", user.uid, "alerts"), {
        documentId: record.documentId,
        warningIds: record.warningIds,
        symptoms: record.symptoms,
        action: record.action,
        notifiedEmails: record.notifiedEmails,
        createdAt: serverTimestamp(),
      });
      return record;
    } catch {
      /* fall through to the on-device log so the check-in is never lost */
    }
  }

  try {
    localStorage.setItem(
      ALERTS_KEY,
      JSON.stringify([record, ...readLocalAlerts()].slice(0, 50))
    );
  } catch {
    /* quota exceeded — the alert still surfaced on screen */
  }
  return record;
}

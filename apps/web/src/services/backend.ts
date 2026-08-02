/**
 * Typed client for the AfterCare Express API (apps/api).
 *
 * Contract mirrors docs/api-openapi.yaml:
 *   POST /auth/register | /auth/login   -> { user, accessToken, refreshToken }
 *   POST /upload           (multipart "document")
 *   GET  /process/:id      (Server-Sent Events)
 *   GET  /medications?documentId= | /appointments?documentId=
 *   POST /medications/:id/taken | /appointments/:id/calendar
 *   POST /ask              { question, documentId }
 *   GET|POST /accessibility/prefs
 *   GET  /documents/:id/original
 *
 * Note: the API authenticates from the Authorization header only, and the native
 * EventSource API cannot send headers — so /process is consumed with fetch +
 * a streaming reader rather than EventSource.
 */

import type {
  Appointment as PlanAppointment,
  Medication as PlanMedication,
  RecoveryPlan,
  TimelineEntry,
  WarningSign,
} from "@discharge-guide/shared-types";
import { apiBaseUrl } from "./config";
import type { Appointment, Medication, RecoveryData, TimelineEvent } from "../types";

const TOKEN_KEY = "aftercare:tokens";

export interface BackendUser {
  id: string;
  email: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

export function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens | null): void {
  try {
    if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

export function clearSession(): void {
  writeTokens(null);
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return body?.error ?? body?.message ?? `Request failed (${res.status})`;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const tokens = readTokens();
  if (!tokens) throw new SessionExpiredError();
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (res.status === 401) {
    clearSession();
    throw new SessionExpiredError();
  }
  return res;
}

/* ------------------------------- auth ------------------------------- */

async function credentials(path: "register" | "login", email: string, password: string) {
  const res = await fetch(`${apiBaseUrl}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as StoredTokens;
  writeTokens(body);
  return body.user;
}

export const backendRegister = (email: string, password: string) =>
  credentials("register", email, password);
export const backendLogin = (email: string, password: string) =>
  credentials("login", email, password);

/* ------------------------------ documents ---------------------------- */

export interface UploadResult {
  documentId: string;
  status: string;
  deduplicated: boolean;
}

export async function backendUpload(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("document", file);
  const res = await authedFetch("/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as UploadResult;
}

export function originalDocumentUrl(documentId: string): string {
  return `${apiBaseUrl}/documents/${documentId}/original`;
}

export interface ProcessEvent {
  stage: string;
  status?: string;
  plan?: RecoveryPlan;
  error?: { code: string; message: string; retryable: boolean };
}

/**
 * Streams pipeline progress. Calls `onEvent` per stage, then exactly one of
 * `onComplete` / `onFailed`. Returns an abort function.
 */
export function streamProcess(
  documentId: string,
  handlers: {
    onEvent?: (event: ProcessEvent) => void;
    onComplete?: (plan: RecoveryPlan) => void;
    onFailed?: (message: string) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await authedFetch(`/process/${documentId}`, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) {
        handlers.onFailed?.(await readError(res));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let split: number;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);

          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            // lines starting with ":" are heartbeats — ignored
          }
          if (dataLines.length === 0) continue;

          let payload: unknown = null;
          try {
            payload = JSON.parse(dataLines.join("\n"));
          } catch {
            continue;
          }

          if (eventName === "complete") {
            handlers.onComplete?.(payload as RecoveryPlan);
            return;
          }
          if (eventName === "failed") {
            const err = payload as { message?: string };
            handlers.onFailed?.(err.message ?? "Processing failed.");
            return;
          }
          handlers.onEvent?.({ stage: eventName, ...(payload as object) });
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      handlers.onFailed?.(err instanceof Error ? err.message : "Lost connection while processing.");
    }
  })();

  return () => controller.abort();
}

/* --------------------------- plan + actions -------------------------- */

export async function backendMedications(documentId: string): Promise<PlanMedication[]> {
  const res = await authedFetch(`/medications?documentId=${encodeURIComponent(documentId)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { data: PlanMedication[] }).data;
}

export async function backendAppointments(documentId: string): Promise<PlanAppointment[]> {
  const res = await authedFetch(`/appointments?documentId=${encodeURIComponent(documentId)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { data: PlanAppointment[] }).data;
}

export async function backendMarkTaken(medicationId: string): Promise<void> {
  const res = await authedFetch(`/medications/${medicationId}/taken`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
}

export async function backendAsk(documentId: string, question: string) {
  const res = await authedFetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, question }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { answer: string; confidence: number };
}

/* ------------------------------ mapping ------------------------------ */

function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}`, "i").test(haystack);
}

function splitTiming(timing: string, frequency: string) {
  const text = `${timing} ${frequency}`;
  const daily = /\bdaily\b|\bevery day\b|\bonce a day\b/i.test(text);
  const twice = /\btwice\b|\bbid\b|\b2x\b/i.test(text);
  const thrice = /\bthree times\b|\btid\b|\b3x\b/i.test(text);

  const morning = hasWord(text, "morning") || hasWord(text, "am") || daily || twice || thrice;
  const afternoon = hasWord(text, "afternoon") || hasWord(text, "noon") || thrice;
  const evening =
    hasWord(text, "evening") || hasWord(text, "night") || hasWord(text, "bedtime") || twice || thrice;

  // If nothing matched at all, don't claim a schedule we didn't find.
  return morning || afternoon || evening
    ? { morning, afternoon, evening }
    : { morning: false, afternoon: false, evening: false };
}

function splitDateTime(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: iso, time: "" };
  return {
    date: parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

const ACTION_TEXT: Record<WarningSign["action"], string> = {
  call_provider: "Call your provider",
  emergency_room: "Go to the emergency room",
  call_911: "Call emergency services",
};

function mapTimeline(entries: TimelineEntry[]): TimelineEvent[] {
  const today = new Date().setHours(0, 0, 0, 0);
  return entries.map((entry) => {
    let status: TimelineEvent["status"] = "upcoming";
    if (entry.date) {
      const when = new Date(entry.date).setHours(0, 0, 0, 0);
      if (!Number.isNaN(when)) status = when < today ? "done" : when === today ? "today" : "upcoming";
    }
    return {
      id: entry.id,
      label: entry.label,
      title: entry.label,
      description: entry.instructions,
      status,
    };
  });
}

/** Converts the API's RecoveryPlan into the shape the web screens render. */
export function planToRecoveryData(plan: RecoveryPlan): RecoveryData {
  const medications: Medication[] = plan.medications.map((med) => ({
    id: med.id,
    name: med.name,
    dose: med.dose,
    frequency: med.frequency,
    purpose: med.instructions,
    ...splitTiming(med.timing, med.frequency),
    foodInstructions: med.timing || undefined,
  }));

  const appointments: Appointment[] = plan.appointments.map((appt) => {
    const { date, time } = splitDateTime(appt.date);
    return {
      id: appt.id,
      providerName: appt.doctor,
      specialty: appt.specialty,
      location: appt.location,
      date,
      time,
      notes: appt.notes,
    };
  });

  return {
    documentId: plan.documentId,
    medications,
    appointments,
    timeline: mapTimeline(plan.timeline),
    glossary: [],
    faq: [],
    restrictions: [],
    redFlagSymptoms: plan.warnings.map((w) => `${w.symptom} — ${ACTION_TEXT[w.action]}`),
    updatedAt: Date.now(),
  };
}

/**
 * Client for the apps/api backend (upload/process/ask/appointments/medications routes,
 * see docs/api-openapi.yaml). That service is not implemented yet, so every export here
 * is a thin, honest wrapper: if VITE_API_BASE_URL isn't set, calls reject with
 * ApiNotConfiguredError instead of silently no-op'ing or returning fake data.
 *
 * Today, AfterCare's web app talks directly to Firebase (see firestore.ts / storage.ts)
 * for auth, document storage, and reading recovery data. Once apps/api exists, route
 * calls through here so the document-processing pipeline (OCR, extraction, medication/
 * appointment/warning detection) can run server-side instead.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const isApiConfigured = Boolean(BASE_URL);

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("The backend service isn't connected yet (VITE_API_BASE_URL is unset).");
    this.name = "ApiNotConfiguredError";
  }
}

async function request<T>(path: string, init: RequestInit, idToken: string): Promise<T> {
  if (!isApiConfigured) throw new ApiNotConfiguredError();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function askQuestion(idToken: string, documentId: string, question: string) {
  return request<{ answer: string; sourceLabel?: string }>(
    "/ask",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, question }) },
    idToken
  );
}

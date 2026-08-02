/**
 * Server-Sent Events client for live document-processing progress from apps/api's
 * /process route (see docs/api-openapi.yaml). Not implemented server-side yet.
 *
 * Until VITE_API_BASE_URL is set, watchProcessingProgress does nothing — the
 * Processing screen instead subscribes directly to the Firestore document's
 * `status` field (see firestore.ts: watchUserDocuments), which is the source of
 * truth today and stays that way even after a real backend pipeline exists.
 */

import { isApiConfigured } from "./api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export interface ProcessingEvent {
  stage: "ocr" | "extraction" | "medications" | "appointments" | "warnings" | "timeline" | "done";
  percent: number;
}

export function watchProcessingProgress(
  idToken: string,
  documentId: string,
  onEvent: (event: ProcessingEvent) => void
): () => void {
  if (!isApiConfigured) return () => {};

  const source = new EventSource(`${BASE_URL}/process/${documentId}/events?token=${encodeURIComponent(idToken)}`);
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as ProcessingEvent);
    } catch {
      // ignore malformed events
    }
  };
  return () => source.close();
}

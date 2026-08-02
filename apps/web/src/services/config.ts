/**
 * Runtime capability detection.
 *
 * AfterCare is designed to always load and always be usable. Nothing here ever
 * throws or blocks — each backing service is optional, and the app degrades to a
 * fully-functional local mode when none are configured.
 *
 * Modes, in priority order:
 *   "backend"  — the Express API (apps/api) answered /health. Full pipeline.
 *   "firebase" — Firebase env vars are present. Auth + Firestore + Storage.
 *   "local"    — no config at all. Everything is kept in this browser.
 */

export type DataMode = "backend" | "firebase" | "local";

const env = import.meta.env;

/** Same-origin `/api` by default, so server-side keys never need a VITE_ prefix
 *  (a VITE_ var is inlined into the client bundle and therefore public). */
export const apiBaseUrl = (env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

export const isFirebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
);

let resolvedMode: DataMode | null = null;
let detection: Promise<DataMode> | null = null;

async function probeBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "ok";
  } catch {
    return false;
  }
}

/** Resolves once per page load. Never rejects. */
export function detectMode(): Promise<DataMode> {
  if (resolvedMode) return Promise.resolve(resolvedMode);
  if (detection) return detection;

  detection = (async () => {
    const hasBackend = await probeBackend();
    resolvedMode = hasBackend ? "backend" : isFirebaseConfigured ? "firebase" : "local";
    return resolvedMode;
  })();

  return detection;
}

/** Synchronous best guess, for render paths that cannot await. */
export function currentMode(): DataMode {
  return resolvedMode ?? (isFirebaseConfigured ? "firebase" : "local");
}

export const modeLabel: Record<DataMode, string> = {
  backend: "Connected to the AfterCare service",
  firebase: "Synced to your account",
  local: "Saved on this device",
};

/** Read-aloud voice providers (optional; browser speech is the always-available default). */
export const ttsKeys = {
  elevenLabs: env.VITE_ELEVENLABS_API_KEY as string | undefined,
  elevenLabsVoiceId: env.VITE_ELEVENLABS_VOICE_ID as string | undefined,
  googleTts: env.VITE_GOOGLE_TTS_API_KEY as string | undefined,
};

/** Google Drive picker (optional). */
export const googleDriveKeys = {
  clientId: env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined,
  apiKey: env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined,
};

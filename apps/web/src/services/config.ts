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

async function probeBackend(timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "ok";
  } catch {
    return false;
  }
}

const upgradeListeners = new Set<() => void>();

/**
 * Fires if the backend turns out to be reachable *after* we already settled on a
 * lesser mode. Free-tier hosting sleeps when idle and takes 30-60s to wake, which
 * is far longer than a first page load should ever block on — so we settle fast,
 * keep knocking in the background, and upgrade if it answers.
 */
export function onBackendAvailable(listener: () => void): () => void {
  upgradeListeners.add(listener);
  return () => upgradeListeners.delete(listener);
}

/** Knocks with a long timeout, backing off, then gives up rather than looping forever. */
function retryWhileWaking(): void {
  const delays = [3_000, 8_000, 15_000, 25_000, 40_000];
  let attempt = 0;

  const knock = async () => {
    if (resolvedMode === "backend") return;
    if (attempt >= delays.length) return;
    const wait = delays[attempt];
    attempt += 1;
    setTimeout(async () => {
      if (resolvedMode === "backend") return;
      // A waking instance can sit on the connection, so allow far more headroom
      // here than the initial probe gets.
      if (await probeBackend(30_000)) {
        resolvedMode = "backend";
        upgradeListeners.forEach((listener) => listener());
        return;
      }
      void knock();
    }, wait);
  };

  void knock();
}

/** Resolves once per page load. Never rejects. */
export function detectMode(): Promise<DataMode> {
  if (resolvedMode) return Promise.resolve(resolvedMode);
  if (detection) return detection;

  detection = (async () => {
    // Deliberately short: this gates first paint, so a sleeping backend must not
    // hold the page hostage. `retryWhileWaking` recovers the slow case.
    const hasBackend = await probeBackend(4_000);
    resolvedMode = hasBackend ? "backend" : isFirebaseConfigured ? "firebase" : "local";
    if (!hasBackend) retryWhileWaking();
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

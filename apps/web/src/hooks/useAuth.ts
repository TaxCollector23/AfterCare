import { useEffect, useSyncExternalStore } from "react";
import { detectMode, onBackendAvailable, type DataMode } from "../services/config";
import { resolveUser, requiresSignIn, type AppUser } from "../services/session";

interface AuthState {
  mode: DataMode | null;
  user: AppUser | null;
  loading: boolean;
}

// Module-level store so every useAuth() consumer sees the same session. Without
// this, signing in would only update the component that submitted the form.
let state: AuthState = { mode: null, user: null, loading: true };
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(): Promise<void> {
  const mode = await detectMode();
  const user = await resolveUser(mode);
  setState({ mode, user, loading: false });
}

let started: Promise<void> | null = null;
function start(): Promise<void> {
  if (!started) started = load();
  return started;
}

// If the backend was merely asleep rather than absent, re-resolve the session so
// the app moves out of local mode on its own instead of needing a manual reload.
onBackendAvailable(() => {
  void load();
});

/** Re-reads the session — call after sign-in / sign-out. */
export async function refreshAuth(): Promise<void> {
  await load();
}

export function useAuth() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );

  useEffect(() => {
    void start();
  }, []);

  return {
    user: snapshot.user,
    mode: snapshot.mode,
    loading: snapshot.loading,
    /** True when this deployment expects a sign-in and none has happened yet. */
    needsSignIn:
      snapshot.mode !== null && requiresSignIn(snapshot.mode) && snapshot.user === null,
    refresh: refreshAuth,
  };
}

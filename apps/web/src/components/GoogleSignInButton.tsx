import { useEffect, useRef, useState } from "react";
import { useAccessibility } from "../hooks/useAccessibility";
import { useAuth } from "../hooks/useAuth";
import { currentMode } from "../services/config";
import {
  isGoogleSignInAvailable,
  renderGoogleButton,
  signInWithGooglePopup,
} from "../services/googleSignIn";
import { friendlySessionError, signInWithGoogle } from "../services/session";

/**
 * The primary way in.
 *
 * Renders nothing when Google sign-in isn't configured for the current mode,
 * so the form falls back to email and password rather than offering a button
 * that can't work.
 */
export function GoogleSignInButton({ onError }: { onError?: (message: string) => void }) {
  const { refresh } = useAuth();
  const { darkMode } = useAccessibility();
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Google's callback outlives the render that registered it, so the handler
  // is read from a ref to avoid calling a stale `onError` from a past render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const mode = currentMode();
  const available = isGoogleSignInAvailable();

  async function complete(idToken?: string) {
    setBusy(true);
    try {
      await signInWithGoogle(idToken);
      await refresh();
    } catch (err) {
      onErrorRef.current?.(friendlySessionError(err));
    } finally {
      setBusy(false);
    }
  }

  const completeRef = useRef(complete);
  completeRef.current = complete;

  // Google's own button element is what mints the ID token, so in backend mode
  // it has to be rendered by their script rather than styled by us.
  useEffect(() => {
    if (!available || mode !== "backend" || !containerRef.current) return;
    let cancelled = false;
    renderGoogleButton(
      containerRef.current,
      (idToken) => {
        if (!cancelled) void completeRef.current(idToken);
      },
      { dark: darkMode },
    ).catch((err) => {
      if (cancelled) return;
      // Google's script is blocked or unreachable — say so and leave the
      // email fallback in place instead of showing an empty gap.
      setUnavailable(true);
      onErrorRef.current?.(friendlySessionError(err));
    });
    return () => {
      cancelled = true;
    };
  }, [available, mode, darkMode]);

  if (!available || unavailable) return null;

  if (mode === "backend") {
    return (
      <div>
        <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />
        {busy && (
          <p className="gloss" style={{ textAlign: "center", marginTop: 8 }}>
            <span className="spinner" style={{ marginRight: 8 }} />
            Signing you in…
          </p>
        )}
      </div>
    );
  }

  // Firebase mode: a popup, so an ordinary button is fine.
  return (
    <button
      className="btn btn-outline btn-block btn-lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signInWithGooglePopup();
          await complete();
        } catch (err) {
          onError?.(friendlySessionError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <span className="spinner" style={{ marginRight: 8 }} />}
      Continue with Google
    </button>
  );
}

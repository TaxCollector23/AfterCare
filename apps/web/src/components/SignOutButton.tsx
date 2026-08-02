import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { signOut } from "../services/session";

/**
 * Ends the session and returns to the homepage.
 *
 * Renders nothing in local mode: there is no account to sign out of when the
 * app is running entirely on-device, and a button that silently did nothing
 * would be worse than its absence.
 */
export function SignOutButton({ className = "btn btn-outline" }: { className?: string }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.isLocal) return null;

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      // Caught rather than left to reject: an unhandled failure would leave the
      // user still signed in with nothing on screen explaining why.
      setError(
        err instanceof Error ? err.message : "Couldn't sign you out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className={className} onClick={handleSignOut} disabled={busy}>
        {busy && <span className="spinner" style={{ marginRight: 8 }} />}
        <i className="ph-duotone ph-sign-out" aria-hidden="true" /> Sign out
      </button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

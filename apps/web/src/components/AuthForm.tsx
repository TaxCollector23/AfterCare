import { useState } from "react";
import { friendlyAuthError, resetPassword, signIn, signUp } from "../services/auth";
import { isFirebaseConfigured } from "../firebase";

type Mode = "signin" | "signup";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isFirebaseConfigured) {
    return (
      <div className="banner warn" role="alert">
        <i className="ph-duotone ph-plugs-connected" aria-hidden="true" /> AfterCare isn't connected to a
        Firebase project yet. Add your project's keys to <code>apps/web/.env.local</code> (see{" "}
        <code>.env.example</code>) and reload this page.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap “Forgot password” again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      setInfo("Check your email for a link to reset your password.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <div className="auth-toggle" role="tablist">
        <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
          Sign in
        </button>
        <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            <i className="ph-duotone ph-warning-circle" aria-hidden="true" /> {error}
          </p>
        )}
        {info && (
          <p className="gloss" role="status" style={{ color: "var(--a700)" }}>
            <i className="ph-duotone ph-check-circle" aria-hidden="true" /> {info}
          </p>
        )}

        <button type="submit" className="btn btn-solid btn-block btn-lg" disabled={busy} style={{ marginTop: 8 }}>
          {busy && <span className="spinner" style={{ marginRight: 8 }} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {mode === "signin" && (
          <button type="button" className="btn-ghost" style={{ marginTop: 12, display: "block", width: "100%", textAlign: "center" }} onClick={handleForgotPassword} disabled={busy}>
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}

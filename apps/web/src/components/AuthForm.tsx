import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { friendlySessionError, signIn, signUp } from "../services/session";

type Mode = "signin" | "signup";

export function AuthForm() {
  const { mode: dataMode, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The API requires 12+ characters; Firebase accepts 6. Ask for whatever the
  // active backing service will actually accept.
  const minLength = dataMode === "backend" ? 12 : 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < minLength) {
      setError(`Please use a password of at least ${minLength} characters.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password);
      await refresh();
    } catch (err) {
      setError(friendlySessionError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <div className="auth-toggle" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "active" : ""}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
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
            minLength={minLength}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="gloss" style={{ fontSize: 14 }}>
            At least {minLength} characters.
          </span>
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-solid btn-block btn-lg"
          disabled={busy}
          style={{ marginTop: 8 }}
        >
          {busy && <span className="spinner" style={{ marginRight: 8 }} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

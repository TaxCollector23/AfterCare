import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { currentMode } from "../../services/config";

const LOCAL_KEY = "aftercare:caregivers";

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export default function CaregiverMode() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [caregivers, setCaregivers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const syncedToAccount = currentMode() === "firebase" && user && !user.isLocal;

  useEffect(() => {
    if (!user) return;
    if (!syncedToAccount) {
      setCaregivers(readLocal());
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("../../firebase");
        if (cancelled) return;
        unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
          setCaregivers((snap.data()?.caregiverEmails as string[]) ?? []);
        });
      } catch {
        setCaregivers(readLocal());
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, syncedToAccount]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!user || !value) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (syncedToAccount) {
        const { addCaregiverEmail } = await import("../../services/firestore");
        await addCaregiverEmail(user.uid, value);
      } else {
        const next = Array.from(new Set([...readLocal(), value]));
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setCaregivers(next);
      }
      setInfo(`${value} was added to your care circle.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Caregiver access</h1>
      <p className="gloss measure">
        Keep track of the family members and caregivers helping with your recovery.
        {syncedToAccount
          ? " They can sign in with the same email to view this guide."
          : " This list is kept on this device."}
      </p>

      <form onSubmit={handleAdd} className="card" style={{ marginBottom: "var(--sp4)" }}>
        <div className="field">
          <label htmlFor="caregiver-email">Caregiver&rsquo;s email</label>
          <input
            id="caregiver-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        {info && (
          <p className="gloss" style={{ color: "var(--a700)" }}>
            {info}
          </p>
        )}
        <button className="btn btn-solid" disabled={busy}>
          {busy && <span className="spinner" style={{ marginRight: 8 }} />}
          Add caregiver
        </button>
      </form>

      <h2>Your care circle</h2>
      {caregivers.length === 0 ? (
        <p className="gloss">No one added yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {caregivers.map((c) => (
            <li key={c} className="list-row">
              <i className="ph-duotone ph-user-circle" aria-hidden="true" /> {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

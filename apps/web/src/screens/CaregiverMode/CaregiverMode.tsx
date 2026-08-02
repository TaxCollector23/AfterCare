import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { addCaregiverEmail } from "../../services/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useEffect } from "react";

export default function CaregiverMode() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [caregivers, setCaregivers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setCaregivers((snap.data()?.caregiverEmails as string[]) ?? []);
    });
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await addCaregiverEmail(user.uid, email.trim());
      setInfo(`${email.trim()} can now sign in and view this recovery guide as read-only.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that caregiver.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Caregiver access</h1>
      <p className="gloss measure">
        Share read-only access to this recovery guide with a family member or caregiver. They'll need to
        create their own AfterCare account with the same email address to view it.
      </p>

      <form onSubmit={handleAdd} className="card" style={{ marginBottom: "var(--sp4)" }}>
        <div className="field">
          <label htmlFor="caregiver-email">Caregiver's email</label>
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
          Grant access
        </button>
      </form>

      <h2>People with access</h2>
      {caregivers.length === 0 ? (
        <p className="gloss">Only you can see this recovery guide right now.</p>
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

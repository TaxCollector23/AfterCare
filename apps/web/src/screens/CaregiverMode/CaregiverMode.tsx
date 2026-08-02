import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  addCaregiver,
  isAccountSynced,
  listCaregivers,
  watchCaregivers,
} from "../../services/caregivers";

export default function CaregiverMode() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [caregivers, setCaregivers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const syncedToAccount = isAccountSynced(user);

  useEffect(() => watchCaregivers(user, setCaregivers), [user, syncedToAccount]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!user || !value) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await addCaregiver(user, value);
      // The synced path re-renders from its Firestore subscription; the
      // on-device path has no watcher, so re-read it here.
      if (!syncedToAccount) setCaregivers(await listCaregivers(user));
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

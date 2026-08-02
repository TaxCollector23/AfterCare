import { useState } from "react";
import {
  ACTION_INSTRUCTION,
  evaluateCheckIn,
  type WarningSign,
} from "@discharge-guide/shared-types";
import { useAuth } from "../../hooks/useAuth";
import { recordCaregiverAlert, type CaregiverAlert } from "../../services/caregivers";
import { ErrorBanner } from "../../components/ErrorBanner";

/**
 * Symptom check-in.
 *
 * The patient can only tick warning signs their own document listed, and the
 * response is the action that document prescribed for them. Nothing is
 * predicted: there is no free-text symptom box and no model call here, so the
 * screen can never tell a patient something their paperwork didn't say.
 */
export function SymptomCheckIn({
  documentId,
  warnings,
}: {
  documentId: string;
  warnings: WarningSign[];
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<CaregiverAlert | null>(null);
  const [result, setResult] = useState<ReturnType<
    typeof evaluateCheckIn<WarningSign>
  > | null>(null);

  // No warning signs were extracted from this document — offering a check-in
  // with nothing to check would invite free-text symptom entry, which is
  // exactly what this feature must not do.
  if (warnings.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
    setResult(null);
    setAlert(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const outcome = evaluateCheckIn(warnings, selected);
    setResult(outcome);
    setAlert(null);
    setError(null);
    if (!outcome.shouldAlertCaregivers || outcome.highestAction === null) return;

    setBusy(true);
    try {
      setAlert(
        await recordCaregiverAlert(user, {
          documentId,
          warningIds: outcome.matched.map((w) => w.id),
          symptoms: outcome.matched.map((w) => w.symptom),
          action: outcome.highestAction,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't alert your care circle. Follow the instruction above now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="divider-section">
      <h2>How are you feeling?</h2>
      <p className="gloss measure">
        Tick anything you have right now. These are the warning signs listed in
        your own document.
      </p>

      <form onSubmit={handleSubmit} className="card">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {warnings.map((warning) => (
            <li key={warning.id} className="list-row">
              <input
                id={`symptom-${warning.id}`}
                type="checkbox"
                checked={selected.includes(warning.id)}
                onChange={() => toggle(warning.id)}
                style={{ marginTop: 4 }}
              />
              <label htmlFor={`symptom-${warning.id}`} style={{ flex: 1, cursor: "pointer" }}>
                {warning.symptom}
              </label>
            </li>
          ))}
        </ul>

        <button
          className="btn btn-solid"
          style={{ marginTop: "var(--sp4)" }}
          disabled={busy || selected.length === 0}
        >
          {busy && <span className="spinner" style={{ marginRight: 8 }} />}
          Check my symptoms
        </button>
      </form>

      {result && <CheckInOutcome result={result} alert={alert} />}
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </section>
  );
}

function CheckInOutcome({
  result,
  alert,
}: {
  result: ReturnType<typeof evaluateCheckIn<WarningSign>>;
  alert: CaregiverAlert | null;
}) {
  if (result.matched.length === 0 || result.highestAction === null) {
    return (
      <p className="gloss" style={{ marginTop: "var(--sp3)" }}>
        Nothing selected. If something feels wrong that isn&rsquo;t listed here,
        contact your care team.
      </p>
    );
  }

  const urgent = result.shouldAlertCaregivers;
  const drivingSymptoms = result.driving.map((w) => w.symptom);

  return (
    <div
      className={`banner ${urgent ? "error" : "warn"}`}
      role={urgent ? "alert" : "status"}
    >
      <strong>{ACTION_INSTRUCTION[result.highestAction]}.</strong>{" "}
      <span>
        Your document lists {drivingSymptoms.join(", ")} as a reason to do this.
      </span>
      {urgent && (
        <p style={{ margin: "8px 0 0" }}>
          {alert === null
            ? "Alerting your care circle…"
            : alert.notifiedEmails.length > 0
              ? `Your care circle has been alerted: ${alert.notifiedEmails.join(", ")}.`
              : "No one is in your care circle yet, so nobody was alerted. You can add someone from Caregiver Access."}
        </p>
      )}
    </div>
  );
}

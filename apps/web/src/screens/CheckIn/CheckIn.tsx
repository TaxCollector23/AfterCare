import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CHECK_IN_QUESTIONS,
  LEVEL_LABEL,
  LEVEL_TAG_CLASS,
  drivingQuestions,
  isCheckInComplete,
  shouldAlertCaregivers,
  type CheckInAnswers,
  type CheckInLevel,
  type CheckInRecord,
} from "@discharge-guide/shared-types";
import { RecoveryGate } from "../../components/RecoveryGate";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useAuth } from "../../hooks/useAuth";
import {
  acknowledgeCheckIn,
  checkInsFor,
  subscribeCheckIns,
  submitCheckIn,
} from "../../services/checkIns";
import type { RecoveryData } from "../../types";

export default function CheckIn() {
  return (
    <div>
      <h1>Daily check-in</h1>
      <p className="gloss measure">
        Three quick questions about how you&rsquo;re doing today. Your answers
        are exactly what gets recorded &mdash; nothing is inferred from them.
      </p>

      <RecoveryGate
        emptyState={{
          icon: "ph-traffic-signal",
          title: "No check-ins yet",
          description:
            "Once your document is processed, you can record how you're doing each day here.",
        }}
      >
        {(data) => <CheckInForm data={data} />}
      </RecoveryGate>
    </div>
  );
}

function CheckInForm({ data }: { data: RecoveryData }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<CheckInAnswers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CheckInRecord | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => subscribeCheckIns(() => setTick((n) => n + 1)), []);

  const history = checkInsFor(data.documentId);
  const complete = isCheckInComplete(answers);

  function pick(questionId: string, level: CheckInLevel) {
    setAnswers((prev) => ({ ...prev, [questionId]: level }));
    setSaved(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      setSaved(await submitCheckIn(user, data.documentId, answers));
      setAnswers({});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save that check-in.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {CHECK_IN_QUESTIONS.map((question) => (
          <fieldset
            key={question.id}
            className="card divider-section"
            style={{ border: "1px solid var(--color-divider)" }}
          >
            <legend style={{ fontWeight: 600, padding: "0 6px" }}>
              {question.prompt}
            </legend>
            <div
              className="flex"
              style={{ flexWrap: "wrap", marginTop: "var(--sp2)" }}
            >
              {question.options.map((option) => {
                const selected = answers[question.id] === option.level;
                return (
                  <button
                    key={option.level}
                    type="button"
                    className={`chip ${selected ? "active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => pick(question.id, option.level)}
                    style={{ textAlign: "left", minHeight: 44 }}
                  >
                    <span
                      className={`level-dot ${option.level}`}
                      style={{ marginRight: 8 }}
                      aria-hidden="true"
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <button className="btn btn-solid btn-lg" disabled={busy || !complete}>
          {busy && <span className="spinner" style={{ marginRight: 8 }} />}
          Save today&rsquo;s check-in
        </button>
        {!complete && (
          <p className="gloss" style={{ fontSize: 15, marginTop: 8 }}>
            Answer all three questions to save.
          </p>
        )}
      </form>

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {saved && <CheckInOutcome record={saved} />}

      <CheckInHistory history={history} />
    </div>
  );
}

function CheckInOutcome({ record }: { record: CheckInRecord }) {
  const alerted = shouldAlertCaregivers(record.overall);
  const driving = drivingQuestions(record.answers);

  if (!alerted) {
    return (
      <div className="banner info" role="status">
        <strong>Check-in saved.</strong> You reported everything as going well
        today.
      </div>
    );
  }

  return (
    <div
      className={`banner ${record.overall === "red" ? "error" : "warn"}`}
      role="alert"
    >
      <strong>Check-in saved: {LEVEL_LABEL[record.overall]}.</strong>{" "}
      <span>You told us about {driving.map((q) => q.subject).join(", ")}.</span>
      <p style={{ margin: "8px 0 0" }}>
        {record.notifiedEmails.length > 0
          ? `Your care circle has been told: ${record.notifiedEmails.join(", ")}.`
          : "No one is in your care circle yet, so nobody was told. You can add someone from Caregiver Access."}
      </p>
      <p style={{ margin: "8px 0 0" }}>
        If this is an emergency, follow the advice on{" "}
        <Link to="/emergency">When to get help</Link>.
      </p>
    </div>
  );
}

function CheckInHistory({ history }: { history: CheckInRecord[] }) {
  if (history.length === 0) {
    return (
      <section className="divider-section">
        <h2>Your check-in history</h2>
        <EmptyState
          icon="ph-traffic-signal"
          title="No check-ins recorded yet"
          description="Once you save a check-in, your recent days will be listed here."
        />
      </section>
    );
  }

  return (
    <section className="divider-section">
      <h2>Your check-in history</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {history.map((record) => (
          <li key={record.id} className="list-row">
            <span className={`tag ${LEVEL_TAG_CLASS[record.overall]}`}>
              {LEVEL_LABEL[record.overall]}
            </span>
            <div style={{ flex: 1 }}>
              <p className="gloss" style={{ margin: 0 }}>
                {new Date(record.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {record.overall !== "green" && (
                <p className="gloss" style={{ margin: 0, fontSize: 15 }}>
                  {record.acknowledgedAt ? (
                    "Marked as dealt with."
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => acknowledgeCheckIn(record.id)}
                    >
                      Mark as dealt with
                    </button>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

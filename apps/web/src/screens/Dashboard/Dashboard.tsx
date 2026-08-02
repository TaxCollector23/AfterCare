import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { assessFollowUp } from "@discharge-guide/shared-types";
import { RecoveryGate } from "../../components/RecoveryGate";
import { Card } from "../../components/Cards/Card";
import { ConditionCard } from "../../components/ConditionCard";
import { FollowUpBadge } from "../../components/FollowUpBadge";
import { SignOutButton } from "../../components/SignOutButton";
import { dosesFor, mergeTakenAt, subscribeDoses } from "../../services/adherence";
import { checkInsFor, subscribeCheckIns } from "../../services/checkIns";
import type { RecoveryData } from "../../types";

function FollowUpSummary({ data }: { data: RecoveryData }) {
  // Both logs live outside the guide, so re-render when either changes.
  const [, setTick] = useState(0);
  useEffect(() => subscribeDoses(() => setTick((n) => n + 1)), []);
  useEffect(() => subscribeCheckIns(() => setTick((n) => n + 1)), []);

  const logged = dosesFor(data.documentId);
  const assessment = assessFollowUp({
    medications: data.medications.map((med) => ({
      timing: med.timing,
      frequency: med.frequency,
      takenAt: mergeTakenAt(med.takenAt, logged[med.id]),
    })),
    checkIns: checkInsFor(data.documentId),
    appointments: data.appointments.map((appt) => ({ isoDate: appt.isoDate })),
    processedAt: data.processedAt ?? data.updatedAt,
  });

  return <FollowUpBadge assessment={assessment} />;
}

export default function Dashboard() {
  return (
    <div>
      <h1>Your recovery guide</h1>
      <p className="gloss measure">
        A clear view of the care details found in your active document. Nothing
        here is guessed.
      </p>

      <RecoveryGate>
        {(data) => (
          <>
            <FollowUpSummary data={data} />
            <ConditionCard glossary={data.glossary} />

            <Card title="Restrictions" icon="ph-shield-warning">
              {data.restrictions.length === 0 ? (
                <p className="gloss">
                  No activity restrictions were found in your document.
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.restrictions.map((r) => (
                    <li key={r.id} className="list-row">
                      <i className="ph-duotone ph-check" aria-hidden="true" />
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Medications" icon="ph-pill">
              {data.medications.length === 0 ? (
                <p className="gloss">
                  No medications were found in your document.
                </p>
              ) : (
                <p className="gloss">
                  {data.medications.length} medication
                  {data.medications.length === 1 ? "" : "s"} found.{" "}
                  <Link to="/medications" className="btn-ghost">
                    View details →
                  </Link>
                </p>
              )}
            </Card>

            <Card title="Upcoming appointments" icon="ph-calendar-check">
              {data.appointments.length === 0 ? (
                <p className="gloss">
                  No appointments were found in your document.
                </p>
              ) : (
                <p className="gloss">
                  {data.appointments.length} appointment
                  {data.appointments.length === 1 ? "" : "s"} on file.{" "}
                  <Link to="/appointments" className="btn-ghost">
                    View details →
                  </Link>
                </p>
              )}
            </Card>

            <Card title="When to get help" icon="ph-first-aid-kit">
              <Link to="/emergency" className="btn-ghost">
                Review your warning signs →
              </Link>
            </Card>
          </>
        )}
      </RecoveryGate>

      {/* Outside the gate on purpose: signing out must work even when there is
          no document yet and the gate is showing its empty state. */}
      <div
        className="divider-section"
        style={{ marginTop: "var(--sp6)", paddingTop: "var(--sp4)", borderTop: "1px solid var(--color-divider)" }}
      >
        <SignOutButton />
      </div>
    </div>
  );
}

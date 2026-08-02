import { Link } from "react-router-dom";
import { RecoveryGate } from "../../components/RecoveryGate";
import { Card } from "../../components/Cards/Card";

export default function Dashboard() {
  return (
    <div>
      <h1>Your recovery guide</h1>
      <p className="gloss measure">Everything below comes directly from the paperwork you provided.</p>

      <RecoveryGate>
        {(data) => (
          <>
            <Card title="Restrictions" icon="ph-shield-warning">
              {data.restrictions.length === 0 ? (
                <p className="gloss">No activity restrictions were found in your document.</p>
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
                <p className="gloss">No medications were found in your document.</p>
              ) : (
                <p className="gloss">
                  {data.medications.length} medication{data.medications.length === 1 ? "" : "s"} found.{" "}
                  <Link to="/medications" className="btn-ghost">
                    View details →
                  </Link>
                </p>
              )}
            </Card>

            <Card title="Upcoming appointments" icon="ph-calendar-check">
              {data.appointments.length === 0 ? (
                <p className="gloss">No appointments were found in your document.</p>
              ) : (
                <p className="gloss">
                  {data.appointments.length} appointment{data.appointments.length === 1 ? "" : "s"} on file.{" "}
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
    </div>
  );
}

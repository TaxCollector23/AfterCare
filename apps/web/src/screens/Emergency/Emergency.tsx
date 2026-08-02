import { RecoveryGate } from "../../components/RecoveryGate";

export default function Emergency() {
  return (
    <div>
      <h1>When to get help</h1>
      <p className="gloss measure">
        Warning signs below are drawn from your own document. This is informational only — if you are
        experiencing a medical emergency, contact emergency services in your area right away.
      </p>

      <RecoveryGate>
        {(data) =>
          data.redFlagSymptoms.length === 0 ? (
            <p className="gloss">Your document didn't list specific warning signs. When in doubt, contact your care team.</p>
          ) : (
            <div className="card">
              <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
                {data.redFlagSymptoms.map((s, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </RecoveryGate>

      <p className="gloss" style={{ marginTop: "var(--sp4)" }}>
        For anything on this list, or anything that feels seriously wrong, call your local emergency number
        or go to the nearest emergency department. Your care team's contact information is in the paperwork
        you provided.
      </p>
    </div>
  );
}

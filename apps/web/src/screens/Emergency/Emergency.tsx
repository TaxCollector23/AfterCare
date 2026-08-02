import { RecoveryGate } from "../../components/RecoveryGate";

export default function Emergency() {
  return (
    <div>
      <h1>When to get help</h1>
      <p className="gloss measure">
        Signs to watch for, pulled from your own document.
      </p>

      <RecoveryGate
        emptyState={{
          icon: "ph-first-aid-kit",
          title: "No document-specific warning signs yet",
          description:
            "Warning signs from your active recovery guide will appear here. For an emergency, call your local emergency number.",
        }}
      >
        {(data) =>
          data.redFlagSymptoms.length === 0 ? (
            <p className="gloss">
              Your document didn't list specific warning signs.
            </p>
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
    </div>
  );
}

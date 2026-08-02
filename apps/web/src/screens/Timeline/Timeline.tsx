import { RecoveryGate } from "../../components/RecoveryGate";
import { EmptyState } from "../../components/EmptyState";

export default function Timeline() {
  return (
    <div>
      <h1>Recovery timeline</h1>
      <p className="gloss measure">
        See milestones and follow-up steps from your active recovery guide in
        order.
      </p>
      <RecoveryGate
        emptyState={{
          icon: "ph-clock-counter-clockwise",
          title: "No recovery timeline yet",
          description:
            "Milestones and follow-up steps from your active recovery guide will appear here in order.",
        }}
      >
        {(data) =>
          data.timeline.length === 0 ? (
            <EmptyState
              icon="ph-clock-counter-clockwise"
              title="No timeline yet"
              description="Your document didn't include enough milestone information to build a timeline."
            />
          ) : (
            <div>
              {data.timeline.map((t) => (
                <div key={t.id} className="list-row">
                  <span
                    className="status-dot"
                    style={{
                      marginTop: 6,
                      background:
                        t.status === "done"
                          ? "var(--color-accent)"
                          : t.status === "today"
                            ? "var(--color-accent-2)"
                            : "var(--n400)",
                    }}
                  />
                  <div>
                    <p
                      className="gloss"
                      style={{
                        marginBottom: 2,
                        textTransform: "uppercase",
                        fontSize: 13,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {t.label}
                    </p>
                    <h3>{t.title}</h3>
                    <p className="gloss">{t.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </RecoveryGate>
    </div>
  );
}

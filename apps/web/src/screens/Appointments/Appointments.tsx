import { RecoveryGate } from "../../components/RecoveryGate";
import { EmptyState } from "../../components/EmptyState";

export default function Appointments() {
  return (
    <div>
      <h1>Appointments</h1>
      <p className="gloss measure">
        Keep follow-up dates, providers, and locations together.
      </p>
      <RecoveryGate
        emptyState={{
          icon: "ph-calendar-check",
          title: "No appointments to show",
          description:
            "Follow-up visits from your active recovery guide will appear here with their dates and locations.",
        }}
      >
        {(data) =>
          data.appointments.length === 0 ? (
            <EmptyState
              icon="ph-calendar-check"
              title="No appointments found"
              description="Your document didn't list any follow-up visits."
            />
          ) : (
            <>
              {data.appointments.map((a) => (
                <div key={a.id} className="card divider-section">
                  <h3>{a.providerName}</h3>
                  {a.specialty && <p className="gloss">{a.specialty}</p>}
                  <p className="gloss">
                    <i className="ph-duotone ph-clock" aria-hidden="true" />{" "}
                    {a.date} at {a.time}
                  </p>
                  {a.location && (
                    <p className="gloss">
                      <i className="ph-duotone ph-map-pin" aria-hidden="true" />{" "}
                      {a.location}
                      {a.address ? ` — ${a.address}` : ""}
                    </p>
                  )}
                  {a.notes && <p className="gloss">{a.notes}</p>}
                </div>
              ))}
            </>
          )
        }
      </RecoveryGate>
    </div>
  );
}

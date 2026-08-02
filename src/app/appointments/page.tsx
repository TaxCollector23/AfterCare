import { CalendarDays, MapPin, CalendarPlus, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appointments } from "@/lib/data";

export default function AppointmentsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
          <CalendarDays className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-h1">Appointments</h1>
          <p className="text-body text-(--color-text-secondary)">Your upcoming follow-up visits</p>
        </div>
      </header>

      {appointments.length === 0 ? (
        <EmptyAppointments />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {appointments.map((a, i) => (
            <Card key={a.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-h3">{a.doctor}</p>
                  <p className="text-small text-(--color-text-secondary)">{a.specialty}</p>
                </div>
                {i === 0 && (
                  <span className="shrink-0 rounded-full bg-(--color-blue-tint) px-3 py-1 text-small font-semibold text-(--color-blue-dark)">
                    Next up
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2.5 text-small text-(--color-text-secondary)">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {a.clinic}
                  <br />
                  {a.address}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-small text-(--color-text-secondary)">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {a.date} at {a.time}
              </div>
              <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="secondary" size="sm" className="flex-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Directions
                </Button>
                <Button variant="secondary" size="sm" className="flex-1">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add to Calendar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyAppointments() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-(--color-border-strong) py-24 text-center">
      <CalendarDays className="h-12 w-12 text-(--color-text-tertiary)" aria-hidden="true" />
      <p className="text-h3">No appointments scheduled</p>
      <p className="text-body text-(--color-text-secondary) max-w-sm">
        When your care team schedules a follow-up visit, it will appear here automatically.
      </p>
    </div>
  );
}

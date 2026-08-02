import { MapPin, CalendarPlus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appointments } from "@/lib/data";

export function AppointmentCard() {
  const next = appointments[0];

  if (!next) {
    return (
      <Card className="h-full flex flex-col items-center justify-center text-center gap-3 py-10">
        <CalendarIcon className="h-10 w-10 text-(--color-text-tertiary)" aria-hidden="true" />
        <p className="text-body font-medium">No upcoming appointments</p>
        <p className="text-small text-(--color-text-secondary)">We&rsquo;ll show your next visit here once it&rsquo;s scheduled.</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col gap-4">
      <CardHeader className="mb-0">
        <CardTitle>Next Appointment</CardTitle>
      </CardHeader>
      <div>
        <p className="text-body font-semibold text-(--color-text-primary)">{next.doctor}</p>
        <p className="text-small text-(--color-text-secondary)">{next.specialty}</p>
      </div>
      <div className="flex items-start gap-2.5 text-small text-(--color-text-secondary)">
        <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          {next.clinic}
          <br />
          {next.address}
        </span>
      </div>
      <div className="flex items-center gap-2.5 text-small text-(--color-text-secondary)">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        {next.date} at {next.time}
      </div>
      <div className="mt-auto flex flex-col sm:flex-row gap-3">
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
  );
}

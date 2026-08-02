import { Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { timeline } from "@/lib/data";
import { cn } from "@/lib/utils";

export function RecoveryTimeline() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recovery Timeline</CardTitle>
          <CardDescription>Your path from surgery to full recovery</CardDescription>
        </div>
      </CardHeader>
      <ol className="relative flex flex-col gap-8 pl-2" role="list">
        <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-(--color-border)" aria-hidden="true" />
        {timeline.map((event) => (
          <li key={event.id} className="relative flex gap-5">
            <span
              className={cn(
                "relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-(--color-surface) text-small font-bold",
                event.status === "done" && "bg-(--color-green) text-white",
                event.status === "current" && "bg-(--color-blue) text-white ring-4 ring-(--color-blue-tint)",
                event.status === "upcoming" && "bg-(--color-bg) text-(--color-text-tertiary) border-2 border-dashed border-(--color-border-strong)"
              )}
            >
              {event.status === "done" ? <Check className="h-6 w-6" aria-hidden="true" /> : event.day.replace("Day ", "")}
            </span>
            <div className="pt-1.5">
              <p className="text-small font-semibold text-(--color-text-tertiary) uppercase tracking-wide">
                {event.day}
                {event.status === "current" && " · Today"}
              </p>
              <p className="text-h3 mt-0.5">{event.title}</p>
              <p className="text-body text-(--color-text-secondary) mt-1">{event.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

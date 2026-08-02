"use client";

import * as React from "react";
import { Pill, UtensilsCrossed, AlertTriangle, RefreshCw, ChevronDown, Check, Sun, Sunset, MoonStar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/components/medications/countdown";
import type { Medication } from "@/lib/data";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, { tint: string; text: string; solid: string }> = {
  blue: { tint: "bg-(--color-blue-tint)", text: "text-(--color-blue-dark)", solid: "bg-(--color-blue)" },
  amber: { tint: "bg-(--color-amber-tint)", text: "text-(--color-amber-dark)", solid: "bg-(--color-amber)" },
  green: { tint: "bg-(--color-green-tint)", text: "text-(--color-green-dark)", solid: "bg-(--color-green)" },
  red: { tint: "bg-(--color-red-tint)", text: "text-(--color-red-dark)", solid: "bg-(--color-red)" },
};

export function MedicationCard({
  medication,
  variant = "full",
}: {
  medication: Medication;
  variant?: "compact" | "full";
}) {
  const [taken, setTaken] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const { label, due } = useCountdown(medication.nextDoseAt);
  const colors = COLOR_MAP[medication.color] ?? COLOR_MAP.blue;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div
          className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", colors.tint, colors.text)}
          aria-hidden="true"
        >
          <Pill className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-h3 text-(--color-text-primary)">{medication.name}</h3>
              <p className="text-small text-(--color-text-secondary)">{medication.strength}</p>
            </div>
            {medication.refillsLeft === 0 ? (
              <Badge variant="red">Refill needed</Badge>
            ) : (
              <Badge variant="neutral">{medication.refillsLeft} refills left</Badge>
            )}
          </div>
        </div>
      </div>

      <p className="text-body text-(--color-text-secondary)">{medication.purpose}</p>

      <div className="flex flex-wrap items-center gap-3">
        <ScheduleChip icon={Sun} active={medication.schedule.morning} label="Morning" />
        <ScheduleChip icon={Sunset} active={medication.schedule.afternoon} label="Afternoon" />
        <ScheduleChip icon={MoonStar} active={medication.schedule.evening} label="Evening" />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-(--color-bg) px-4 py-3">
        <UtensilsCrossed className="h-5 w-5 shrink-0 text-(--color-text-secondary) mt-0.5" aria-hidden="true" />
        <p className="text-small text-(--color-text-secondary)">{medication.food}</p>
      </div>

      {variant === "full" && expanded && (
        <div className="flex flex-col gap-4 border-t border-(--color-border) pt-4">
          <div>
            <h4 className="text-small font-semibold text-(--color-text-primary) mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-(--color-amber)" aria-hidden="true" />
              Possible side effects
            </h4>
            <ul className="flex flex-wrap gap-2">
              {medication.sideEffects.map((s) => (
                <li key={s} className="rounded-full bg-(--color-amber-tint) px-3 py-1 text-small text-(--color-amber-dark)">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-small font-semibold text-(--color-text-primary) mb-2">Recent history</h4>
            <div className="flex gap-2">
              {medication.history.map((h) => (
                <div key={h.date} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-white",
                      h.taken ? "bg-(--color-green)" : "bg-(--color-border-strong)"
                    )}
                    aria-label={h.taken ? `${h.date}: taken` : `${h.date}: missed`}
                  >
                    {h.taken ? <Check className="h-4 w-4" /> : <span className="text-xs">—</span>}
                  </span>
                  <span className="text-small text-(--color-text-tertiary)">{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-1">
        <div className="flex-1">
          <p className="text-small text-(--color-text-tertiary)">Next dose</p>
          <p className={cn("text-body font-semibold", due && !taken ? "text-(--color-red)" : "text-(--color-text-primary)")}>
            {taken ? "Taken" : label}
          </p>
        </div>
        <Button
          variant={taken ? "secondary" : "success"}
          size="sm"
          onClick={() => setTaken((v) => !v)}
          aria-pressed={taken}
        >
          {taken ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" /> Taken
            </>
          ) : (
            "Mark Taken"
          )}
        </Button>
        {variant === "full" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            Details
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
          </Button>
        )}
        {medication.refillsLeft === 0 && variant === "compact" && (
          <Button variant="secondary" size="sm">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refill
          </Button>
        )}
      </div>
    </Card>
  );
}

function ScheduleChip({
  icon: Icon,
  active,
  label,
}: {
  icon: React.ElementType;
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small font-medium",
        active
          ? "bg-(--color-blue-tint) text-(--color-blue-dark)"
          : "bg-transparent text-(--color-text-tertiary) line-through decoration-(--color-text-tertiary)"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

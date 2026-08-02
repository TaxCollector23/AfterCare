"use client";

import * as React from "react";
import { GlassWater } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GOAL = 8;

export function HydrationCard() {
  const [glasses, setGlasses] = React.useState(6);

  return (
    <Card className="h-full flex flex-col gap-4">
      <CardHeader className="mb-0">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
            <GlassWater className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Hydration</CardTitle>
            <p className="text-small text-(--color-text-secondary)">
              {glasses} of {GOAL} glasses
            </p>
          </div>
        </div>
      </CardHeader>

      <div
        className="flex flex-wrap gap-2.5"
        role="group"
        aria-label={`Water intake: ${glasses} of ${GOAL} glasses`}
      >
        {Array.from({ length: GOAL }).map((_, i) => {
          const filled = i < glasses;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setGlasses(filled && i === glasses - 1 ? i : i + 1)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all duration-150",
                filled
                  ? "border-(--color-blue) bg-(--color-blue-tint) text-(--color-blue)"
                  : "border-(--color-border) text-(--color-text-tertiary) hover:border-(--color-blue-ring)"
              )}
              aria-label={`Glass ${i + 1}${filled ? ", filled" : ", empty"}`}
              aria-pressed={filled}
            >
              <GlassWater className="h-5 w-5" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="mt-auto h-2.5 w-full rounded-full bg-(--color-bg) overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-full bg-(--color-blue) transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${(glasses / GOAL) * 100}%` }}
        />
      </div>
    </Card>
  );
}

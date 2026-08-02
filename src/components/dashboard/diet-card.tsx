import { UtensilsCrossed, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { foodsToEat, foodsToAvoid } from "@/lib/data";

export function DietCard() {
  return (
    <Card className="h-full flex flex-col gap-4">
      <CardHeader className="mb-0">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-green-tint) text-(--color-green-dark)">
            <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
          </span>
          <CardTitle>Diet Guidance</CardTitle>
        </div>
      </CardHeader>
      <div>
        <h4 className="flex items-center gap-1.5 text-small font-semibold text-(--color-green-dark) mb-2">
          <Check className="h-4 w-4" aria-hidden="true" /> Foods to eat
        </h4>
        <ul className="flex flex-wrap gap-2">
          {foodsToEat.map((f) => (
            <li key={f} className="rounded-full bg-(--color-green-tint) px-3 py-1 text-small text-(--color-green-dark)">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="flex items-center gap-1.5 text-small font-semibold text-(--color-red) mb-2">
          <X className="h-4 w-4" aria-hidden="true" /> Foods to avoid
        </h4>
        <ul className="flex flex-wrap gap-2">
          {foodsToAvoid.map((f) => (
            <li key={f} className="rounded-full bg-(--color-red-tint) px-3 py-1 text-small text-(--color-red-dark)">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

import { Weight, Footprints, Car, ShowerHead, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { restrictions } from "@/lib/data";

const ICONS = { weight: Weight, walk: Footprints, car: Car, shower: ShowerHead } as const;

export function RestrictionsCard() {
  return (
    <Card className="h-full flex flex-col gap-4">
      <CardHeader className="mb-0">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-amber-tint) text-(--color-amber-dark)">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>
          <CardTitle>Activity Restrictions</CardTitle>
        </div>
      </CardHeader>
      <ul className="flex flex-col gap-3" role="list">
        {restrictions.map((r) => {
          const Icon = ICONS[r.icon];
          return (
            <li key={r.label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-bg) text-(--color-text-secondary)">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="text-body text-(--color-text-primary)">{r.label}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

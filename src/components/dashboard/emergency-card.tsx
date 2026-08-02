import { PhoneCall, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmergencyCard() {
  return (
    <div
      role="region"
      aria-label="Emergency information"
      className="rounded-2xl border border-(--color-red)/25 bg-(--color-red-tint) p-6 flex flex-col gap-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--color-red) text-white">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-h3 text-(--color-red-dark)">When to seek help</p>
          <p className="text-small text-(--color-text-secondary)">Fever over 101°F, worsening pain, or shortness of breath</p>
        </div>
      </div>
      <Button variant="danger" className="w-full">
        <PhoneCall className="h-5 w-5" aria-hidden="true" />
        Call Care Team: (415) 555-0138
      </Button>
      <p className="text-small text-(--color-text-secondary)">
        For life-threatening emergencies, call <strong className="text-(--color-red-dark)">911</strong> immediately.
      </p>
    </div>
  );
}

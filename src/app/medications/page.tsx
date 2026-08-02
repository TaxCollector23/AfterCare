import { PillBottle } from "lucide-react";
import { MedicationCard } from "@/components/medications/medication-card";
import { medications } from "@/lib/data";

export default function MedicationsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
          <PillBottle className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-h1">Medications</h1>
          <p className="text-body text-(--color-text-secondary)">
            {medications.length} active prescriptions — tap a card for full details
          </p>
        </div>
      </header>

      {medications.length === 0 ? (
        <EmptyMedications />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {medications.map((m) => (
            <MedicationCard key={m.id} medication={m} variant="full" />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyMedications() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-(--color-border-strong) py-24 text-center">
      <PillBottle className="h-12 w-12 text-(--color-text-tertiary)" aria-hidden="true" />
      <p className="text-h3">No medications yet</p>
      <p className="text-body text-(--color-text-secondary) max-w-sm">
        Once your discharge paperwork is processed, your medications will appear here.
      </p>
    </div>
  );
}

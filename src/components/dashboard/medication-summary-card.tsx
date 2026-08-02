import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MedicationCard } from "@/components/medications/medication-card";
import { medications } from "@/lib/data";

export function MedicationSummaryCard() {
  const featured = medications.slice(0, 2);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="med-summary-heading">
      <CardHeader className="mb-0">
        <div>
          <CardTitle id="med-summary-heading">Your Medications</CardTitle>
          <CardDescription>{medications.length} active prescriptions</CardDescription>
        </div>
        <Link
          href="/medications"
          className="flex items-center gap-1.5 text-small font-semibold text-(--color-blue) hover:text-(--color-blue-dark) rounded-md shrink-0 py-1"
        >
          View all
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <div className="grid gap-6 sm:grid-cols-2">
        {featured.map((m) => (
          <MedicationCard key={m.id} medication={m} variant="compact" />
        ))}
      </div>
    </section>
  );
}

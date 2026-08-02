import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function Hero() {
  return (
    <Card className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-8">
      <div>
        <p className="text-small font-semibold text-(--color-blue) uppercase tracking-wide mb-2">
          Day 3 of Recovery
        </p>
        <h1 className="text-h1 text-(--color-text-primary)">{getGreeting()}, Sarah</h1>
        <p className="text-body text-(--color-text-secondary) mt-2 max-w-md">
          You&rsquo;re making steady progress. Here&rsquo;s everything you need to take care of today.
        </p>
      </div>
      <ProgressRing value={72} sublabel="Recovered" />
    </Card>
  );
}

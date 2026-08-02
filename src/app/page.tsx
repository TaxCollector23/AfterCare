import { Hero } from "@/components/dashboard/hero";
import { TasksCard } from "@/components/dashboard/tasks-card";
import { EmergencyCard } from "@/components/dashboard/emergency-card";
import { MedicationSummaryCard } from "@/components/dashboard/medication-summary-card";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { RestrictionsCard } from "@/components/dashboard/restrictions-card";
import { HydrationCard } from "@/components/dashboard/hydration-card";
import { DietCard } from "@/components/dashboard/diet-card";
import { RecoveryTimeline } from "@/components/dashboard/recovery-timeline";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <Hero />
        </div>

        <div className="lg:col-span-8">
          <TasksCard />
        </div>
        <div className="lg:col-span-4">
          <EmergencyCard />
        </div>

        <div className="lg:col-span-12">
          <MedicationSummaryCard />
        </div>

        <div className="lg:col-span-4">
          <AppointmentCard />
        </div>
        <div className="lg:col-span-4">
          <RestrictionsCard />
        </div>
        <div className="lg:col-span-4">
          <HydrationCard />
        </div>

        <div className="lg:col-span-12">
          <DietCard />
        </div>

        <div className="lg:col-span-12">
          <RecoveryTimeline />
        </div>
      </div>
    </div>
  );
}

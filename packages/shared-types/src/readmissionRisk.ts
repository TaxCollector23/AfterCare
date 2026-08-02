/**
 * Follow-up priority — a rule-based signal for how closely someone should be
 * checked in on.
 *
 * This is deliberately arithmetic, not a model: it counts things that already
 * happened (doses with no recorded tick, concerning check-ins the patient
 * hasn't cleared, appointments that came and went) and adds up fixed points.
 * It is NOT a readmission prediction and NOT a diagnosis, and callers must
 * present it as "how closely to check in" — the factor list exists so the
 * number is always shown with its reasons rather than as a verdict.
 */
import { dosesTakenOnDay, medicationSlots } from "./recoveryDay.js";
import type { CheckInRecord } from "./checkIn.js";

export type FollowUpPriority = "low" | "medium" | "high";

/** Points per contributing factor. Kept here so the scoring is auditable. */
export const RISK_POINTS = {
  missedDose: 1,
  unresolvedOrangeCheckIn: 2,
  unresolvedRedCheckIn: 4,
  missedAppointment: 3,
  appointmentSoon: 1,
} as const;

/** Score at or above which each priority applies. */
export const PRIORITY_THRESHOLDS = { medium: 3, high: 7 } as const;

/** How many completed days of dose history to look back over. */
export const DOSE_LOOKBACK_DAYS = 3;

/** An appointment this many days out or fewer counts as "coming up". */
export const APPOINTMENT_SOON_DAYS = 2;

const MS_PER_DAY = 86_400_000;

export interface RiskFactor {
  label: string;
  points: number;
}

export interface FollowUpAssessment {
  priority: FollowUpPriority;
  score: number;
  /** Every factor that contributed, for display alongside the badge. */
  factors: RiskFactor[];
  missedDoses: number;
  unresolvedCheckIns: number;
  missedAppointments: number;
  appointmentsSoon: number;
}

interface RiskMedication {
  timing?: string;
  frequency?: string;
  takenAt?: readonly string[];
}

interface RiskAppointment {
  /** Machine-readable appointment instant. Undated appointments are skipped. */
  isoDate?: string | null;
}

export interface FollowUpInputs {
  medications: readonly RiskMedication[];
  checkIns: readonly CheckInRecord[];
  appointments: readonly RiskAppointment[];
  /** When the guide was produced — dose history before this day is not counted. */
  processedAt?: number | string | null;
  now?: number;
}

function startOfDay(value: number | string): number {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.NaN;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  ).getTime();
}

/**
 * Doses that were scheduled on a completed day and have no recorded tick.
 *
 * Today is excluded on purpose — the day isn't over, so an untaken evening dose
 * is not yet a missed one. Days before the guide existed are excluded too.
 */
export function countMissedDoses(
  medications: readonly RiskMedication[],
  processedAt: number | string | null | undefined,
  now: number = Date.now(),
  lookbackDays: number = DOSE_LOOKBACK_DAYS,
): number {
  const today = startOfDay(now);
  if (Number.isNaN(today)) return 0;

  const earliest =
    processedAt === null || processedAt === undefined
      ? Number.NaN
      : startOfDay(processedAt);

  let missed = 0;
  for (let back = 1; back <= lookbackDays; back += 1) {
    const day = today - back * MS_PER_DAY;
    // Nothing was prescribed before the document was processed.
    if (!Number.isNaN(earliest) && day < earliest) break;

    for (const medication of medications) {
      const slots = medicationSlots(
        medication.timing ?? "",
        medication.frequency ?? "",
      );
      if (slots.length === 0) continue; // as-needed doses can't be "missed"
      const taken = dosesTakenOnDay(medication.takenAt, day);
      missed += Math.max(0, slots.length - taken);
    }
  }
  return missed;
}

function priorityFor(score: number): FollowUpPriority {
  if (score >= PRIORITY_THRESHOLDS.high) return "high";
  if (score >= PRIORITY_THRESHOLDS.medium) return "medium";
  return "low";
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Computes the follow-up priority from things that already happened.
 *
 * An empty guide scores zero and reports "low" with no factors, so a patient
 * who has just uploaded a document is never told to check in closely on the
 * strength of missing data.
 */
export function assessFollowUp(inputs: FollowUpInputs): FollowUpAssessment {
  const now = inputs.now ?? Date.now();
  const today = startOfDay(now);
  const factors: RiskFactor[] = [];

  const missedDoses = countMissedDoses(
    inputs.medications,
    inputs.processedAt,
    now,
  );
  if (missedDoses > 0) {
    factors.push({
      label: `${plural(missedDoses, "dose")} with no record of being taken`,
      points: missedDoses * RISK_POINTS.missedDose,
    });
  }

  const unresolvedRed = inputs.checkIns.filter(
    (c) => c.overall === "red" && !c.acknowledgedAt,
  ).length;
  const unresolvedOrange = inputs.checkIns.filter(
    (c) => c.overall === "orange" && !c.acknowledgedAt,
  ).length;
  if (unresolvedRed > 0) {
    factors.push({
      label: `${plural(unresolvedRed, "red check-in")} not yet resolved`,
      points: unresolvedRed * RISK_POINTS.unresolvedRedCheckIn,
    });
  }
  if (unresolvedOrange > 0) {
    factors.push({
      label: `${plural(unresolvedOrange, "amber check-in")} not yet resolved`,
      points: unresolvedOrange * RISK_POINTS.unresolvedOrangeCheckIn,
    });
  }

  let missedAppointments = 0;
  let appointmentsSoon = 0;
  if (!Number.isNaN(today)) {
    for (const appointment of inputs.appointments) {
      if (!appointment.isoDate) continue; // undated — nothing to judge
      const when = startOfDay(appointment.isoDate);
      if (Number.isNaN(when)) continue;
      const daysAway = Math.round((when - today) / MS_PER_DAY);
      if (daysAway < 0) missedAppointments += 1;
      else if (daysAway <= APPOINTMENT_SOON_DAYS) appointmentsSoon += 1;
    }
  }
  if (missedAppointments > 0) {
    factors.push({
      label: `${plural(missedAppointments, "appointment")} already passed`,
      points: missedAppointments * RISK_POINTS.missedAppointment,
    });
  }
  if (appointmentsSoon > 0) {
    factors.push({
      label: `${plural(appointmentsSoon, "appointment")} coming up`,
      points: appointmentsSoon * RISK_POINTS.appointmentSoon,
    });
  }

  const score = factors.reduce((sum, factor) => sum + factor.points, 0);

  return {
    priority: priorityFor(score),
    score,
    factors,
    missedDoses,
    unresolvedCheckIns: unresolvedRed + unresolvedOrange,
    missedAppointments,
    appointmentsSoon,
  };
}

export const PRIORITY_LABEL: Record<FollowUpPriority, string> = {
  low: "Routine follow-up",
  medium: "Check in soon",
  high: "Check in closely",
};

export const PRIORITY_TAG_CLASS: Record<FollowUpPriority, string> = {
  low: "tag-low",
  medium: "tag-med",
  high: "tag-high",
};

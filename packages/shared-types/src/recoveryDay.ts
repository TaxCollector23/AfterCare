/**
 * Pure recovery-day logic, shared by the API and the web app.
 *
 * Everything here is derived arithmetic over data the pipeline already
 * extracted and the judge stage verified against the source document. Nothing
 * in this module invents a schedule, a date, or a clinical claim: when the
 * source data doesn't say something, these functions return null/empty rather
 * than guessing, and callers render an honest "not stated" instead.
 */
// Intentionally no imports: the helpers below are structurally typed so both
// the API's RecoveryPlan shapes and the web view-model satisfy them.

export type MedicationSlot = "morning" | "afternoon" | "evening";

export const MEDICATION_SLOTS: MedicationSlot[] = [
  "morning",
  "afternoon",
  "evening",
];

const MS_PER_DAY = 86_400_000;

/** Local midnight for a timestamp, or NaN when the input isn't a usable date. */
function startOfDay(value: number | string): number {
  const parsed = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.NaN;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  ).getTime();
}

/**
 * 1-based day of recovery, where day 1 is the day the document was processed
 * (the discharge day). Returns null when the processed date is missing or
 * unparseable — callers must not display a day number they can't stand behind.
 *
 * Counting is calendar-day based, not elapsed-24h, so a document processed at
 * 11pm rolls to "Day 2" the next morning rather than 24 hours later.
 */
export function recoveryDayNumber(
  processedAt: number | string | null | undefined,
  now: number | string = Date.now(),
): number | null {
  if (processedAt === null || processedAt === undefined) return null;
  const start = startOfDay(processedAt);
  const today = startOfDay(now);
  if (Number.isNaN(start) || Number.isNaN(today)) return null;
  const elapsed = Math.round((today - start) / MS_PER_DAY);
  // A future-dated document is still "day 1" — never report day 0 or negative.
  return elapsed < 0 ? 1 : elapsed + 1;
}

function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}`, "i").test(haystack);
}

/**
 * Which parts of the day a medication is due, read from the free-text timing
 * and frequency the extraction stage captured.
 *
 * Returns an empty array when nothing matched — an "as needed" or unparsed
 * schedule must not be presented as a fixed daily dose.
 */
export function medicationSlots(
  timing: string,
  frequency: string,
): MedicationSlot[] {
  const text = `${timing} ${frequency}`;
  const daily = /\bdaily\b|\bevery day\b|\bonce a day\b/i.test(text);
  const twice = /\btwice\b|\bbid\b|\b2x\b/i.test(text);
  const thrice = /\bthree times\b|\btid\b|\b3x\b/i.test(text);

  const morning =
    hasWord(text, "morning") || hasWord(text, "am") || daily || twice || thrice;
  const afternoon =
    hasWord(text, "afternoon") || hasWord(text, "noon") || thrice;
  const evening =
    hasWord(text, "evening") ||
    hasWord(text, "night") ||
    hasWord(text, "bedtime") ||
    twice ||
    thrice;

  const slots: MedicationSlot[] = [];
  if (morning) slots.push("morning");
  if (afternoon) slots.push("afternoon");
  if (evening) slots.push("evening");
  return slots;
}

/** True when one of the recorded ISO timestamps falls on the same calendar day. */
export function takenOnDay(
  takenAt: readonly string[] | undefined,
  now: number | string = Date.now(),
): boolean {
  if (!takenAt || takenAt.length === 0) return false;
  const today = startOfDay(now);
  if (Number.isNaN(today)) return false;
  return takenAt.some((stamp) => startOfDay(stamp) === today);
}

/** How many of today's recorded doses a medication already has. */
export function dosesTakenOnDay(
  takenAt: readonly string[] | undefined,
  now: number | string = Date.now(),
): number {
  if (!takenAt || takenAt.length === 0) return 0;
  const today = startOfDay(now);
  if (Number.isNaN(today)) return 0;
  return takenAt.filter((stamp) => startOfDay(stamp) === today).length;
}

export interface ScheduledMedication<T> {
  medication: T;
  slots: MedicationSlot[];
  takenToday: boolean;
  dosesToday: number;
  /** True once today's recorded doses cover every scheduled slot. */
  complete: boolean;
}

export interface DailyMedicationPlan<T> {
  /** Medications with a schedule the document actually states. */
  scheduled: ScheduledMedication<T>[];
  /** Medications with no parseable schedule (e.g. "as needed"), never shown as due. */
  asNeeded: T[];
}

/**
 * Structural, not `Pick<Medication, …>`: the web view-model carries these
 * fields optionally, and this logic only needs them to be readable.
 */
type SchedulableMedication = {
  timing?: string;
  frequency?: string;
  takenAt?: readonly string[];
};

/**
 * Splits a medication list into what is due today and what is only taken as
 * needed. Ordering within each bucket is preserved from the source list.
 */
export function dailyMedicationPlan<T extends SchedulableMedication>(
  medications: readonly T[],
  now: number | string = Date.now(),
): DailyMedicationPlan<T> {
  const scheduled: ScheduledMedication<T>[] = [];
  const asNeeded: T[] = [];

  for (const medication of medications) {
    const slots = medicationSlots(
      medication.timing ?? "",
      medication.frequency ?? "",
    );
    if (slots.length === 0) {
      asNeeded.push(medication);
      continue;
    }
    const dosesToday = dosesTakenOnDay(medication.takenAt, now);
    scheduled.push({
      medication,
      slots,
      takenToday: dosesToday > 0,
      dosesToday,
      complete: dosesToday >= slots.length,
    });
  }

  return { scheduled, asNeeded };
}

/** Structural for the same reason as SchedulableMedication above. */
type DatedTimelineEntry = { date?: string | null };

/**
 * Timeline entries falling within `windowDays` either side of today.
 *
 * Undated entries are deliberately excluded: the document didn't place them on
 * a day, so claiming they're due now would be an invented clinical claim.
 */
export function timelineAroundDay<T extends DatedTimelineEntry>(
  entries: readonly T[],
  now: number | string = Date.now(),
  windowDays = 1,
): T[] {
  const today = startOfDay(now);
  if (Number.isNaN(today)) return [];
  return entries.filter((entry) => {
    if (!entry.date) return false;
    const when = startOfDay(entry.date);
    if (Number.isNaN(when)) return false;
    return Math.abs(Math.round((when - today) / MS_PER_DAY)) <= windowDays;
  });
}

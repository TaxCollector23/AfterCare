import { describe, it, expect } from "vitest";
import {
  dailyMedicationPlan,
  dosesTakenOnDay,
  medicationSlots,
  recoveryDayNumber,
  takenOnDay,
  timelineAroundDay,
} from "@discharge-guide/shared-types";

/** Local-midnight timestamp, matching how the module buckets calendar days. */
const at = (iso: string) => new Date(iso).getTime();

describe("recoveryDayNumber", () => {
  it("counts the processed day itself as day 1", () => {
    expect(
      recoveryDayNumber(at("2026-08-02T09:00:00"), at("2026-08-02T23:00:00")),
    ).toBe(1);
  });

  it("rolls over on calendar days, not elapsed 24-hour periods", () => {
    // Processed at 11pm; 8am the next morning is day 2 even though 9h elapsed.
    expect(
      recoveryDayNumber(at("2026-08-02T23:00:00"), at("2026-08-03T08:00:00")),
    ).toBe(2);
  });

  it("counts multi-day gaps", () => {
    expect(
      recoveryDayNumber(at("2026-08-02T12:00:00"), at("2026-08-12T12:00:00")),
    ).toBe(11);
  });

  it("never reports day zero or a negative day for a future-dated document", () => {
    expect(
      recoveryDayNumber(at("2026-08-10T12:00:00"), at("2026-08-02T12:00:00")),
    ).toBe(1);
  });

  it("returns null rather than guessing when the processed date is missing", () => {
    expect(recoveryDayNumber(null)).toBeNull();
    expect(recoveryDayNumber(undefined)).toBeNull();
  });

  it("returns null for an unparseable processed date", () => {
    expect(recoveryDayNumber("not a date", at("2026-08-02T12:00:00"))).toBeNull();
  });

  it("accepts ISO strings as well as timestamps", () => {
    expect(recoveryDayNumber("2026-08-02T09:00:00", "2026-08-04T09:00:00")).toBe(
      3,
    );
  });
});

describe("medicationSlots", () => {
  it("reads an explicit part of day", () => {
    expect(medicationSlots("in the morning", "")).toEqual(["morning"]);
    expect(medicationSlots("at bedtime", "")).toEqual(["evening"]);
  });

  it("expands twice daily to morning and evening", () => {
    expect(medicationSlots("", "twice daily")).toEqual(["morning", "evening"]);
  });

  it("expands three times daily to all three slots", () => {
    expect(medicationSlots("", "three times a day")).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("treats once-daily as a morning dose", () => {
    expect(medicationSlots("", "once a day")).toEqual(["morning"]);
  });

  it("recognizes clinical shorthand", () => {
    expect(medicationSlots("", "BID")).toEqual(["morning", "evening"]);
    expect(medicationSlots("", "TID")).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("claims no schedule at all when nothing matched", () => {
    expect(medicationSlots("", "as needed")).toEqual([]);
    expect(medicationSlots("", "")).toEqual([]);
  });
});

describe("takenOnDay / dosesTakenOnDay", () => {
  const now = at("2026-08-02T18:00:00");

  it("is false with no recorded doses", () => {
    expect(takenOnDay([], now)).toBe(false);
    expect(takenOnDay(undefined, now)).toBe(false);
    expect(dosesTakenOnDay(undefined, now)).toBe(0);
  });

  it("matches a dose recorded earlier the same day", () => {
    expect(takenOnDay([new Date(at("2026-08-02T08:00:00")).toISOString()], now)).toBe(
      true,
    );
  });

  it("ignores yesterday's doses", () => {
    expect(
      takenOnDay([new Date(at("2026-08-01T20:00:00")).toISOString()], now),
    ).toBe(false);
  });

  it("counts only today's doses", () => {
    const stamps = [
      new Date(at("2026-08-01T08:00:00")).toISOString(),
      new Date(at("2026-08-02T08:00:00")).toISOString(),
      new Date(at("2026-08-02T20:00:00")).toISOString(),
    ];
    expect(dosesTakenOnDay(stamps, now)).toBe(2);
  });
});

describe("dailyMedicationPlan", () => {
  const now = at("2026-08-02T18:00:00");

  const med = (
    id: string,
    timing: string,
    frequency: string,
    takenAt: string[] = [],
  ) => ({
    id,
    name: id,
    dose: "500mg",
    frequency,
    timing,
    instructions: "",
    takenAt,
    confidence: 95,
    sourceLines: [1],
  });

  it("separates scheduled medications from as-needed ones", () => {
    const plan = dailyMedicationPlan(
      [
        med("scheduled", "", "twice daily"),
        med("prn", "", "as needed for pain"),
      ],
      now,
    );

    expect(plan.scheduled.map((s) => s.medication.id)).toEqual(["scheduled"]);
    expect(plan.asNeeded.map((m) => m.id)).toEqual(["prn"]);
  });

  it("marks a schedule complete only once every slot has a recorded dose", () => {
    const oneDose = [new Date(at("2026-08-02T08:00:00")).toISOString()];
    const twoDoses = [...oneDose, new Date(at("2026-08-02T20:00:00")).toISOString()];

    const partial = dailyMedicationPlan([med("a", "", "twice daily", oneDose)], now);
    expect(partial.scheduled[0]!.takenToday).toBe(true);
    expect(partial.scheduled[0]!.complete).toBe(false);

    const done = dailyMedicationPlan([med("a", "", "twice daily", twoDoses)], now);
    expect(done.scheduled[0]!.complete).toBe(true);
  });

  it("does not carry yesterday's doses into today", () => {
    const yesterday = [new Date(at("2026-08-01T08:00:00")).toISOString()];
    const plan = dailyMedicationPlan([med("a", "", "daily", yesterday)], now);

    expect(plan.scheduled[0]!.takenToday).toBe(false);
    expect(plan.scheduled[0]!.dosesToday).toBe(0);
  });

  it("preserves source ordering within each bucket", () => {
    const plan = dailyMedicationPlan(
      [
        med("first", "", "daily"),
        med("prn1", "", "as needed"),
        med("second", "", "daily"),
        med("prn2", "", "as needed"),
      ],
      now,
    );

    expect(plan.scheduled.map((s) => s.medication.id)).toEqual([
      "first",
      "second",
    ]);
    expect(plan.asNeeded.map((m) => m.id)).toEqual(["prn1", "prn2"]);
  });
});

describe("timelineAroundDay", () => {
  const now = at("2026-08-02T12:00:00");
  const entry = (id: string, date: string | null) => ({
    id,
    label: id,
    date,
    instructions: "",
    confidence: 95,
    sourceLines: [1],
  });

  it("includes today and the surrounding window", () => {
    const result = timelineAroundDay(
      [
        entry("yesterday", "2026-08-01T00:00:00"),
        entry("today", "2026-08-02T00:00:00"),
        entry("tomorrow", "2026-08-03T00:00:00"),
        entry("next-week", "2026-08-09T00:00:00"),
      ],
      now,
    );

    expect(result.map((e) => e.id)).toEqual(["yesterday", "today", "tomorrow"]);
  });

  it("honors a wider window", () => {
    const result = timelineAroundDay(
      [entry("in-three-days", "2026-08-05T00:00:00")],
      now,
      3,
    );
    expect(result.map((e) => e.id)).toEqual(["in-three-days"]);
  });

  it("excludes undated entries rather than placing them on today", () => {
    const result = timelineAroundDay([entry("undated", null)], now);
    expect(result).toEqual([]);
  });

  it("excludes entries with an unparseable date", () => {
    const result = timelineAroundDay([entry("bad", "sometime next week")], now);
    expect(result).toEqual([]);
  });
});

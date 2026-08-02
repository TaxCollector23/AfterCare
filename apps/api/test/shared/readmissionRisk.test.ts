import { describe, it, expect } from "vitest";
import {
  assessFollowUp,
  countMissedDoses,
  type CheckInRecord,
} from "@discharge-guide/shared-types";

const at = (iso: string) => new Date(iso).getTime();
const NOW = at("2026-08-10T12:00:00");

const med = (frequency: string, takenAt: string[] = []) => ({
  timing: "",
  frequency,
  takenAt,
});

const checkIn = (
  overall: CheckInRecord["overall"],
  acknowledgedAt: number | null = null,
): CheckInRecord => ({
  id: Math.random().toString(),
  documentId: "d1",
  answers: {},
  overall,
  createdAt: NOW,
  acknowledgedAt,
  notifiedEmails: [],
});

/** ISO stamp for a dose taken on a given day. */
const dose = (iso: string) => new Date(at(iso)).toISOString();

describe("countMissedDoses", () => {
  const processed = at("2026-08-01T09:00:00");

  it("counts scheduled doses with no record on completed days", () => {
    // twice daily over the 3 completed days before today = 6 expected, 0 taken.
    expect(countMissedDoses([med("twice daily")], processed, NOW)).toBe(6);
  });

  it("does not count today, because the day isn't over", () => {
    // A single completed day of lookback isolates yesterday.
    expect(countMissedDoses([med("daily")], processed, NOW, 1)).toBe(1);
  });

  it("subtracts doses that were actually recorded", () => {
    const taken = [dose("2026-08-09T08:00:00"), dose("2026-08-09T20:00:00")];
    // Yesterday fully covered -> nothing missed in a 1-day lookback.
    expect(countMissedDoses([med("twice daily", taken)], processed, NOW, 1)).toBe(
      0,
    );
  });

  it("counts a partially covered day", () => {
    const taken = [dose("2026-08-09T08:00:00")];
    expect(countMissedDoses([med("twice daily", taken)], processed, NOW, 1)).toBe(
      1,
    );
  });

  it("never counts as-needed medications as missed", () => {
    expect(countMissedDoses([med("as needed for pain")], processed, NOW)).toBe(0);
  });

  it("does not count days before the guide existed", () => {
    // Processed yesterday: only yesterday is a completed day under the guide.
    const yesterday = at("2026-08-09T09:00:00");
    expect(countMissedDoses([med("daily")], yesterday, NOW)).toBe(1);
  });

  it("counts nothing when the processed date is unknown but history is empty", () => {
    expect(countMissedDoses([], null, NOW)).toBe(0);
  });
});

describe("assessFollowUp", () => {
  const base = {
    medications: [],
    checkIns: [],
    appointments: [],
    processedAt: at("2026-08-09T09:00:00"),
    now: NOW,
  };

  it("reports low priority with no factors for a fresh guide", () => {
    const result = assessFollowUp(base);

    expect(result.priority).toBe("low");
    expect(result.score).toBe(0);
    expect(result.factors).toEqual([]);
  });

  it("does not raise priority on missing data alone", () => {
    // A guide with medications but no dose log yet, processed today.
    const result = assessFollowUp({
      ...base,
      medications: [med("twice daily")],
      processedAt: NOW,
    });

    expect(result.missedDoses).toBe(0);
    expect(result.priority).toBe("low");
  });

  it("counts an unresolved red check-in more heavily than an amber one", () => {
    const red = assessFollowUp({ ...base, checkIns: [checkIn("red")] });
    const amber = assessFollowUp({ ...base, checkIns: [checkIn("orange")] });

    expect(red.score).toBeGreaterThan(amber.score);
    expect(red.unresolvedCheckIns).toBe(1);
  });

  it("ignores acknowledged check-ins", () => {
    const result = assessFollowUp({
      ...base,
      checkIns: [checkIn("red", NOW), checkIn("green")],
    });

    expect(result.unresolvedCheckIns).toBe(0);
    expect(result.score).toBe(0);
  });

  it("counts a passed appointment as missed", () => {
    const result = assessFollowUp({
      ...base,
      appointments: [{ isoDate: "2026-08-05T10:00:00" }],
    });

    expect(result.missedAppointments).toBe(1);
    expect(result.appointmentsSoon).toBe(0);
  });

  it("counts an appointment in the next two days as coming up", () => {
    const result = assessFollowUp({
      ...base,
      appointments: [{ isoDate: "2026-08-11T10:00:00" }],
    });

    expect(result.appointmentsSoon).toBe(1);
    expect(result.missedAppointments).toBe(0);
  });

  it("skips undated and unparseable appointments", () => {
    const result = assessFollowUp({
      ...base,
      appointments: [{ isoDate: null }, { isoDate: "in two weeks" }, {}],
    });

    expect(result.missedAppointments).toBe(0);
    expect(result.appointmentsSoon).toBe(0);
    expect(result.score).toBe(0);
  });

  it("escalates to high once enough is outstanding", () => {
    const result = assessFollowUp({
      ...base,
      checkIns: [checkIn("red"), checkIn("orange")],
      appointments: [{ isoDate: "2026-08-05T10:00:00" }],
    });

    expect(result.priority).toBe("high");
  });

  it("lists a reason for every point it scored", () => {
    const result = assessFollowUp({
      ...base,
      medications: [med("daily")],
      checkIns: [checkIn("red")],
      appointments: [{ isoDate: "2026-08-05T10:00:00" }],
    });

    const total = result.factors.reduce((sum, f) => sum + f.points, 0);
    expect(total).toBe(result.score);
    expect(result.factors.length).toBeGreaterThan(0);
    for (const factor of result.factors) {
      expect(factor.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("rises monotonically as more goes unaddressed", () => {
    const one = assessFollowUp({ ...base, checkIns: [checkIn("orange")] });
    const two = assessFollowUp({
      ...base,
      checkIns: [checkIn("orange"), checkIn("orange")],
    });

    expect(two.score).toBeGreaterThan(one.score);
  });
});

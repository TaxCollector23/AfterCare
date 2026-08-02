import { describe, expect, it } from "vitest";
import { resolveAppointmentDate } from "./orchestrator.js";

describe("resolveAppointmentDate", () => {
  it("converts a concrete calendar date to a midnight-UTC ISO datetime", () => {
    expect(resolveAppointmentDate("2026-08-15", "August 15")).toBe(
      "2026-08-15T00:00:00.000Z",
    );
  });

  it("falls back to the free-text date when there is no concrete date", () => {
    expect(resolveAppointmentDate(null, "in 2 weeks")).toBe("in 2 weeks");
  });

  it("returns an empty string when neither a date nor date text is available", () => {
    expect(resolveAppointmentDate(null, undefined)).toBe("");
  });

  it("never mistakes free text for a valid date, even if date-shaped", () => {
    // Guards the ICS route's assumption that a non-empty date is a real ISO
    // datetime ? malformed/partial dates must fall through to plain text.
    expect(
      resolveAppointmentDate("2026-08" as unknown as string, "August"),
    ).toBe("August");
  });
});

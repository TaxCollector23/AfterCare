import { describe, it, expect } from "vitest";
import {
  CHECK_IN_QUESTIONS,
  drivingQuestions,
  isCheckInComplete,
  isUnresolved,
  overallCheckInLevel,
  shouldAlertCaregivers,
  type CheckInRecord,
} from "@discharge-guide/shared-types";

describe("CHECK_IN_QUESTIONS", () => {
  it("offers exactly one option per traffic-light level", () => {
    for (const question of CHECK_IN_QUESTIONS) {
      expect(question.options.map((o) => o.level)).toEqual([
        "green",
        "orange",
        "red",
      ]);
    }
  });

  it("covers pain, wound, and overall condition", () => {
    expect(CHECK_IN_QUESTIONS.map((q) => q.id)).toEqual([
      "pain",
      "wound",
      "condition",
    ]);
  });
});

describe("overallCheckInLevel", () => {
  it("is green when every answer is green", () => {
    expect(
      overallCheckInLevel({ pain: "green", wound: "green", condition: "green" }),
    ).toBe("green");
  });

  it("takes the worst answer given, not an average", () => {
    expect(
      overallCheckInLevel({ pain: "green", wound: "orange", condition: "green" }),
    ).toBe("orange");
    expect(
      overallCheckInLevel({ pain: "green", wound: "orange", condition: "red" }),
    ).toBe("red");
  });

  it("never reports worse than something the patient actually selected", () => {
    // Three ambers must not add up to a red.
    expect(
      overallCheckInLevel({
        pain: "orange",
        wound: "orange",
        condition: "orange",
      }),
    ).toBe("orange");
  });

  it("treats an empty check-in as green rather than concerning", () => {
    expect(overallCheckInLevel({})).toBe("green");
  });

  it("ignores unanswered questions", () => {
    expect(overallCheckInLevel({ pain: "red" })).toBe("red");
  });
});

describe("isCheckInComplete", () => {
  it("requires an answer to every question", () => {
    expect(isCheckInComplete({ pain: "green" })).toBe(false);
    expect(isCheckInComplete({ pain: "green", wound: "green" })).toBe(false);
    expect(
      isCheckInComplete({ pain: "green", wound: "green", condition: "green" }),
    ).toBe(true);
  });
});

describe("shouldAlertCaregivers", () => {
  it("alerts on amber and red, but not green", () => {
    expect(shouldAlertCaregivers("green")).toBe(false);
    expect(shouldAlertCaregivers("orange")).toBe(true);
    expect(shouldAlertCaregivers("red")).toBe(true);
  });
});

describe("drivingQuestions", () => {
  it("returns only the questions answered at the overall level", () => {
    const driving = drivingQuestions({
      pain: "orange",
      wound: "red",
      condition: "green",
    });
    expect(driving.map((q) => q.id)).toEqual(["wound"]);
  });

  it("returns every question tied at the worst level", () => {
    const driving = drivingQuestions({
      pain: "red",
      wound: "red",
      condition: "green",
    });
    expect(driving.map((q) => q.id)).toEqual(["pain", "wound"]);
  });

  it("returns nothing for an all-green check-in", () => {
    expect(
      drivingQuestions({ pain: "green", wound: "green", condition: "green" }),
    ).toEqual([]);
  });
});

describe("isUnresolved", () => {
  const record = (
    overall: CheckInRecord["overall"],
    acknowledgedAt: number | null,
  ): CheckInRecord => ({
    id: "c1",
    documentId: "d1",
    answers: {},
    overall,
    createdAt: 0,
    acknowledgedAt,
    notifiedEmails: [],
  });

  it("counts an unacknowledged amber or red check-in", () => {
    expect(isUnresolved(record("orange", null))).toBe(true);
    expect(isUnresolved(record("red", null))).toBe(true);
  });

  it("clears once acknowledged", () => {
    expect(isUnresolved(record("red", 123))).toBe(false);
  });

  it("never counts a green check-in", () => {
    expect(isUnresolved(record("green", null))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  ACTION_INSTRUCTION,
  escalatesToCaregiver,
  evaluateCheckIn,
} from "@discharge-guide/shared-types";
import type { WarningSign } from "@discharge-guide/shared-types";

const warning = (id: string, action: WarningSign["action"]): WarningSign => ({
  id,
  symptom: `${id} symptom`,
  action,
  confidence: 95,
  sourceLines: [1],
});

const warnings: WarningSign[] = [
  warning("w1", "call_provider"),
  warning("w2", "emergency_room"),
  warning("w3", "call_911"),
];

describe("escalatesToCaregiver", () => {
  it("escalates for emergency room and 911, but not a provider call", () => {
    expect(escalatesToCaregiver("call_provider")).toBe(false);
    expect(escalatesToCaregiver("emergency_room")).toBe(true);
    expect(escalatesToCaregiver("call_911")).toBe(true);
  });
});

describe("evaluateCheckIn", () => {
  it("reports nothing selected as no action and no alert", () => {
    const result = evaluateCheckIn(warnings, []);

    expect(result.matched).toEqual([]);
    expect(result.highestAction).toBeNull();
    expect(result.shouldAlertCaregivers).toBe(false);
  });

  it("does not alert caregivers for a provider-call symptom alone", () => {
    const result = evaluateCheckIn(warnings, ["w1"]);

    expect(result.matched.map((w) => w.id)).toEqual(["w1"]);
    expect(result.highestAction).toBe("call_provider");
    expect(result.shouldAlertCaregivers).toBe(false);
  });

  it("alerts caregivers for an emergency-room symptom", () => {
    const result = evaluateCheckIn(warnings, ["w2"]);

    expect(result.highestAction).toBe("emergency_room");
    expect(result.shouldAlertCaregivers).toBe(true);
  });

  it("alerts caregivers for a call-911 symptom", () => {
    const result = evaluateCheckIn(warnings, ["w3"]);

    expect(result.highestAction).toBe("call_911");
    expect(result.shouldAlertCaregivers).toBe(true);
  });

  it("picks the most urgent action when several symptoms are reported", () => {
    const result = evaluateCheckIn(warnings, ["w1", "w2", "w3"]);

    expect(result.highestAction).toBe("call_911");
    expect(result.shouldAlertCaregivers).toBe(true);
  });

  it("attributes the instruction only to symptoms that actually carry it", () => {
    // Fever is call_provider; chest pain is call_911. The 911 instruction must
    // not be presented as something the document said about the fever.
    const result = evaluateCheckIn(warnings, ["w1", "w3"]);

    expect(result.highestAction).toBe("call_911");
    expect(result.matched.map((w) => w.id)).toEqual(["w1", "w3"]);
    expect(result.driving.map((w) => w.id)).toEqual(["w3"]);
  });

  it("lists every driving symptom when several share the winning action", () => {
    const shared = [
      warning("a", "emergency_room"),
      warning("b", "call_provider"),
      warning("c", "emergency_room"),
    ];
    const result = evaluateCheckIn(shared, ["a", "b", "c"]);

    expect(result.driving.map((w) => w.id)).toEqual(["a", "c"]);
  });

  it("has no driving symptoms when nothing matched", () => {
    expect(evaluateCheckIn(warnings, ["ghost"]).driving).toEqual([]);
  });

  it("is not order-dependent when picking the most urgent action", () => {
    expect(evaluateCheckIn(warnings, ["w3", "w1"]).highestAction).toBe("call_911");
    expect(evaluateCheckIn(warnings, ["w1", "w3"]).highestAction).toBe("call_911");
  });

  it("ignores ids that are not warning signs in this document", () => {
    const result = evaluateCheckIn(warnings, ["ghost", "w1"]);

    expect(result.matched.map((w) => w.id)).toEqual(["w1"]);
    expect(result.unknownIds).toEqual(["ghost"]);
    expect(result.highestAction).toBe("call_provider");
  });

  it("cannot manufacture an escalation from an unknown symptom id", () => {
    const result = evaluateCheckIn(warnings, ["not-in-document"]);

    expect(result.matched).toEqual([]);
    expect(result.unknownIds).toEqual(["not-in-document"]);
    expect(result.highestAction).toBeNull();
    expect(result.shouldAlertCaregivers).toBe(false);
  });

  it("returns matches in the document's order, not the selection order", () => {
    const result = evaluateCheckIn(warnings, ["w3", "w1"]);
    expect(result.matched.map((w) => w.id)).toEqual(["w1", "w3"]);
  });

  it("has patient-facing instruction text for every action", () => {
    expect(Object.keys(ACTION_INSTRUCTION).sort()).toEqual([
      "call_911",
      "call_provider",
      "emergency_room",
    ]);
  });
});

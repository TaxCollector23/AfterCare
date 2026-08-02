import { describe, it, expect } from "vitest";
import { primaryConditionExplanation } from "@discharge-guide/shared-types";

const explanation = (
  term: string,
  confidence: number,
  sourceLines: number[],
  plainText = `${term} explained`,
) => ({ term, plainText, confidence, sourceLines });

describe("primaryConditionExplanation", () => {
  it("returns null when there is nothing to show", () => {
    expect(primaryConditionExplanation([])).toBeNull();
  });

  it("picks the highest-confidence explanation", () => {
    const result = primaryConditionExplanation([
      explanation("Sutures", 70, [12]),
      explanation("Cholecystectomy", 95, [40]),
    ]);
    expect(result?.term).toBe("Cholecystectomy");
  });

  it("never promotes an ungrounded explanation", () => {
    // Higher confidence, but cited nothing in the document.
    const result = primaryConditionExplanation([
      explanation("Ungrounded", 99, []),
      explanation("Grounded", 70, [8]),
    ]);
    expect(result?.term).toBe("Grounded");
  });

  it("returns null when every explanation is ungrounded", () => {
    expect(
      primaryConditionExplanation([explanation("Nothing cited", 99, [])]),
    ).toBeNull();
  });

  it("skips explanations below the confidence floor", () => {
    expect(primaryConditionExplanation([explanation("Shaky", 40, [3])])).toBeNull();
  });

  it("honours a custom confidence floor", () => {
    const result = primaryConditionExplanation(
      [explanation("Shaky", 40, [3])],
      30,
    );
    expect(result?.term).toBe("Shaky");
  });

  it("skips explanations with no text to show", () => {
    const result = primaryConditionExplanation([
      explanation("Empty", 99, [1], "   "),
      explanation("Real", 80, [5]),
    ]);
    expect(result?.term).toBe("Real");
  });

  it("breaks confidence ties on the earliest cited line", () => {
    const result = primaryConditionExplanation([
      explanation("Later", 90, [40, 41]),
      explanation("Earlier", 90, [7, 60]),
    ]);
    expect(result?.term).toBe("Earlier");
  });

  it("is order-independent", () => {
    const a = explanation("A", 90, [40]);
    const b = explanation("B", 90, [7]);
    expect(primaryConditionExplanation([a, b])?.term).toBe("B");
    expect(primaryConditionExplanation([b, a])?.term).toBe("B");
  });
});

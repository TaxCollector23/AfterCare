import { describe, it, expect, vi } from "vitest";
import type { OcrResult } from "../../src/pipeline/types.js";

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));

import { runExtraction } from "../../src/pipeline/extraction.js";

function makeOcr(lines: string[]): OcrResult {
  const ocrLines = lines.map((text, idx) => ({
    line: idx + 1,
    text,
    confidence: 95,
  }));
  return { lines: ocrLines, text: lines.join("\n"), pageCount: 1 };
}

describe("runExtraction", () => {
  it("passes through a well-formed model response", async () => {
    callJsonMock.mockResolvedValueOnce({
      medicationsText: "1: Take amoxicillin twice daily",
      appointmentsText: "",
      warningsText: "",
      timelineText: "",
      otherText: "",
    });

    const result = await runExtraction(
      makeOcr(["Take amoxicillin twice daily"]),
    );

    expect(result.success).toBe(true);
    expect(result.data?.medicationsText).toBe(
      "1: Take amoxicillin twice daily",
    );
    expect(result.data?.appointmentsText).toBe("");
    expect(result.confidence).toBe(90);
  });

  it("normalizes missing or wrong-typed fields instead of throwing downstream", async () => {
    callJsonMock.mockResolvedValueOnce({
      medicationsText: "1: Take amoxicillin",
      // appointmentsText omitted entirely
      warningsText: null,
      timelineText: 42,
      otherText: "",
    });

    const result = await runExtraction(makeOcr(["Take amoxicillin"]));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      medicationsText: "1: Take amoxicillin",
      appointmentsText: "",
      warningsText: "",
      timelineText: "",
      otherText: "",
    });
  });

  it("falls back to keyword-based sectioning when the model call throws", async () => {
    callJsonMock.mockRejectedValueOnce(new Error("rate limited"));

    const result = await runExtraction(
      makeOcr([
        "Follow-up with primary care in 1 week.",
        "Seek urgent care for chest pain.",
      ]),
    );

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.confidence).toBe(65);
    expect(result.data?.appointmentsText).toContain("1: Follow-up");
    expect(result.data?.warningsText).toContain("2: Seek urgent care");
  });
});

import { describe, it, expect, vi } from "vitest";
import type { OcrResult } from "@discharge/shared-types";

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

  it("returns a failed StageResult when the model call throws", async () => {
    callJsonMock.mockRejectedValueOnce(new Error("rate limited"));

    const result = await runExtraction(makeOcr(["some text"]));

    expect(result.success).toBe(false);
    expect(result.error).toBe("rate limited");
  });
});

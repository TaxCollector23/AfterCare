import { describe, it, expect, vi } from "vitest";
import type { OcrResult } from "@discharge/shared-types";

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));

import { generateExplanations } from "../../src/pipeline/explanationGenerator.js";

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join("\n"),
    pageCount: 1,
  };
}

describe("generateExplanations", () => {
  it("caps confidence when the model cites a nonexistent line number", async () => {
    callJsonMock.mockResolvedValueOnce({
      explanations: [
        {
          term: "anticoagulant",
          plainText: "A blood thinner.",
          sourceLines: [99],
          confidence: 90,
        },
      ],
    });
    const result = await generateExplanations(
      makeOcr(["Start anticoagulant therapy"]),
    );
    expect(result.data?.[0].sourceLines).toEqual([]);
    expect(result.data?.[0].confidence).toBeLessThanOrEqual(50);
  });

  it("defaults a missing explanations array to empty with full confidence", async () => {
    callJsonMock.mockResolvedValueOnce({});
    const result = await generateExplanations(
      makeOcr(["plain text, no jargon"]),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.confidence).toBe(100);
  });
});

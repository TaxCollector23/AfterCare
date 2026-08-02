import { describe, it, expect, vi } from "vitest";
import type { OcrResult } from "../../src/pipeline/types.js";

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));

import {
  applyJudgeVerdicts,
  judgeConfidence,
  judgeFindings,
  type FindingsInput,
  type JudgeReport,
} from "../../src/pipeline/judge.js";

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join("\n"),
    pageCount: 1,
  };
}

function makeFindings(): FindingsInput {
  return {
    medications: [
      {
        id: "m1",
        name: "Amoxicillin",
        dose: "500mg",
        frequency: "twice daily",
        timing: "",
        instructions: "",
        sourceLines: [1],
        confidence: 95,
      },
      {
        id: "m2",
        name: "Oxycodone",
        dose: "5mg",
        frequency: "as needed",
        timing: "",
        instructions: "",
        sourceLines: [2],
        confidence: 90,
      },
    ],
    appointments: [],
    warnings: [],
  };
}

const ocr = makeOcr([
  "Amoxicillin 500mg twice daily",
  "Oxycodone 5mg as needed",
]);

describe("judgeFindings", () => {
  it("skips the LLM call entirely when there are no findings", async () => {
    const result = await judgeFindings(ocr, {
      medications: [],
      appointments: [],
      warnings: [],
    });
    expect(result.success).toBe(true);
    expect(result.data?.overall).toBe("pass");
    expect(result.confidence).toBe(100);
    expect(callJsonMock).not.toHaveBeenCalled();
  });

  it("passes through a clean all-pass verdict", async () => {
    callJsonMock.mockResolvedValueOnce({
      overall: "pass",
      summary: "Everything is supported.",
      verdicts: [
        {
          id: "m1",
          verdict: "pass",
          reason: "Supported",
          correctedConfidence: 96,
        },
        {
          id: "m2",
          verdict: "pass",
          reason: "Supported",
          correctedConfidence: 92,
        },
      ],
    });
    const result = await judgeFindings(ocr, makeFindings());
    expect(result.success).toBe(true);
    expect(result.data?.overall).toBe("pass");
    expect(result.confidence).toBe(100);
  });

  it("normalizes bad verdict kinds and fills in missing verdicts as review", async () => {
    callJsonMock.mockResolvedValueOnce({
      overall: "review",
      summary: "One item unclear.",
      verdicts: [
        // m1 has an invalid verdict kind
        { id: "m1", verdict: "bogus", reason: "bad", correctedConfidence: 42 },
        // m2 is missing entirely
      ],
    });
    const result = await judgeFindings(ocr, makeFindings());
    expect(result.success).toBe(true);
    const verdicts = result.data?.verdicts ?? [];
    expect(verdicts).toHaveLength(2);
    expect(verdicts.find((v) => v.id === "m1")).toMatchObject({
      verdict: "review",
      correctedConfidence: 42,
    });
    expect(verdicts.find((v) => v.id === "m2")).toMatchObject({
      verdict: "review",
    });
  });

  it("ignores verdicts for ids the pipeline never emitted", async () => {
    callJsonMock.mockResolvedValueOnce({
      overall: "review",
      verdicts: [
        {
          id: "ghost",
          verdict: "fail",
          reason: "not real",
          correctedConfidence: 0,
        },
        { id: "m1", verdict: "pass", reason: "", correctedConfidence: 90 },
      ],
    });
    const result = await judgeFindings(ocr, makeFindings());
    expect(result.success).toBe(true);
    const verdicts = result.data?.verdicts ?? [];
    expect(verdicts).toHaveLength(2);
    expect(verdicts.some((v) => v.id === "ghost")).toBe(false);
  });

  it("degrades gracefully to a failed StageResult when the model call throws", async () => {
    callJsonMock.mockRejectedValueOnce(new Error("judge provider down"));
    const result = await judgeFindings(ocr, makeFindings());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/judge provider down/);
  });
});

describe("applyJudgeVerdicts", () => {
  it("drops failed findings and keeps passes unchanged", () => {
    const report: JudgeReport = {
      overall: "review",
      summary: "",
      verdicts: [
        { id: "m1", verdict: "pass", reason: "", correctedConfidence: 95 },
        {
          id: "m2",
          verdict: "fail",
          reason: "Hallucination",
          correctedConfidence: 5,
        },
      ],
    };
    const judged = applyJudgeVerdicts(makeFindings(), report);
    expect(judged.medications.map((m) => m.id)).toEqual(["m1"]);
    expect(judged.medications[0]?.confidence).toBe(95);
    expect(judged.reviewReasons).toContain("Hallucination");
  });

  it("caps review findings below the review threshold", () => {
    const report: JudgeReport = {
      overall: "review",
      summary: "",
      verdicts: [
        {
          id: "m1",
          verdict: "review",
          reason: "Unclear",
          correctedConfidence: 50,
        },
      ],
    };
    const judged = applyJudgeVerdicts(makeFindings(), report);
    const med = judged.medications.find((m) => m.id === "m1");
    expect(med?.confidence).toBeLessThan(80);
    // Unmentioned findings are kept untouched.
    expect(judged.medications.find((m) => m.id === "m2")?.confidence).toBe(90);
  });

  it("keeps everything when verdicts are empty (judge returned nothing)", () => {
    const report: JudgeReport = { overall: "pass", summary: "", verdicts: [] };
    const judged = applyJudgeVerdicts(makeFindings(), report);
    expect(judged.medications).toHaveLength(2);
    expect(judged.reviewReasons).toEqual([]);
  });
});

describe("judgeConfidence", () => {
  it("is 100 for a clean pass and below the review threshold otherwise", () => {
    expect(
      judgeConfidence({ overall: "pass", summary: "", verdicts: [] }),
    ).toBe(100);
    expect(
      judgeConfidence({ overall: "review", summary: "", verdicts: [] }),
    ).toBeLessThan(80);
  });
});

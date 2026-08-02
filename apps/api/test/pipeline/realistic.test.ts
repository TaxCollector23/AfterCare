/**
 * End-to-end pipeline test against the real AfterCare broadsheet fixture.
 *
 * The AI adapters are mocked, but every pipeline stage (OCR input shape,
 * extraction, detection, timeline, explanations, and the judge) runs for
 * real against realistic discharge-guide content, so this exercises the full
 * stage wiring including the judge's apply/drop behavior.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, type OcrResult } from "../../src/pipeline/types.js";

const { callJsonMock, runOcrMock } = vi.hoisted(() => ({
  callJsonMock: vi.fn(),
  runOcrMock: vi.fn(),
}));

vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));
vi.mock("../../src/pipeline/ocr.js", () => ({ runOcr: runOcrMock }));

import { runPipeline } from "../../src/pipeline/index.js";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/broadsheet-text.txt",
);

function fixtureOcr(): OcrResult {
  const text = readFileSync(FIXTURE_PATH, "utf8");
  const lines = text.split("\n").map((lineText, idx) => ({
    line: idx + 1,
    text: lineText,
    confidence: 99,
  }));
  return { lines, text, pageCount: 1 };
}

function stageAwareMock(judgeVerdicts: Record<string, unknown>[]) {
  callJsonMock.mockImplementation(
    async ({ system, user }: { system: string; user: string }) => {
      if (system.includes("triage assistant")) {
        return {
          medicationsText:
            "35: Medications\n154: Medications\n156: 4 active prescriptions",
          appointmentsText:
            "12: Appointments\n37: Appointments\n148: Cardiology follow-up Thursday 9:45 AM",
          warningsText: "122: Fever over 101°F",
          timelineText:
            "180: Day 7: Suture check with home health nurse. Day 14: Follow-up with Dr. Marsh.",
          otherText: "",
        };
      }
      if (system.includes("medication information")) {
        return {
          medications: [
            {
              name: "Amoxicillin",
              dose: "500mg",
              frequency: "twice daily",
              timing: "",
              instructions: "",
              sourceLines: [156],
              confidence: 90,
            },
          ],
        };
      }
      if (system.includes("follow-up appointment information")) {
        return { appointments: [] };
      }
      if (system.includes("emergency warning signs")) {
        return { warnings: [] };
      }
      if (system.includes("recovery timeline")) {
        return { timeline: [] };
      }
      if (system.includes("medical jargon")) {
        return { explanations: [] };
      }
      if (system.includes("independent medical-information verifier")) {
        // The judge payload embeds the findings JSON, so we can target the
        // real (runtime-generated) finding ids and return one verdict each.
        const ids = [...user.matchAll(/"id":"([^"]+)"/g)].map((m) => m[1]);
        const verdicts = ids.map((id) =>
          judgeVerdicts.length > 0
            ? { id, ...judgeVerdicts[0] }
            : {
                id,
                verdict: "pass",
                reason: "Supported by source.",
                correctedConfidence: 95,
              },
        );
        return {
          overall:
            verdicts.length > 0 && verdicts.every((v) => v.verdict === "pass")
              ? "pass"
              : "review",
          summary: "Verification complete.",
          verdicts,
        };
      }
      return {};
    },
  );
}

describe("runPipeline against the real broadsheet fixture", () => {
  it("runs every stage in order and surfaces the judge stage", async () => {
    const ocr = fixtureOcr();
    runOcrMock.mockResolvedValue(
      ok(
        ocr,
        99,
        ocr.lines.map((l) => l.line),
      ),
    );
    stageAwareMock([]);

    const events: string[] = [];
    const plan = await runPipeline(
      {
        documentId: "doc-real",
        buffer: Buffer.from("fixture"),
        mimeType: "application/pdf",
      },
      (e) => events.push(`${e.stage}:${e.status}`),
    );

    expect(events).toEqual([
      "ocr:started",
      "ocr:done",
      "extract:started",
      "extract:done",
      "meds:started",
      "meds:done",
      "appts:started",
      "appts:done",
      "warnings:started",
      "warnings:done",
      "timeline:started",
      "timeline:done",
      "explain:started",
      "explain:done",
      "judge:started",
      "judge:done",
    ]);
    expect(plan.medications).toHaveLength(1);
    expect(plan.medications[0]?.name).toBe("Amoxicillin");
    // Grounded citations point at lines that exist in the fixture (220 lines).
    expect(plan.medications[0]?.sourceLines).toEqual([156]);
    expect(plan.overallConfidence).toBe(90);
  });

  it("drops a medication the judge flags as a hallucination", async () => {
    const ocr = fixtureOcr();
    runOcrMock.mockResolvedValue(
      ok(
        ocr,
        99,
        ocr.lines.map((l) => l.line),
      ),
    );
    stageAwareMock([
      { verdict: "fail", reason: "Not in source.", correctedConfidence: 10 },
    ]);

    const plan = await runPipeline(
      {
        documentId: "doc-real-2",
        buffer: Buffer.from("fixture"),
        mimeType: "application/pdf",
      },
      () => {},
    );

    expect(plan.medications).toEqual([]);
    // The review verdict lands the whole plan below the review threshold.
    expect(plan.overallConfidence).toBeLessThan(80);
  });
});

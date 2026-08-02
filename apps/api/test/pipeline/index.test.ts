import { describe, it, expect, vi } from "vitest";
import { ok, fail } from "@discharge/shared-types";

const ocrResult = ok(
  {
    lines: [{ line: 1, text: "Amoxicillin 500mg twice daily", confidence: 95 }],
    text: "x",
    pageCount: 1,
  },
  95,
  [1],
);
const extractionResult = ok(
  {
    medicationsText: "1: Amoxicillin",
    appointmentsText: "",
    warningsText: "",
    timelineText: "",
    otherText: "",
  },
  90,
  [1],
);

vi.mock("../../src/pipeline/ocr.js", () => ({
  runOcr: vi.fn(async () => ocrResult),
}));
vi.mock("../../src/pipeline/extraction.js", () => ({
  runExtraction: vi.fn(async () => extractionResult),
}));
vi.mock("../../src/pipeline/medicationDetection.js", () => ({
  detectMedications: vi.fn(async () =>
    ok(
      [
        {
          id: "m1",
          name: "Amoxicillin",
          dose: "500mg",
          frequency: "twice daily",
          timing: "",
          instructions: "",
          sourceLines: [1],
          confidence: 92,
        },
      ],
      92,
      [1],
    ),
  ),
}));
vi.mock("../../src/pipeline/appointmentDetection.js", () => ({
  detectAppointments: vi.fn(async () => fail("appointment detection down")),
}));
vi.mock("../../src/pipeline/warningDetection.js", () => ({
  detectWarnings: vi.fn(async () => ok([], 100, [])),
}));
vi.mock("../../src/pipeline/timelineBuilder.js", () => ({
  buildTimeline: vi.fn(async () => ok([], 100, [])),
}));
vi.mock("../../src/pipeline/explanationGenerator.js", () => ({
  generateExplanations: vi.fn(async () => ok([], 100, [])),
}));

import { runPipeline } from "../../src/pipeline/index.js";

describe("runPipeline", () => {
  it("runs every stage in order, emits progress, and degrades gracefully on a failed detection stage", async () => {
    const events: unknown[] = [];
    const plan = await runPipeline(
      {
        documentId: "doc1",
        buffer: Buffer.from(""),
        mimeType: "application/pdf",
      },
      (e) => events.push(e),
    );

    expect(plan.documentId).toBe("doc1");
    expect(plan.medications).toHaveLength(1);
    // The failed appointments stage degrades to an empty array, not a thrown error.
    expect(plan.appointments).toEqual([]);
    // Overall confidence reflects the worst stage — the failed one (confidence 0).
    expect(plan.overallConfidence).toBe(0);

    const stages = events.map((e: any) => `${e.stage}:${e.status}`);
    expect(stages).toEqual([
      "ocr:started",
      "ocr:done",
      "extract:started",
      "extract:done",
      "meds:started",
      "meds:done",
      "appts:started",
      "appts:error",
      "warnings:started",
      "warnings:done",
      "timeline:started",
      "timeline:done",
      "explain:started",
      "explain:done",
    ]);
  });

  it("throws when OCR fails outright, without running later stages", async () => {
    const { runOcr } = await import("../../src/pipeline/ocr.js");
    (runOcr as any).mockResolvedValueOnce(fail("unreadable file"));

    await expect(
      runPipeline(
        {
          documentId: "doc2",
          buffer: Buffer.from(""),
          mimeType: "application/pdf",
        },
        () => {},
      ),
    ).rejects.toThrow("unreadable file");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { callJsonMock, visionTranscribeMock } = vi.hoisted(() => ({
  callJsonMock: vi.fn(),
  visionTranscribeMock: vi.fn(),
}));

vi.mock("../../src/integrations/openai.js", () => ({
  callJson: callJsonMock,
  visionTranscribe: visionTranscribeMock,
}));

import { runPipeline } from "../../src/pipeline/index.js";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/john-doe-report.pdf",
);

describe("heuristic fallback pipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    callJsonMock.mockRejectedValue(new Error("AI provider unavailable"));
  });

  it("turns the John Doe PDF into a useful plan when AI extraction is unavailable", async () => {
    const events: Array<{
      stage: string;
      status: string;
      confidence?: number;
    }> = [];
    const plan = await runPipeline(
      {
        documentId: "john-doe",
        buffer: readFileSync(FIXTURE_PATH),
        mimeType: "application/pdf",
      },
      (event) => events.push(event),
    );

    expect(visionTranscribeMock).not.toHaveBeenCalled();
    expect(callJsonMock).toHaveBeenCalled();
    expect(plan.documentId).toBe("john-doe");
    expect(plan.medications).toEqual([]);
    expect(plan.appointments).toEqual([
      expect.objectContaining({
        date: null,
        dateText: "in 1 week",
        specialty: "Primary care",
        sourceLines: [9],
      }),
    ]);
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symptom: "worsening shortness of breath",
          severity: "emergency",
          sourceLines: [9, 10, 11],
        }),
        expect.objectContaining({
          symptom: "chest pain",
          severity: "emergency",
        }),
        expect.objectContaining({
          symptom: "persistent fever",
          severity: "emergency",
        }),
      ]),
    );
    expect(plan.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Complete prescribed antibiotics" }),
        expect.objectContaining({ title: "Practice breathing exercises" }),
        expect.objectContaining({ title: "Monitor symptoms" }),
      ]),
    );
    expect(plan.explanations.map((explanation) => explanation.term)).toEqual(
      expect.arrayContaining([
        "community-acquired pneumonia",
        "hypoxemia",
        "oxygen saturation",
      ]),
    );
    expect(plan.overallConfidence).toBe(65);

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "extract",
          status: "done",
          confidence: 65,
        }),
        expect.objectContaining({
          stage: "warnings",
          status: "done",
          confidence: 65,
        }),
        expect.objectContaining({ stage: "judge", status: "error" }),
      ]),
    );
  });
});

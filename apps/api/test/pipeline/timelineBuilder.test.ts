import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/integrations/openai.js", () => ({
  callJson: vi.fn(async () => ({
    timeline: [
      {
        bucket: "today",
        title: "Take first dose of antibiotics",
        detail: "With food, as prescribed.",
        sourceLines: [12],
        confidence: 92,
      },
    ],
  })),
}));

import { buildTimeline } from "../../src/pipeline/timelineBuilder.js";

describe("buildTimeline", () => {
  it("returns an empty, fully-confident result when there is nothing to bucket", async () => {
    const result = await buildTimeline("", {
      medications: [],
      appointments: [],
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.confidence).toBe(100);
  });

  it("maps model output into TimelineEntry objects with generated ids", async () => {
    const result = await buildTimeline("12: Take amoxicillin with food", {
      medications: [],
      appointments: [],
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({
      bucket: "today",
      title: "Take first dose of antibiotics",
      sourceLines: [12],
      confidence: 92,
    });
    expect(result.data?.[0].id).toBeTruthy();
    expect(result.confidence).toBe(92);
  });
});

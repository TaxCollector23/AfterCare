import { describe, it, expect } from "vitest";
import {
  MAX_IN_PROGRESS_PERCENT,
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGE_WEIGHT,
  pipelineProgress,
} from "@discharge-guide/shared-types";

describe("pipeline stage weights", () => {
  it("sums to 100 across every stage", () => {
    const total = PIPELINE_STAGE_ORDER.reduce(
      (sum, stage) => sum + PIPELINE_STAGE_WEIGHT[stage],
      0,
    );
    expect(total).toBe(100);
  });

  it("covers every stage the pipeline emits, in execution order", () => {
    expect(PIPELINE_STAGE_ORDER).toEqual([
      "ocr",
      "extract",
      "meds",
      "appts",
      "warnings",
      "timeline",
      "explain",
      "judge",
    ]);
  });
});

describe("pipelineProgress", () => {
  it("starts at zero with the first stage's caption", () => {
    const result = pipelineProgress({ completed: [] });

    expect(result.percent).toBe(0);
    expect(result.label).toMatch(/Reading the text/);
    expect(result.completedStages).toBe(0);
  });

  it("credits a started stage at half weight", () => {
    const result = pipelineProgress({ completed: [], current: "ocr" });
    expect(result.percent).toBe(15); // half of ocr's 30
  });

  it("advances as stages complete", () => {
    const early = pipelineProgress({ completed: ["ocr"] });
    const later = pipelineProgress({ completed: ["ocr", "extract", "meds"] });

    expect(early.percent).toBe(30);
    expect(later.percent).toBeGreaterThan(early.percent);
  });

  it("moves further for a heavy stage than a light one", () => {
    const heavy = pipelineProgress({ completed: ["ocr"] });
    const light = pipelineProgress({ completed: ["appts"] });

    expect(heavy.percent).toBeGreaterThan(light.percent);
  });

  it("never reaches 100 while work is outstanding", () => {
    const result = pipelineProgress({ completed: [...PIPELINE_STAGE_ORDER] });
    expect(result.percent).toBeLessThanOrEqual(MAX_IN_PROGRESS_PERCENT);
    expect(result.percent).toBeLessThan(100);
  });

  it("reports 100 only once the pipeline says it finished", () => {
    const result = pipelineProgress({ completed: [], finished: true });

    expect(result.percent).toBe(100);
    expect(result.label).toMatch(/ready/i);
  });

  it("shows the running stage's caption", () => {
    const result = pipelineProgress({ completed: ["ocr"], current: "meds" });
    expect(result.label).toMatch(/medications/i);
  });

  it("ignores unknown stage names rather than inflating the bar", () => {
    const result = pipelineProgress({
      completed: ["ocr", "not-a-stage" as never],
      current: "also-bogus" as never,
    });

    expect(result.percent).toBe(30);
    expect(result.completedStages).toBe(1);
  });

  it("does not double-count a repeated stage event", () => {
    const result = pipelineProgress({ completed: ["ocr", "ocr", "ocr"] });

    expect(result.percent).toBe(30);
    expect(result.completedStages).toBe(1);
  });

  it("does not double-credit a stage that is both completed and current", () => {
    const result = pipelineProgress({ completed: ["ocr"], current: "ocr" });
    expect(result.percent).toBe(30);
  });

  it("increases monotonically through a full run", () => {
    const seen: number[] = [];
    const completed: (typeof PIPELINE_STAGE_ORDER)[number][] = [];
    for (const stage of PIPELINE_STAGE_ORDER) {
      seen.push(pipelineProgress({ completed: [...completed], current: stage }).percent);
      completed.push(stage);
      seen.push(pipelineProgress({ completed: [...completed] }).percent);
    }

    const sorted = [...seen].sort((a, b) => a - b);
    expect(seen).toEqual(sorted);
  });
});

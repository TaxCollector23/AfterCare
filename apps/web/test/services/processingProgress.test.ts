import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearProgress,
  markFinished,
  progressFor,
  recordStageEvent,
  subscribeProgress,
} from "../../src/services/processingProgress";

beforeEach(() => {
  clearProgress("d1");
});

describe("processing progress store", () => {
  it("starts at zero for an unknown document", () => {
    expect(progressFor("unknown").percent).toBe(0);
  });

  it("advances as stages start and complete", () => {
    recordStageEvent("d1", "ocr", "started");
    const started = progressFor("d1").percent;

    recordStageEvent("d1", "ocr", "completed");
    const completed = progressFor("d1").percent;

    expect(started).toBeGreaterThan(0);
    expect(completed).toBeGreaterThan(started);
  });

  it("treats a failed stage as finished work so the bar doesn't stall", () => {
    // The pipeline degrades past a failed stage, so it will never complete.
    recordStageEvent("d1", "ocr", "completed");
    recordStageEvent("d1", "extract", "started");
    recordStageEvent("d1", "extract", "failed");

    expect(progressFor("d1").completedStages).toBe(2);
  });

  it("reaches 100 only when the pipeline reports completion", () => {
    for (const stage of [
      "ocr",
      "extract",
      "meds",
      "appts",
      "warnings",
      "timeline",
      "explain",
      "judge",
    ]) {
      recordStageEvent("d1", stage, "completed");
    }
    expect(progressFor("d1").percent).toBeLessThan(100);

    markFinished("d1");
    expect(progressFor("d1").percent).toBe(100);
  });

  it("keeps separate documents independent", () => {
    recordStageEvent("d1", "ocr", "completed");
    expect(progressFor("d2").percent).toBe(0);
    clearProgress("d2");
  });

  it("ignores an unknown stage name from the wire", () => {
    recordStageEvent("d1", "definitely-not-a-stage", "completed");
    expect(progressFor("d1").percent).toBe(0);
  });

  it("notifies subscribers on each event", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProgress(listener);

    recordStageEvent("d1", "ocr", "started");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    recordStageEvent("d1", "ocr", "completed");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resets a document's progress when cleared", () => {
    recordStageEvent("d1", "ocr", "completed");
    clearProgress("d1");
    expect(progressFor("d1").percent).toBe(0);
  });
});

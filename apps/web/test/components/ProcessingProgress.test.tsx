import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ProcessingProgress } from "../../src/components/ProcessingProgress";
import {
  clearProgress,
  markFinished,
  recordStageEvent,
} from "../../src/services/processingProgress";

/** Advances the easing interval by roughly `ms` of wall clock. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function currentPercent(): number {
  return Number(
    screen.getByRole("progressbar").getAttribute("aria-valuenow"),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  clearProgress("d1");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProcessingProgress", () => {
  it("starts empty and announces itself to assistive tech", () => {
    render(<ProcessingProgress documentId="d1" />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(currentPercent()).toBe(0);
  });

  it("eases toward the target instead of jumping to it", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
      recordStageEvent("d1", "ocr", "completed"); // target 30
    });

    tick(80);
    const firstStep = currentPercent();
    expect(firstStep).toBeGreaterThan(0);
    expect(firstStep).toBeLessThan(30);

    tick(2000);
    expect(currentPercent()).toBeGreaterThan(firstStep);
  });

  it("creeps toward but never past the real target", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
      recordStageEvent("d1", "ocr", "completed"); // target 30
    });

    tick(60_000);
    // Long-running stage: the bar settles just under its target, never beyond.
    expect(currentPercent()).toBeLessThanOrEqual(30);
    expect(currentPercent()).toBeGreaterThan(25);
  });

  it("never shows 100% until the pipeline reports completion", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
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
    });

    tick(60_000);
    expect(currentPercent()).toBeLessThan(100);

    act(() => {
      markFinished("d1");
    });
    tick(60_000);
    expect(currentPercent()).toBe(100);
  });

  it("settles exactly on 100 promptly, not asymptotically near it", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
      markFinished("d1");
    });

    // Proportional easing alone would leave it hovering at 99% for seconds.
    tick(3_000);
    expect(currentPercent()).toBe(100);
  });

  it("captions the stage that is actually running", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
      recordStageEvent("d1", "ocr", "completed");
      recordStageEvent("d1", "meds", "started");
    });
    tick(80);

    expect(screen.getByText(/Finding your medications/)).toBeInTheDocument();
  });

  it("shows the step count as stages complete", () => {
    render(<ProcessingProgress documentId="d1" />);
    act(() => {
      recordStageEvent("d1", "ocr", "completed");
    });
    tick(80);

    expect(screen.getByText(/step 2 of 8/)).toBeInTheDocument();
  });

  it("keeps moving forward across a whole run", () => {
    render(<ProcessingProgress documentId="d1" />);
    const seen: number[] = [];

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
      act(() => {
        recordStageEvent("d1", stage, "started");
      });
      tick(400);
      act(() => {
        recordStageEvent("d1", stage, "completed");
      });
      tick(400);
      seen.push(currentPercent());
    }

    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

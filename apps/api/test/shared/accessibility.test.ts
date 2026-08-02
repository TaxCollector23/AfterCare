import { describe, it, expect } from "vitest";
import {
  ACCESSIBILITY_DEFAULTS,
  LINE_SPACING_VALUE,
  READ_ALOUD_RATE_MAX,
  READ_ALOUD_RATE_MIN,
  TEXT_SCALE_VALUE,
  accessibilityDomAttributes,
  resolveAccessibilityPreferences,
} from "@discharge-guide/shared-types";

describe("resolveAccessibilityPreferences", () => {
  it("falls back to defaults with nothing stored and no system hints", () => {
    expect(resolveAccessibilityPreferences(null)).toEqual(ACCESSIBILITY_DEFAULTS);
  });

  it("adopts OS-level reduced motion on a first visit", () => {
    const result = resolveAccessibilityPreferences(null, {
      prefersReducedMotion: true,
    });
    expect(result.reduceMotion).toBe(true);
  });

  it("adopts an OS-level dark theme and raised contrast", () => {
    const result = resolveAccessibilityPreferences(null, {
      prefersDark: true,
      prefersMoreContrast: true,
    });
    expect(result.darkMode).toBe(true);
    expect(result.contrast).toBe(true);
  });

  it("lets an explicit choice override the system setting", () => {
    // Someone who turned dark mode off in-app must not have it forced back on.
    const result = resolveAccessibilityPreferences(
      { darkMode: false, reduceMotion: false },
      { prefersDark: true, prefersReducedMotion: true },
    );
    expect(result.darkMode).toBe(false);
    expect(result.reduceMotion).toBe(false);
  });

  it("keeps system hints for settings the user never touched", () => {
    const result = resolveAccessibilityPreferences(
      { textScale: "large" },
      { prefersReducedMotion: true },
    );
    expect(result.textScale).toBe("large");
    expect(result.reduceMotion).toBe(true);
  });

  it("ignores an unrecognized text scale from older storage", () => {
    const result = resolveAccessibilityPreferences({ textScale: "enormous" });
    expect(result.textScale).toBe(ACCESSIBILITY_DEFAULTS.textScale);
  });

  it("ignores an unrecognized line spacing", () => {
    const result = resolveAccessibilityPreferences({ lineSpacing: "airy" });
    expect(result.lineSpacing).toBe(ACCESSIBILITY_DEFAULTS.lineSpacing);
  });

  it("ignores non-boolean values for toggles", () => {
    const result = resolveAccessibilityPreferences({
      contrast: "yes",
      largeTargets: 1,
    });
    expect(result.contrast).toBe(false);
    expect(result.largeTargets).toBe(false);
  });

  it("clamps the read-aloud rate into its supported range", () => {
    expect(resolveAccessibilityPreferences({ readAloudRate: 99 }).readAloudRate).toBe(
      READ_ALOUD_RATE_MAX,
    );
    expect(resolveAccessibilityPreferences({ readAloudRate: 0 }).readAloudRate).toBe(
      READ_ALOUD_RATE_MIN,
    );
  });

  it("falls back for a non-numeric read-aloud rate", () => {
    expect(
      resolveAccessibilityPreferences({ readAloudRate: "fast" }).readAloudRate,
    ).toBe(ACCESSIBILITY_DEFAULTS.readAloudRate);
  });

  it("survives junk in storage", () => {
    expect(resolveAccessibilityPreferences("not an object")).toEqual(
      ACCESSIBILITY_DEFAULTS,
    );
    expect(resolveAccessibilityPreferences(42)).toEqual(ACCESSIBILITY_DEFAULTS);
  });

  it("carries every new preference through from storage", () => {
    const result = resolveAccessibilityPreferences({
      underlineLinks: true,
      largeTargets: true,
      lineSpacing: "loose",
    });
    expect(result.underlineLinks).toBe(true);
    expect(result.largeTargets).toBe(true);
    expect(result.lineSpacing).toBe("loose");
  });
});

describe("accessibilityDomAttributes", () => {
  it("maps preferences onto the attributes the stylesheet keys off", () => {
    const attributes = accessibilityDomAttributes({
      ...ACCESSIBILITY_DEFAULTS,
      contrast: true,
      reduceMotion: true,
      underlineLinks: true,
      largeTargets: true,
    });

    expect(attributes).toMatchObject({
      "data-contrast": "true",
      "data-motion": "reduced",
      "data-underline": "true",
      "data-targets": "large",
    });
  });

  it("clears the valued attributes when the preference is off", () => {
    const attributes = accessibilityDomAttributes(ACCESSIBILITY_DEFAULTS);
    expect(attributes["data-motion"]).toBe("");
    expect(attributes["data-targets"]).toBe("");
  });
});

describe("scale tables", () => {
  it("has a CSS value for every text scale and line spacing", () => {
    expect(Object.keys(TEXT_SCALE_VALUE).sort()).toEqual([
      "large",
      "largest",
      "normal",
    ]);
    expect(Object.keys(LINE_SPACING_VALUE).sort()).toEqual([
      "loose",
      "normal",
      "relaxed",
    ]);
  });

  it("increases monotonically", () => {
    expect(Number(TEXT_SCALE_VALUE.large)).toBeGreaterThan(
      Number(TEXT_SCALE_VALUE.normal),
    );
    expect(Number(TEXT_SCALE_VALUE.largest)).toBeGreaterThan(
      Number(TEXT_SCALE_VALUE.large),
    );
    expect(Number(LINE_SPACING_VALUE.relaxed)).toBeGreaterThan(
      Number(LINE_SPACING_VALUE.normal),
    );
    expect(Number(LINE_SPACING_VALUE.loose)).toBeGreaterThan(
      Number(LINE_SPACING_VALUE.relaxed),
    );
  });
});

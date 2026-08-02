/**
 * Accessibility preferences, resolved from three sources in priority order:
 *
 *   1. what the user explicitly chose (stored on their device)
 *   2. what their operating system already says they need
 *   3. the app defaults
 *
 * The middle step matters: someone who has turned on "reduce motion" or a dark
 * theme at the OS level has already told us what they need, and making them say
 * it again in a second settings screen is the accessibility failure this module
 * exists to avoid. An explicit in-app choice still wins, so toggling something
 * off here is never silently overridden by the system on the next visit.
 */

export type TextScale = "normal" | "large" | "largest";
export type LineSpacing = "normal" | "relaxed" | "loose";

export interface AccessibilityPreferences {
  textScale: TextScale;
  lineSpacing: LineSpacing;
  contrast: boolean;
  darkMode: boolean;
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  /** Underline every link, so colour is never the only cue (WCAG 1.4.1). */
  underlineLinks: boolean;
  /** Enforce a 48px minimum hit area on controls (WCAG 2.5.8). */
  largeTargets: boolean;
  readAloudRate: number;
}

export const ACCESSIBILITY_DEFAULTS: AccessibilityPreferences = {
  textScale: "normal",
  lineSpacing: "normal",
  contrast: false,
  darkMode: false,
  reduceMotion: false,
  dyslexiaFont: false,
  underlineLinks: false,
  largeTargets: false,
  readAloudRate: 0.95,
};

/** What the browser reports about the user's OS-level settings. */
export interface SystemPreferences {
  prefersReducedMotion?: boolean;
  prefersDark?: boolean;
  prefersMoreContrast?: boolean;
}

export const TEXT_SCALE_VALUE: Record<TextScale, string> = {
  normal: "1",
  large: "1.15",
  largest: "1.35",
};

export const LINE_SPACING_VALUE: Record<LineSpacing, string> = {
  normal: "1.6",
  relaxed: "1.85",
  loose: "2.1",
};

export const READ_ALOUD_RATE_MIN = 0.6;
export const READ_ALOUD_RATE_MAX = 1.4;

const TEXT_SCALES: TextScale[] = ["normal", "large", "largest"];
const LINE_SPACINGS: LineSpacing[] = ["normal", "relaxed", "loose"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function rateOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(READ_ALOUD_RATE_MAX, Math.max(READ_ALOUD_RATE_MIN, n));
}

/**
 * Merges stored preferences over system hints over defaults.
 *
 * Stored input is untrusted (it is whatever is in localStorage, possibly from an
 * older build), so every field is validated rather than spread in blindly.
 */
export function resolveAccessibilityPreferences(
  stored: unknown,
  system: SystemPreferences = {},
): AccessibilityPreferences {
  const base: AccessibilityPreferences = {
    ...ACCESSIBILITY_DEFAULTS,
    reduceMotion: system.prefersReducedMotion ?? ACCESSIBILITY_DEFAULTS.reduceMotion,
    darkMode: system.prefersDark ?? ACCESSIBILITY_DEFAULTS.darkMode,
    contrast: system.prefersMoreContrast ?? ACCESSIBILITY_DEFAULTS.contrast,
  };

  if (!isRecord(stored)) return base;

  return {
    textScale: TEXT_SCALES.includes(stored.textScale as TextScale)
      ? (stored.textScale as TextScale)
      : base.textScale,
    lineSpacing: LINE_SPACINGS.includes(stored.lineSpacing as LineSpacing)
      ? (stored.lineSpacing as LineSpacing)
      : base.lineSpacing,
    contrast: boolOr(stored.contrast, base.contrast),
    darkMode: boolOr(stored.darkMode, base.darkMode),
    reduceMotion: boolOr(stored.reduceMotion, base.reduceMotion),
    dyslexiaFont: boolOr(stored.dyslexiaFont, base.dyslexiaFont),
    underlineLinks: boolOr(stored.underlineLinks, base.underlineLinks),
    largeTargets: boolOr(stored.largeTargets, base.largeTargets),
    readAloudRate: rateOr(stored.readAloudRate, base.readAloudRate),
  };
}

/** The `data-*` attributes and custom properties the stylesheet keys off. */
export function accessibilityDomAttributes(
  preferences: AccessibilityPreferences,
): Record<string, string> {
  return {
    "data-contrast": String(preferences.contrast),
    "data-dark": String(preferences.darkMode),
    "data-motion": preferences.reduceMotion ? "reduced" : "",
    "data-dyslexia": String(preferences.dyslexiaFont),
    "data-underline": String(preferences.underlineLinks),
    "data-targets": preferences.largeTargets ? "large" : "",
  };
}

export const TEXT_SCALE_LABEL: Record<TextScale, string> = {
  normal: "A",
  large: "A+",
  largest: "A++",
};

export const LINE_SPACING_LABEL: Record<LineSpacing, string> = {
  normal: "Standard",
  relaxed: "Relaxed",
  loose: "Loose",
};

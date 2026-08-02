import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import React from "react";
import {
  ACCESSIBILITY_DEFAULTS,
  LINE_SPACING_VALUE,
  TEXT_SCALE_VALUE,
  accessibilityDomAttributes,
  resolveAccessibilityPreferences,
  type AccessibilityPreferences,
  type SystemPreferences,
} from "@discharge-guide/shared-types";

const STORAGE_KEY = "aftercare:accessibility";

interface Ctx extends AccessibilityPreferences {
  update: (patch: Partial<AccessibilityPreferences>) => void;
}

const AccessibilityContext = createContext<Ctx | null>(null);

/** Reads the OS-level settings the browser exposes. Safe when unsupported. */
function readSystemPreferences(): SystemPreferences {
  if (typeof window === "undefined" || !window.matchMedia) return {};
  const query = (value: string) => {
    try {
      return window.matchMedia(value).matches;
    } catch {
      return undefined;
    }
  };
  return {
    prefersReducedMotion: query("(prefers-reduced-motion: reduce)"),
    prefersDark: query("(prefers-color-scheme: dark)"),
    prefersMoreContrast: query("(prefers-contrast: more)"),
  };
}

function applyToDom(state: AccessibilityPreferences) {
  const root = document.documentElement;
  root.style.setProperty("--scale", TEXT_SCALE_VALUE[state.textScale]);
  root.style.setProperty("--line-height", LINE_SPACING_VALUE[state.lineSpacing]);
  for (const [attribute, value] of Object.entries(
    accessibilityDomAttributes(state),
  )) {
    root.setAttribute(attribute, value);
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessibilityPreferences>(
    ACCESSIBILITY_DEFAULTS,
  );

  useEffect(() => {
    let stored: unknown = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
    // System settings seed the first visit; an explicit stored choice wins.
    const next = resolveAccessibilityPreferences(stored, readSystemPreferences());
    setState(next);
    applyToDom(next);
  }, []);

  function update(patch: Partial<AccessibilityPreferences>) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyToDom(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — the setting still applies for this session */
      }
      return next;
    });
  }

  return React.createElement(
    AccessibilityContext.Provider,
    { value: { ...state, update } },
    children,
  );
}

export function useAccessibility(): Ctx {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}

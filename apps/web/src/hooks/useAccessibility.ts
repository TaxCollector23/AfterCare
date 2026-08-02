import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import React from "react";

interface AccessibilityState {
  textScale: "normal" | "large" | "largest";
  contrast: boolean;
  darkMode: boolean;
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  readAloudRate: number;
}

const DEFAULTS: AccessibilityState = {
  textScale: "normal",
  contrast: false,
  darkMode: false,
  reduceMotion: false,
  dyslexiaFont: false,
  readAloudRate: 0.95,
};

const STORAGE_KEY = "aftercare:accessibility";
const SCALE_MAP: Record<AccessibilityState["textScale"], string> = { normal: "1", large: "1.15", largest: "1.35" };

interface Ctx extends AccessibilityState {
  update: (patch: Partial<AccessibilityState>) => void;
}

const AccessibilityContext = createContext<Ctx | null>(null);

function applyToDom(state: AccessibilityState) {
  const root = document.documentElement;
  root.style.setProperty("--scale", SCALE_MAP[state.textScale]);
  root.setAttribute("data-contrast", String(state.contrast));
  root.setAttribute("data-dark", String(state.darkMode));
  root.setAttribute("data-motion", state.reduceMotion ? "reduced" : "");
  root.setAttribute("data-dyslexia", String(state.dyslexiaFont));
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const next = { ...DEFAULTS, ...JSON.parse(raw) };
        setState(next);
        applyToDom(next);
      } else {
        applyToDom(DEFAULTS);
      }
    } catch {
      applyToDom(DEFAULTS);
    }
  }, []);

  function update(patch: Partial<AccessibilityState>) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyToDom(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return React.createElement(AccessibilityContext.Provider, { value: { ...state, update } }, children);
}

export function useAccessibility(): Ctx {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}

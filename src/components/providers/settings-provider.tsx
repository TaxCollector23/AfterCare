"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type Contrast = "normal" | "high";
type TextSize = "normal" | "large";
type Motion = "system" | "reduced";

interface SettingsState {
  theme: Theme;
  contrast: Contrast;
  textSize: TextSize;
  motion: Motion;
}

interface SettingsContextValue extends SettingsState {
  setTheme: (v: Theme) => void;
  setContrast: (v: Contrast) => void;
  setTextSize: (v: TextSize) => void;
  setMotion: (v: Motion) => void;
}

const DEFAULTS: SettingsState = {
  theme: "system",
  contrast: "normal",
  textSize: "normal",
  motion: "system",
};

const STORAGE_KEY = "aftercare:settings";

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyToDom(state: SettingsState) {
  const root = document.documentElement;
  if (state.theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", state.theme);
  }
  if (state.contrast === "high") {
    root.setAttribute("data-contrast", "high");
  } else {
    root.removeAttribute("data-contrast");
  }
  if (state.textSize === "large") {
    root.setAttribute("data-text-size", "large");
  } else {
    root.removeAttribute("data-text-size");
  }
  if (state.motion === "reduced") {
    root.setAttribute("data-motion", "reduced");
  } else {
    root.removeAttribute("data-motion");
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        const next = { ...DEFAULTS, ...parsed };
        // One-time hydration from localStorage on mount (inline script already
        // applied DOM attrs pre-paint; this syncs React state to match).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(next);
        applyToDom(next);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const update = useCallback((patch: Partial<SettingsState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyToDom(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  const value: SettingsContextValue = {
    ...state,
    setTheme: (theme) => update({ theme }),
    setContrast: (contrast) => update({ contrast }),
    setTextSize: (textSize) => update({ textSize }),
    setMotion: (motion) => update({ motion }),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

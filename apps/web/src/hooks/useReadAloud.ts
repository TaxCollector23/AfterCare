import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reads the current page's visible text aloud via SpeechSynthesis. Deliberately simple:
 * one button reads everything inside <main>, top to bottom — no per-element click-to-read
 * mode, since AfterCare's header now exposes exactly one control for this feature.
 */
export function useReadAloud(rate = 0.95) {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const readPage = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const main = document.querySelector("main.content");
    const text = (main?.textContent ?? document.body.innerText ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 6000));
    utterance.rate = rate;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [rate]);

  const toggle = useCallback(() => {
    if (speaking) stop();
    else readPage();
  }, [speaking, readPage, stop]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { speaking, toggle };
}

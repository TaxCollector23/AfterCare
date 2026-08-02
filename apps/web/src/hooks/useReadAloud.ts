import { useCallback, useEffect, useRef, useState } from "react";
import { speak, stopSpeaking } from "../services/tts";

/**
 * Reads the current page's visible text aloud. Uses whichever TTS provider is
 * configured (see services/tts.ts) — ElevenLabs or Google Cloud TTS if a key is set,
 * otherwise the browser's built-in voice. One button, reads everything inside <main>.
 */
export function useReadAloud(rate = 0.95) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const stop = useCallback(() => {
    requestId.current += 1; // invalidate any in-flight speak() loop
    stopSpeaking();
    setSpeaking(false);
  }, []);

  const readPage = useCallback(async () => {
    const main = document.querySelector("main.content");
    const text = (main?.textContent ?? document.body.innerText ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;

    const myRequest = ++requestId.current;
    setError(null);
    setSpeaking(true);
    try {
      await speak(text, rate);
    } catch (err) {
      if (myRequest === requestId.current) {
        setError(err instanceof Error ? err.message : "Couldn't read this page aloud.");
      }
    } finally {
      if (myRequest === requestId.current) setSpeaking(false);
    }
  }, [rate]);

  const toggle = useCallback(() => {
    if (speaking) stop();
    else readPage();
  }, [speaking, readPage, stop]);

  useEffect(() => () => stopSpeaking(), []);

  return { speaking, error, toggle };
}

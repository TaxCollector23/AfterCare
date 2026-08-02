/**
 * Text-to-speech, provider-pluggable. Picks the best available option based on which
 * API keys are configured (see .env.example), and always falls back to the browser's
 * built-in SpeechSynthesis so "read this page to me" works with zero setup.
 *
 * Priority: ElevenLabs > Google Cloud TTS > browser SpeechSynthesis.
 */

export type TtsProvider = "elevenlabs" | "google" | "browser";

const ELEVENLABS_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const ELEVENLABS_VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) || "21m00Tcm4TlvDq8ikWAM";
const GOOGLE_TTS_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY as string | undefined;

export const activeTtsProvider: TtsProvider = ELEVENLABS_KEY ? "elevenlabs" : GOOGLE_TTS_KEY ? "google" : "browser";

export const ttsProviderLabel: Record<TtsProvider, string> = {
  elevenlabs: "ElevenLabs",
  google: "Google Cloud Text-to-Speech",
  browser: "your browser's built-in voice",
};

interface SpeechHandle {
  stop: () => void;
  onEnd: (cb: () => void) => void;
}

let currentAudio: HTMLAudioElement | null = null;

function stopBrowserSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function stopAudioElement() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

export function stopSpeaking(): void {
  stopBrowserSpeech();
  stopAudioElement();
}

async function speakWithElevenLabs(text: string): Promise<SpeechHandle> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5" }),
  });
  if (!res.ok) throw new Error(`ElevenLabs request failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  const endCallbacks: (() => void)[] = [];
  audio.onended = () => {
    URL.revokeObjectURL(url);
    endCallbacks.forEach((cb) => cb());
  };
  await audio.play();
  return { stop: () => stopAudioElement(), onEnd: (cb) => endCallbacks.push(cb) };
}

async function speakWithGoogleTts(text: string, rate: number): Promise<SpeechHandle> {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
    }),
  });
  if (!res.ok) throw new Error(`Google Cloud TTS request failed (${res.status})`);
  const { audioContent } = (await res.json()) as { audioContent: string };
  const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
  currentAudio = audio;
  const endCallbacks: (() => void)[] = [];
  audio.onended = () => endCallbacks.forEach((cb) => cb());
  await audio.play();
  return { stop: () => stopAudioElement(), onEnd: (cb) => endCallbacks.push(cb) };
}

function speakWithBrowser(text: string, rate: number): SpeechHandle {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  const endCallbacks: (() => void)[] = [];
  utterance.onend = () => endCallbacks.forEach((cb) => cb());
  utterance.onerror = () => endCallbacks.forEach((cb) => cb());
  window.speechSynthesis.speak(utterance);
  return { stop: stopBrowserSpeech, onEnd: (cb) => endCallbacks.push(cb) };
}

/** Speaks `text` aloud using whichever provider is configured, chunked to stay under
 *  each API's request-size limits. Resolves once playback has ended (or been stopped). */
export async function speak(text: string, rate = 0.95): Promise<void> {
  stopSpeaking();
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return;

  // Long documents are chunked into sentence-ish groups so a single request/utterance
  // doesn't hit provider length limits (ElevenLabs/Google cap request text length).
  const chunks = chunkText(trimmed, activeTtsProvider === "browser" ? 6000 : 1800);

  for (const chunk of chunks) {
    const handle: SpeechHandle =
      activeTtsProvider === "elevenlabs"
        ? await speakWithElevenLabs(chunk)
        : activeTtsProvider === "google"
        ? await speakWithGoogleTts(chunk, rate)
        : speakWithBrowser(chunk, rate);

    await new Promise<void>((resolve) => handle.onEnd(resolve));
  }
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

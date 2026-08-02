/**
 * LLM client wrapper used by every pipeline stage.
 *
 * Split responsibilities:
 * - JSON/Text (extraction, detection, explanations, /ask): OpenAI -> OpenRouter (2 keys)
 * - Vision/Images (OCR, image transcription): Gemini (2 keys)
 *
 * Each provider gets its own retry/backoff; if a provider's retries are
 * exhausted (or it's not configured — missing API key), the waterfall moves
 * to the next one. Only throws once every configured provider has failed.
 *
 * Env vars: OPENAI_API_KEY, GEMINI_API_KEY, GEMINI_API_KEY_2,
 * OPENROUTER_API_KEY, OPENROUTER_API_KEY_2.
 * Any tier with no key set is skipped, not treated as an error.
 */
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

const BACKOFF_MS = [500, 1000, 2000];

/** Timeout per LLM API call in milliseconds (30 seconds). Prevents hanging on unresponsive APIs. */
const API_TIMEOUT_MS = 30 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`API call timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Clients (lazy — only constructed if their key is present)
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const geminiClients: [GoogleGenerativeAI | null, GoogleGenerativeAI | null] = [null, null];
function getGemini(tier: 0 | 1): GoogleGenerativeAI | null {
  const apiKey = process.env[tier === 0 ? 'GEMINI_API_KEY' : 'GEMINI_API_KEY_2'];
  if (!apiKey) return null;
  if (!geminiClients[tier]) geminiClients[tier] = new GoogleGenerativeAI(apiKey);
  return geminiClients[tier];
}

const openrouterClients: [OpenAI | null, OpenAI | null] = [null, null];
function getOpenRouter(tier: 0 | 1): OpenAI | null {
  const keyNames = ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2'];
  const apiKey = process.env[keyNames[tier]];
  if (!apiKey) return null;
  if (!openrouterClients[tier]) {
    openrouterClients[tier] = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return openrouterClients[tier];
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) return isRetryableStatus(err.status);
  // Gemini SDK errors carry a `status` (HTTP-code-like) property when they
  // originate from the API; anything else (network, parse) is retried too.
  const status = (err as { status?: number } | undefined)?.status;
  if (typeof status === 'number') return isRetryableStatus(status);
  return true;
}

/** Retries a single provider call on 429/5xx/network errors, 500ms -> 2s. */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = BACKOFF_MS.length): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxRetries) break;
      await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Strips a ```json ... ``` fence Gemini sometimes wraps JSON output in. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

interface Attempt {
  name: string;
  run: () => Promise<string>;
}

/**
 * Runs each configured attempt in order, returning the first successful
 * result. Each attempt already has its own internal retry — this loop only
 * moves on once an attempt's retries are exhausted or it isn't configured.
 * Throws a combined error (with every attempted provider's failure) only if
 * ALL attempts fail. Throws immediately if none are configured at all.
 */
async function runWaterfall(attempts: Attempt[]): Promise<string> {
  const configured = attempts;
  if (configured.length === 0) {
    throw new Error(
      'No LLM provider is configured. Set at least one of OPENAI_API_KEY, GEMINI_API_KEY, GEMINI_API_KEY_2.',
    );
  }
  const failures: string[] = [];
  for (const attempt of configured) {
    try {
      return await attempt.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${attempt.name}: ${message}`);
    }
  }
  throw new Error(`All LLM providers failed:\n${failures.join('\n')}`);
}

// ---------------------------------------------------------------------------
// callJson — structured JSON output
// ---------------------------------------------------------------------------

export interface JsonCallOptions {
  system: string;
  user: string;
  /** Optional response schema hint appended to the system prompt for extra grounding. */
  schemaHint?: string;
  model?: string;
  maxRetries?: number;
}

async function openaiJson(system: string, user: string, model: string, maxRetries?: number): Promise<string> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  return withRetry(async () => {
    return withTimeout(
      (async () => {
        const response = await client.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('OpenAI returned an empty response');
        return content;
      })(),
      API_TIMEOUT_MS,
    );
  }, maxRetries);
}

async function geminiJson(tier: 0 | 1, system: string, user: string, maxRetries?: number): Promise<string> {
  const client = getGemini(tier);
  if (!client) throw new Error(`GEMINI_API_KEY${tier === 1 ? '_2' : ''} not set`);
  return withRetry(async () => {
    return withTimeout(
      (async () => {
        const model = client.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: system,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(user);
        const text = result.response.text();
        if (!text || typeof text !== 'string') throw new Error('Gemini returned an empty or invalid response');
        return text;
      })(),
      API_TIMEOUT_MS,
    );
  }, maxRetries);
}

/**
 * Calls the model in JSON mode (text/extraction only) and returns the parsed object.
 * Falls back: OpenAI -> OpenRouter (2 keys). Gemini is reserved for vision.
 * Throws once every configured provider has failed.
 */
export async function callJson<T = unknown>(opts: JsonCallOptions): Promise<T> {
  const { system, user, schemaHint, model = OPENAI_MODEL, maxRetries } = opts;
  const fullSystem = schemaHint ? `${system}\n\nRespond ONLY with JSON matching:\n${schemaHint}` : system;

  const attempts: Attempt[] = [];
  if (getOpenAI()) attempts.push({ name: 'openai', run: () => openaiJson(fullSystem, user, model, maxRetries) });
  if (getOpenRouter(0)) attempts.push({ name: 'openrouter-1', run: () => openaiJson(fullSystem, user, model, maxRetries) });
  if (getOpenRouter(1)) attempts.push({ name: 'openrouter-2', run: () => openaiJson(fullSystem, user, model, maxRetries) });

  const raw = await runWaterfall(attempts);
  try {
    return JSON.parse(stripCodeFence(raw)) as T;
  } catch (err) {
    throw new Error(`Failed to parse model response as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// visionTranscribe — image -> plain text
// ---------------------------------------------------------------------------

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const VISION_INSTRUCTION =
  'Transcribe all text in this image exactly as it appears, preserving line breaks. ' +
  'Output only the transcribed text, no commentary.';

async function openaiVision(buffer: Buffer, mimeType: string): Promise<string> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  return withRetry(async () => {
    return withTimeout(
      (async () => {
        const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        const response = await client.chat.completions.create({
          model: OPENAI_VISION_MODEL,
          messages: [
            { role: 'system', content: VISION_INSTRUCTION },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }] },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') throw new Error('Vision transcription returned an empty or invalid response');
        return content;
      })(),
      API_TIMEOUT_MS,
    );
  });
}

async function geminiVision(tier: 0 | 1, buffer: Buffer, mimeType: string): Promise<string> {
  const client = getGemini(tier);
  if (!client) throw new Error(`GEMINI_API_KEY${tier === 1 ? '_2' : ''} not set`);
  return withRetry(async () => {
    return withTimeout(
      (async () => {
        const model = client.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent([
          VISION_INSTRUCTION,
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ]);
        const text = result.response.text();
        if (!text || typeof text !== 'string') throw new Error('Vision transcription returned an empty or invalid response');
        return text;
      })(),
      API_TIMEOUT_MS,
    );
  });
}

/**
 * Transcribes an image to plain text via Gemini vision (fallback: Gemini key 2).
 * OpenAI is reserved for text/JSON extraction.
 *
 * Only accepts image MIME types — vision APIs take rasterized images, not
 * raw PDF bytes. Callers with a scanned/no-text-layer PDF must rasterize
 * each page to an image first; that rasterization step is not implemented
 * here (would need a PDF-to-image dependency like `pdf-to-img` or
 * `pdfjs-dist` + `canvas`).
 */
export async function visionTranscribe(buffer: Buffer, mimeType: string): Promise<string> {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `visionTranscribe only accepts image bytes (png/jpeg/webp), got "${mimeType}". ` +
        'Scanned PDFs need page rasterization before this call, which is not implemented yet.',
    );
  }

  const attempts: Attempt[] = [];
  if (getGemini(0)) attempts.push({ name: 'gemini-1', run: () => geminiVision(0, buffer, mimeType) });
  if (getGemini(1)) attempts.push({ name: 'gemini-2', run: () => geminiVision(1, buffer, mimeType) });

  return runWaterfall(attempts);
}

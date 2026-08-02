import { describe, it, expect, vi, beforeEach } from 'vitest';

const { openaiCreateMock, geminiGenerateContentMock } = vi.hoisted(() => ({
  openaiCreateMock: vi.fn(),
  geminiGenerateContentMock: vi.fn(),
}));

vi.mock('openai', () => {
  class APIError extends Error {
    status?: number;
    constructor(status: number | undefined, message: string) {
      super(message);
      this.status = status;
    }
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create: openaiCreateMock } };
    constructor(_opts: unknown) {}
  }
  return { default: OpenAI };
});

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel(_opts: unknown) {
      return { generateContent: geminiGenerateContentMock };
    }
  }
  return { GoogleGenerativeAI };
});

import { callJson, visionTranscribe } from '../../src/integrations/openai.js';

// Non-retryable-shaped errors so tests don't wait through real backoff sleeps.
const nonRetryableOpenAi = () => Object.assign(new Error('bad request'), { status: 400 });
const nonRetryableOther = () => Object.assign(new Error('boom'), { status: 400 });

function geminiOk(json: string) {
  return { response: { text: () => json } };
}

const ENV_KEYS = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('callJson waterfall', () => {
  it('throws immediately when no provider is configured', async () => {
    await expect(callJson({ system: 's', user: 'u' })).rejects.toThrow('No LLM provider is configured');
    expect(openaiCreateMock).not.toHaveBeenCalled();
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it('uses OpenAI alone when it succeeds', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gk-test';
    openaiCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: '{"a":1}' } }] });

    const result = await callJson({ system: 's', user: 'u' });

    expect(result).toEqual({ a: 1 });
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it('falls back to gemini-1 when OpenAI fails', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gk-test';
    openaiCreateMock.mockRejectedValueOnce(nonRetryableOpenAi());
    geminiGenerateContentMock.mockResolvedValueOnce(geminiOk('{"b":2}'));

    const result = await callJson({ system: 's', user: 'u' });

    expect(result).toEqual({ b: 2 });
    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    expect(geminiGenerateContentMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to gemini-2 when OpenAI and gemini-1 both fail', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gk-1';
    process.env.GEMINI_API_KEY_2 = 'gk-2';
    openaiCreateMock.mockRejectedValueOnce(nonRetryableOpenAi());
    geminiGenerateContentMock.mockRejectedValueOnce(nonRetryableOther());
    geminiGenerateContentMock.mockResolvedValueOnce(geminiOk('{"c":3}'));

    const result = await callJson({ system: 's', user: 'u' });

    expect(result).toEqual({ c: 3 });
    expect(geminiGenerateContentMock).toHaveBeenCalledTimes(2);
  });

  it('strips a markdown code fence from a Gemini response', async () => {
    process.env.GEMINI_API_KEY = 'gk-test';
    geminiGenerateContentMock.mockResolvedValueOnce(geminiOk('```json\n{"d":4}\n```'));

    const result = await callJson({ system: 's', user: 'u' });

    expect(result).toEqual({ d: 4 });
  });

  it('throws a combined error listing every provider once all fail', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gk-1';
    process.env.GEMINI_API_KEY_2 = 'gk-2';
    openaiCreateMock.mockRejectedValueOnce(nonRetryableOpenAi());
    geminiGenerateContentMock.mockRejectedValue(nonRetryableOther());

    await expect(callJson({ system: 's', user: 'u' })).rejects.toThrow('All LLM providers failed');
    expect(geminiGenerateContentMock).toHaveBeenCalledTimes(2);
  });
});

describe('visionTranscribe waterfall', () => {
  it('rejects non-image mime types before touching any provider', async () => {
    await expect(visionTranscribe(Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      'only accepts image bytes',
    );
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it('falls back from OpenAI to Gemini for image transcription', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'gk-test';
    openaiCreateMock.mockRejectedValueOnce(nonRetryableOpenAi());
    geminiGenerateContentMock.mockResolvedValueOnce({ response: { text: () => 'transcribed text' } });

    const result = await visionTranscribe(Buffer.from('fake-png-bytes'), 'image/png');

    expect(result).toBe('transcribed text');
  });
});

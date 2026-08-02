import { beforeEach, describe, expect, it, vi } from "vitest";

const { openaiCreateMock, geminiGenerateContentMock } = vi.hoisted(() => ({
  openaiCreateMock: vi.fn(),
  geminiGenerateContentMock: vi.fn(),
}));

vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: openaiCreateMock } };
  }
  return { default: OpenAI };
});

vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: geminiGenerateContentMock };
    }
  }
  return { GoogleGenerativeAI };
});

import { callJson, visionTranscribe } from "../../src/integrations/openai.js";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY_PRIMARY",
  "GEMINI_API_KEY_FALLBACK",
] as const;

const providerError = (status: number) =>
  Object.assign(new Error("raw provider failure"), { status });
const geminiOk = (json: string) => ({ response: { text: () => json } });

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("provider SDK adapters", () => {
  it("returns a safe structured error when no provider is configured", async () => {
    await expect(callJson({ system: "s", user: "u" })).rejects.toEqual({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "AI processing is temporarily unavailable.",
      retryable: true,
    });
    expect(openaiCreateMock).not.toHaveBeenCalled();
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it("uses OpenAI alone when it succeeds", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-test";
    openaiCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"a":1}' } }],
    });

    await expect(callJson({ system: "s", user: "u" })).resolves.toEqual({
      a: 1,
    });
    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it("falls back to Gemini primary after a retryable OpenAI failure", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    openaiCreateMock.mockRejectedValueOnce(providerError(429));
    geminiGenerateContentMock.mockResolvedValueOnce(geminiOk('{"b":2}'));

    await expect(
      callJson({ system: "s", user: "u", maxRetries: 0 }),
    ).resolves.toEqual({ b: 2 });
    expect(geminiGenerateContentMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini secondary after two retryable failures", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    process.env.GEMINI_API_KEY_FALLBACK = "gemini-fallback-test";
    openaiCreateMock.mockRejectedValueOnce(providerError(503));
    geminiGenerateContentMock
      .mockRejectedValueOnce(providerError(503))
      .mockResolvedValueOnce(geminiOk('{"c":3}'));

    await expect(
      callJson({ system: "s", user: "u", maxRetries: 0 }),
    ).resolves.toEqual({ c: 3 });
    expect(geminiGenerateContentMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back for a permanent request failure", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    const failure = providerError(400);
    openaiCreateMock.mockRejectedValueOnce(failure);

    await expect(
      callJson({ system: "s", user: "u", maxRetries: 0 }),
    ).rejects.toBe(failure);
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it("does not fall back when a successful provider returns malformed JSON", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    openaiCreateMock.mockResolvedValueOnce({
      choices: [{ message: { content: "not-json" } }],
    });

    await expect(callJson({ system: "s", user: "u" })).rejects.toBeInstanceOf(
      SyntaxError,
    );
    expect(geminiGenerateContentMock).not.toHaveBeenCalled();
  });

  it("strips a JSON code fence from Gemini output", async () => {
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    geminiGenerateContentMock.mockResolvedValueOnce(
      geminiOk('```json\n{"d":4}\n```'),
    );

    await expect(callJson({ system: "s", user: "u" })).resolves.toEqual({
      d: 4,
    });
  });

  it("rejects non-image input before calling a provider", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    await expect(
      visionTranscribe(Buffer.from("x"), "application/pdf"),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("falls back from OpenAI to Gemini for image transcription", async () => {
    process.env.OPENAI_API_KEY = "openai-test";
    process.env.GEMINI_API_KEY_PRIMARY = "gemini-primary-test";
    openaiCreateMock.mockRejectedValue(providerError(503));
    geminiGenerateContentMock.mockResolvedValueOnce({
      response: { text: () => "transcribed text" },
    });

    await expect(
      visionTranscribe(Buffer.from("fake-png"), "image/png"),
    ).resolves.toBe("transcribed text");
  });
});

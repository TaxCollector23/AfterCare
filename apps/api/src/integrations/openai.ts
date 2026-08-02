/** Provider SDK adapters. Selection and fallback live only in aiProviderWaterfall.ts. */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { isStructuredAiError } from "../errors.js";
import {
  AiProviderFailure,
  isRetryableAiProviderFailure,
  runAiProviderWaterfall,
  type AiProviderContext,
  type AiProviderCredentials,
} from "./aiProviderWaterfall.js";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const BACKOFF_MS = [500, 1_000, 2_000];

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const VISION_INSTRUCTION =
  "Transcribe all text in this image exactly as it appears, preserving line breaks. " +
  "Output only the transcribed text, no commentary.";

function providerCredentials(): AiProviderCredentials {
  return {
    openai: process.env.OPENAI_API_KEY,
    geminiPrimary: process.env.GEMINI_API_KEY_PRIMARY,
    geminiFallback: process.env.GEMINI_API_KEY_FALLBACK,
  };
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = BACKOFF_MS.length,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableAiProviderFailure(error) || attempt >= maxRetries) {
        throw error;
      }
      await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!);
    }
  }
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1]! : trimmed;
}

async function providerText(
  operation: (context: AiProviderContext) => Promise<string>,
) {
  const result = await runAiProviderWaterfall(operation, providerCredentials());
  if (isStructuredAiError(result)) throw result;
  return result;
}

export interface JsonCallOptions {
  system: string;
  user: string;
  schemaHint?: string;
  model?: string;
  maxRetries?: number;
}

async function openaiJson(
  apiKey: string,
  system: string,
  user: string,
  model: string,
  maxRetries?: number,
) {
  const client = new OpenAI({ apiKey });
  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new AiProviderFailure("parsing");
    return content;
  }, maxRetries);
}

async function geminiJson(
  apiKey: string,
  system: string,
  user: string,
  maxRetries?: number,
) {
  const client = new GoogleGenerativeAI(apiKey);
  return withRetry(async () => {
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      generationConfig: { responseMimeType: "application/json" },
    });
    const text = (await model.generateContent(user)).response.text();
    if (!text) throw new AiProviderFailure("parsing");
    return text;
  }, maxRetries);
}

export async function callJson<T = unknown>(options: JsonCallOptions) {
  const {
    system,
    user,
    schemaHint,
    model = OPENAI_MODEL,
    maxRetries,
  } = options;
  const fullSystem = schemaHint
    ? `${system}\n\nRespond ONLY with JSON matching:\n${schemaHint}`
    : system;

  const raw = await providerText(({ family, apiKey }) =>
    family === "openai"
      ? openaiJson(apiKey, fullSystem, user, model, maxRetries)
      : geminiJson(apiKey, fullSystem, user, maxRetries),
  );

  // Parsing happens after provider selection so programming/schema bugs never
  // trigger a request to another provider.
  return JSON.parse(stripCodeFence(raw)) as T;
}

async function openaiVision(apiKey: string, buffer: Buffer, mimeType: string) {
  const client = new OpenAI({ apiKey });
  return withRetry(async () => {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const response = await client.chat.completions.create({
      model: OPENAI_VISION_MODEL,
      messages: [
        { role: "system", content: VISION_INSTRUCTION },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: dataUrl } }],
        },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new AiProviderFailure("parsing");
    return content;
  });
}

async function geminiVision(apiKey: string, buffer: Buffer, mimeType: string) {
  const client = new GoogleGenerativeAI(apiKey);
  return withRetry(async () => {
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    const text = (
      await model.generateContent([
        VISION_INSTRUCTION,
        { inlineData: { mimeType, data: buffer.toString("base64") } },
      ])
    ).response.text();
    if (!text) throw new AiProviderFailure("parsing");
    return text;
  });
}

export async function visionTranscribe(buffer: Buffer, mimeType: string) {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw new AiProviderFailure("validation", "Unsupported image type");
  }

  return providerText(({ family, apiKey }) =>
    family === "openai"
      ? openaiVision(apiKey, buffer, mimeType)
      : geminiVision(apiKey, buffer, mimeType),
  );
}

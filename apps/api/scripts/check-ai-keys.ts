/**
 * Operator tool: verifies the AI provider keys this API actually reads.
 *
 *   pnpm --filter @discharge-guide/api check:ai
 *
 * Reports which recognized keys are set, flags key-shaped variables the API
 * ignores (the usual reason a deployment "has the keys" and still fails), and
 * makes one real request per configured provider. Key values are never printed.
 *
 * Reads from the environment, so run it with the same variables the API has —
 * locally via apps/api/.env, or inside the deployment's own shell.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

/** Exactly the variables src/integrations/openai.ts reads. Keep in sync. */
const RECOGNIZED = [
  { env: "OPENAI_API_KEY", label: "openai", family: "openai" as const },
  {
    env: "GEMINI_API_KEY_PRIMARY",
    label: "gemini-primary",
    family: "gemini" as const,
  },
  {
    env: "GEMINI_API_KEY_FALLBACK",
    label: "gemini-fallback",
    family: "gemini" as const,
  },
];

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

interface Probe {
  label: string;
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
}

async function probeOpenAi(apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Reply with JSON." },
      { role: "user", content: 'Return {"ok":true}' },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("empty response");
  return content;
}

async function probeGemini(apiKey: string): Promise<string> {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent('Return {"ok":true}');
  const text = result.response.text();
  if (!text) throw new Error("empty response");
  return text;
}

function keyShapedStrays(): string[] {
  const recognized = new Set(RECOGNIZED.map((entry) => entry.env));
  const looksLikeSecret = (value: string) =>
    /^(sk-|sk-or-|sk-proj-|AIza|gsk_)/.test(value);
  const namedLikeKey = (name: string) =>
    /(openai|openrouter|gemini|gpt|claude|anthropic)/i.test(name) &&
    !/MODEL$/i.test(name);

  return Object.entries(process.env)
    .filter(([name, value]) => {
      if (recognized.has(name)) return false;
      if (/^(CLAUDE|ANTHROPIC_BASE|VERCEL|npm_|TURBO|NX_)/i.test(name))
        return false;
      const trimmed = value?.trim() ?? "";
      return (
        trimmed.length > 0 && (looksLikeSecret(trimmed) || namedLikeKey(name))
      );
    })
    .map(([name]) => name);
}

async function main() {
  console.log("AfterCare — AI provider check\n");

  const configured = RECOGNIZED.filter(({ env }) => process.env[env]?.trim());
  console.log(
    `Recognized keys set: ${configured.length ? configured.map((c) => c.env).join(", ") : "none"}`,
  );

  const strays = keyShapedStrays();
  if (strays.length) {
    console.log(
      `\n! Ignored — these look like API keys but are not names this API reads:\n` +
        strays.map((name) => `    ${name}`).join("\n") +
        `\n  Rename to one of: ${RECOGNIZED.map((r) => r.env).join(", ")}\n` +
        `  (OpenRouter keys are not supported — this API speaks to OpenAI and Gemini only.)\n`,
    );
  }

  if (configured.length === 0) {
    console.error(
      "FAIL  No AI provider is configured, so uploads cannot be turned into a guide.\n" +
        "      Set at least one of: " +
        RECOGNIZED.map((r) => r.env).join(", "),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nProbing ${configured.length} provider(s) with a real request...\n`,
  );

  const results: Probe[] = await Promise.all(
    configured.map(async ({ env, label, family }): Promise<Probe> => {
      const apiKey = process.env[env]!.trim();
      const model = family === "openai" ? OPENAI_MODEL : GEMINI_MODEL;
      const startedAt = Date.now();
      try {
        const raw =
          family === "openai"
            ? await probeOpenAi(apiKey)
            : await probeGemini(apiKey);
        JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        return { label, model, ok: true, ms: Date.now() - startedAt };
      } catch (error) {
        return {
          label,
          model,
          ok: false,
          ms: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  for (const result of results) {
    console.log(
      `  ${result.ok ? "OK  " : "FAIL"}  ${result.label.padEnd(16)} ${result.model.padEnd(22)} ${result.ms}ms`,
    );
    if (!result.ok) console.log(`        ${result.error}`);
  }

  const working = results.filter((result) => result.ok);
  console.log(`\n${working.length} of ${results.length} provider(s) working.`);
  if (working.length === 0) {
    console.error(
      "FAIL  No working provider — uploads would fail with an AI error.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("PASS  Document processing has at least one working provider.");
}

main().catch((error) => {
  console.error("Unexpected failure:", error);
  process.exitCode = 1;
});

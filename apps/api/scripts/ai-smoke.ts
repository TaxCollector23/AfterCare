/**
 * Operator tool: exercises the real AI provider waterfall end-to-end.
 *
 *   pnpm --filter @discharge-guide/api ai:smoke
 *
 * Runs the actual `callJson` code path (waterfall selection, timeouts, retries,
 * lenient JSON parsing) against the AfterCare broadsheet fixture and prints the
 * result plus elapsed time. Requires at least one provider key in the
 * environment — the same variables the API reads (OPENAI_API_KEY,
 * OPENROUTER_API_KEY, GEMINI_API_KEY_PRIMARY, GEMINI_API_KEY_FALLBACK).
 */
import { readFileSync } from "node:fs";
import { callJson } from "../src/integrations/openai.js";

const FIXTURE_PATH = new URL(
  "../test/fixtures/broadsheet-text.txt",
  import.meta.url,
);

const RECOGNIZED_KEYS = [
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY_PRIMARY",
  "GEMINI_API_KEY_FALLBACK",
] as const;

async function main() {
  const configured = RECOGNIZED_KEYS.filter((key) => process.env[key]?.trim());
  if (configured.length === 0) {
    console.error(
      `ai:smoke FAIL — no AI provider keys configured. Set at least one of: ${RECOGNIZED_KEYS.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const numberedText = readFileSync(FIXTURE_PATH, "utf8")
    .split("\n")
    .slice(0, 120)
    .map((line, index) => `${index + 1}: ${line}`)
    .join("\n");

  console.log(
    `ai:smoke — running the real waterfall with providers: ${configured.join(", ")}`,
  );
  const startedAt = Date.now();
  const result = await callJson<{ medications: string[] }>({
    system:
      "You extract medication names from a numbered-line hospital discharge document. " +
      'Respond ONLY with JSON matching: {"medications": string[]}. If none are present, return an empty array.',
    user: numberedText,
  });
  console.log(`ai:smoke OK (${Date.now() - startedAt}ms)`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // Structured AI errors (all providers down) are thrown as plain objects,
  // not Error instances — surface their message so the operator sees why.
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error);
  console.error("ai:smoke FAIL —", detail);
  process.exitCode = 1;
});

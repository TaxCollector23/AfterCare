/**
 * Stage 5: Explanation generator — plain-language definitions of medical
 * jargon found in the document, for the "Explain Terms" screen.
 *
 * Every explanation must be grounded in where the term appears in the
 * document (sourceLines) — this is not a general medical dictionary lookup.
 */
import { callJson } from "../integrations/openai.js";
import {
  ok,
  fail,
  type Explanation,
  type OcrResult,
  type StageResult,
} from "@discharge/shared-types";

const SYSTEM_PROMPT = `You identify medical jargon in a numbered-line hospital discharge document
and explain each term in plain language a patient over 60 with no medical
background can understand (aim for an 8th-grade reading level, 1-3
sentences). Only include genuinely technical terms (drug classes, procedure
names, clinical terminology) — skip common words. Cite the source line(s)
where the term appears.`;

const SCHEMA_HINT = `{
  "explanations": [{
    "term": string,
    "plainText": string,
    "sourceLines": number[],
    "confidence": number
  }]
}`;

interface RawExplanation {
  term: string;
  plainText: string;
  sourceLines: number[];
  confidence: number;
}

export async function generateExplanations(
  ocr: OcrResult,
): Promise<StageResult<Explanation[]>> {
  try {
    const validLines = new Set(ocr.lines.map((l) => l.line));
    const numberedText = ocr.lines
      .map((l) => `${l.line}: ${l.text}`)
      .join("\n");
    const raw = await callJson<Partial<{ explanations: RawExplanation[] }>>({
      system: SYSTEM_PROMPT,
      user: numberedText,
      schemaHint: SCHEMA_HINT,
    });
    const explanations = Array.isArray(raw.explanations)
      ? raw.explanations
      : [];

    const result: Explanation[] = explanations.map((e) => {
      const sourceLines = Array.isArray(e.sourceLines)
        ? e.sourceLines.filter((n) => validLines.has(n))
        : [];
      return {
        term: e.term ?? "",
        plainText: e.plainText ?? "",
        sourceLines,
        confidence:
          sourceLines.length > 0
            ? (e.confidence ?? 0)
            : Math.min(e.confidence ?? 0, 50),
      };
    });

    const overall =
      result.length === 0
        ? 100
        : Math.round(
            result.reduce((sum, e) => sum + e.confidence, 0) / result.length,
          );

    return ok(
      result,
      overall,
      result.flatMap((e) => e.sourceLines),
    );
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Explanation generation failed",
    );
  }
}

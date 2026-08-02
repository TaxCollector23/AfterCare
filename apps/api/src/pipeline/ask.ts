/**
 * Grounded Q&A. This is the function Person B's `POST /ask` route calls —
 * it lives in pipeline/, not routes/, per the backend split (Person A owns
 * no Express code).
 */
import { callJson } from '../integrations/openai.js';
import { isGrounded, resolveSourceLines, CONFIDENCE_THRESHOLD } from './grounding.js';
import type { GroundedAnswer, OcrResult } from '@discharge/shared-types';

const SYSTEM_PROMPT = `You answer a patient's question about their hospital discharge document.
You are given the numbered-line text of that document. Rules:
1. If the document answers the question, answer from it ONLY and cite the
   exact line numbers you used.
2. If the document does NOT cover it, you may give brief, general health
   education — but you MUST say explicitly that this is general information,
   not from their specific document, and they should confirm with their
   care team. Set source to "general" and sourceLines to [].
3. If you cannot safely answer at all (e.g. it requires clinical judgment
   you don't have), set source to "not-found" and say so plainly.
Never invent information and never alter or contradict a dosage, schedule,
or instruction found in the document.`;

const SCHEMA_HINT = `{
  "answer": string,
  "confidence": number,
  "sourceLines": number[],
  "source": "document" | "general" | "not-found"
}`;

const VALID_SOURCES: GroundedAnswer['source'][] = ['document', 'general', 'not-found'];

export async function askGrounded(
  question: string,
  ocr: OcrResult,
): Promise<GroundedAnswer> {
  const validLines = new Set(ocr.lines.map((l) => l.line));
  const numberedText = ocr.lines.map((l) => `${l.line}: ${l.text}`).join('\n');
  const user = `Document:\n${numberedText}\n\nQuestion: ${question}`;

  const raw = await callJson<Partial<GroundedAnswer>>({
    system: SYSTEM_PROMPT,
    user,
    schemaHint: SCHEMA_HINT,
  });

  const answer: GroundedAnswer = {
    answer: raw.answer ?? '',
    confidence: Math.max(0, Math.min(100, raw.confidence ?? 0)),
    source: VALID_SOURCES.includes(raw.source as GroundedAnswer['source']) ? raw.source! : 'not-found',
    // Drop any cited line that doesn't actually exist, regardless of source.
    sourceLines: Array.isArray(raw.sourceLines) ? raw.sourceLines.filter((n) => validLines.has(n)) : [],
  };

  // Defense in depth: don't trust the model's own grounding claim — verify
  // the cited lines actually exist before honoring a "document" source.
  if (answer.source === 'document' && !isGrounded(ocr.lines, answer.sourceLines)) {
    return {
      answer: answer.answer,
      confidence: Math.min(answer.confidence, CONFIDENCE_THRESHOLD - 1),
      sourceLines: [],
      source: 'general',
    };
  }

  // If answer is empty, we can't trust it regardless of source
  if (!answer.answer.trim()) {
    return {
      answer: 'Unable to generate an answer.',
      confidence: 0,
      sourceLines: [],
      source: 'not-found',
    };
  }

  return answer;
}

/** Convenience: the resolved text behind an answer's citations, for UI "show source" links. */
export function citedText(ocr: OcrResult, answer: GroundedAnswer): string {
  return resolveSourceLines(ocr.lines, answer.sourceLines);
}

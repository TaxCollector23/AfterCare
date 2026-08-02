/**
 * Stage 2: Extraction — OCR text -> structured JSON skeleton.
 *
 * This does the coarse pass (what sections exist, roughly what's in them);
 * the detection modules (medications/appointments/warnings/timeline) do the
 * fine-grained, individually-gradeable extraction and cite their own
 * sourceLines. Extraction's job is to hand them a smaller, pre-triaged slice
 * of the document.
 */
import { callJson } from '../integrations/openai.js';
import { ok, fail, type OcrResult, type StageResult } from '@discharge/shared-types';

export interface ExtractedSections {
  medicationsText: string;
  appointmentsText: string;
  warningsText: string;
  timelineText: string;
  /** Everything else — instructions, follow-up care, etc. */
  otherText: string;
}

const SYSTEM_PROMPT = `You are a medical document triage assistant. Given a numbered-line OCR
transcript of a hospital discharge summary, split it into sections by topic.
Copy relevant lines verbatim (prefixed with their line number) into each
bucket. A line may appear in more than one bucket if it's ambiguous. If a
bucket has no content, return an empty string for it.`;

const SCHEMA_HINT = `{
  "medicationsText": string,
  "appointmentsText": string,
  "warningsText": string,
  "timelineText": string,
  "otherText": string
}`;

const SECTION_KEYS: (keyof ExtractedSections)[] = [
  'medicationsText',
  'appointmentsText',
  'warningsText',
  'timelineText',
  'otherText',
];

/**
 * Model output is untrusted input — normalize missing/wrong-typed fields to
 * empty strings so downstream stages can safely call `.trim()` / `.length`
 * without every caller re-checking for undefined.
 */
function normalize(raw: Partial<Record<keyof ExtractedSections, unknown>>): ExtractedSections {
  const result = {} as ExtractedSections;
  for (const key of SECTION_KEYS) {
    const value = raw[key];
    result[key] = typeof value === 'string' ? value : '';
  }
  return result;
}

export async function runExtraction(ocr: OcrResult): Promise<StageResult<ExtractedSections>> {
  try {
    if (ocr.lines.length === 0) {
      return fail('OCR produced no text to extract');
    }
    const numberedText = ocr.lines.map((l) => `${l.line}: ${l.text}`).join('\n');
    if (numberedText.trim().length === 0) {
      return fail('OCR text is empty after formatting');
    }
    const raw = await callJson<Partial<Record<keyof ExtractedSections, unknown>>>({
      system: SYSTEM_PROMPT,
      user: numberedText,
      schemaHint: SCHEMA_HINT,
    });
    const sections = normalize(raw);
    // Confidence here is a coarse pass; downstream detection modules assign
    // their own, more specific confidence per finding.
    return ok(sections, 90, ocr.lines.map((l) => l.line));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Extraction failed');
  }
}

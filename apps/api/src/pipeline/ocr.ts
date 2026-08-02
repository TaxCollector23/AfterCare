/**
 * Stage 1: OCR — PDF/image bytes -> line-numbered text with per-line confidence.
 *
 * Every later stage's `sourceLines` refers back to the line numbers produced
 * here, so this is the one stage where getting line numbering right matters
 * more than getting the text perfect.
 *
 * - PDFs with a text layer: `pdf-parse`, no LLM call, high confidence.
 * - Scanned pages / photos (or PDFs with no extractable text): a vision
 *   call via ../integrations/openai, lower confidence.
 */
// Import the inner lib directly, NOT the package root ('pdf-parse'). The
// root index.js runs a debug self-test at import time when it thinks it has
// no parent module (true for ESM interop), which throws ENOENT looking for
// a test fixture that only exists inside pdf-parse's own repo.
// See: https://gitlab.com/autokent/pdf-parse/-/blob/master/index.js
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { visionTranscribe } from '../integrations/openai.js';
import { ok, fail, type OcrLine, type OcrResult, type StageResult } from '@discharge/shared-types';

export interface OcrInput {
  /** Raw file bytes (PDF or image). */
  buffer: Buffer;
  mimeType: string;
}

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic']);

/** Minimum characters per PDF page before we trust the text layer over vision fallback. */
const MIN_CHARS_PER_PAGE = 20;

interface ExtractResult {
  text: string;
  pageCount: number;
  /** Which path produced the text — drives the confidence heuristic below. */
  source: 'pdf-text-layer' | 'vision';
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  const parsed = await pdfParse(buffer);
  const hasTextLayer = parsed.text.trim().length >= MIN_CHARS_PER_PAGE * Math.max(parsed.numpages, 1);

  if (hasTextLayer) {
    return { text: parsed.text, pageCount: parsed.numpages, source: 'pdf-text-layer' };
  }

  // Scanned PDF with no real text layer. Vision transcription needs rasterized
  // images, not raw PDF bytes — page rasterization isn't wired up yet.
  throw new Error(
    'This PDF has no extractable text layer (likely a scan). Photo/scan OCR via vision ' +
      'requires page rasterization, which is not implemented yet — upload as an image instead.',
  );
}

async function extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractResult> {
  const text = await visionTranscribe(buffer, mimeType);
  return { text, pageCount: 1, source: 'vision' };
}

async function extractRawText(input: OcrInput): Promise<ExtractResult> {
  if (input.mimeType === 'application/pdf') {
    return extractFromPdf(input.buffer);
  }
  if (IMAGE_MIME_TYPES.has(input.mimeType)) {
    return extractFromImage(input.buffer, input.mimeType);
  }
  throw new Error(`Unsupported file type: ${input.mimeType}`);
}

/** Splits raw OCR text into 1-indexed lines with a source-aware confidence heuristic. */
function toLines(rawText: string, source: ExtractResult['source']): OcrLine[] {
  const baseConfidence = source === 'pdf-text-layer' ? 99 : 85;
  return rawText
    .split(/\r?\n/)
    .map((text, idx) => ({
      line: idx + 1,
      text,
      // Blank/very short lines are more likely to be layout artifacts than
      // real content, regardless of extraction source.
      confidence: text.trim().length === 0 ? Math.min(baseConfidence, 50) : baseConfidence,
    }))
    .filter((l) => l.text.length > 0 || l.line === 1);
}

export async function runOcr(input: OcrInput): Promise<StageResult<OcrResult>> {
  try {
    const { text: rawText, pageCount, source } = await extractRawText(input);
    const lines = toLines(rawText, source);
    if (lines.length === 0) {
      return fail('OCR produced no text');
    }
    const avgConfidence =
      lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
    const result: OcrResult = {
      lines,
      text: lines.map((l) => l.text).join('\n'),
      pageCount,
    };
    return ok(result, Math.round(avgConfidence), lines.map((l) => l.line));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'OCR failed');
  }
}

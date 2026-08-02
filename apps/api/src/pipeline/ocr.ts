/**
 * Stage 1: OCR ? PDF/image bytes -> line-numbered text with per-line confidence.
 *
 * Every later stage's `sourceLines` refers back to the line numbers produced
 * here, so this is the one stage where getting line numbering right matters
 * more than getting the text perfect.
 *
 * - PDFs with a text layer: `pdf-parse`, no LLM call, high confidence.
 * - Scanned PDFs (no text layer): each page is rasterized to a PNG via
 *   `pdf-to-img`, then transcribed through the vision waterfall.
 * - Photos/images: transcribed directly through the vision waterfall.
 */
// Import the inner lib directly, NOT the package root ('pdf-parse'). The
// root index.js runs a debug self-test at import time when it thinks it has
// no parent module (true for ESM interop), which throws ENOENT looking for
// a test fixture that only exists inside pdf-parse's own repo.
// See: https://gitlab.com/autokent/pdf-parse/-/blob/master/index.js
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { pdf as rasterizePdf } from "pdf-to-img";
import { visionTranscribe } from "../integrations/openai.js";
import {
  ok,
  fail,
  type OcrLine,
  type OcrResult,
  type StageResult,
} from "./types.js";

export interface OcrInput {
  /** Raw file bytes (PDF or image). */
  buffer: Buffer;
  mimeType: string;
}

// Must match visionTranscribe's own accepted set in ../integrations/openai.ts
// exactly ? OpenAI's vision API doesn't take HEIC without client-side
// conversion, so it's deliberately not offered here either.
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/** Minimum characters per PDF page before we trust the text layer over vision fallback. */
const MIN_CHARS_PER_PAGE = 20;

/** Higher = sharper rasterized pages = better OCR accuracy, at the cost of larger vision payloads. */
const RASTER_SCALE = Number(process.env.PDF_OCR_RASTER_SCALE ?? 2);

/** How many pages to transcribe via vision concurrently, to avoid bursting past API rate limits. */
const VISION_CONCURRENCY = Number(process.env.PDF_OCR_VISION_CONCURRENCY ?? 3);

interface ExtractResult {
  text: string;
  pageCount: number;
  /** Which path produced the text ? drives the confidence heuristic below. */
  source: "pdf-text-layer" | "vision";
}

/** Runs `fn` over `items` with at most `limit` in flight at once, preserving input order in the result. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  const parsed = await pdfParse(buffer);
  const hasTextLayer =
    parsed.text.trim().length >=
    MIN_CHARS_PER_PAGE * Math.max(parsed.numpages, 1);

  if (hasTextLayer) {
    return {
      text: parsed.text,
      pageCount: parsed.numpages,
      source: "pdf-text-layer",
    };
  }

  // Scanned PDF with no real text layer: rasterize each page to a PNG and
  // transcribe it through the vision waterfall (OpenAI -> Gemini x2).
  const doc = await rasterizePdf(buffer, { scale: RASTER_SCALE });
  try {
    const pageImages: Buffer[] = [];
    for await (const pageImage of doc) {
      pageImages.push(pageImage);
    }
    if (pageImages.length === 0) {
      throw new Error("PDF rasterization produced no pages");
    }

    const pageTexts = await mapWithConcurrency(
      pageImages,
      VISION_CONCURRENCY,
      (pageImage) => visionTranscribe(pageImage, "image/png"),
    );

    return {
      text: pageTexts.join("\n"),
      pageCount: pageImages.length,
      source: "vision",
    };
  } finally {
    await doc.destroy();
  }
}

async function extractFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractResult> {
  const text = await visionTranscribe(buffer, mimeType);
  return { text, pageCount: 1, source: "vision" };
}

async function extractRawText(input: OcrInput): Promise<ExtractResult> {
  if (input.mimeType === "application/pdf") {
    return extractFromPdf(input.buffer);
  }
  if (IMAGE_MIME_TYPES.has(input.mimeType)) {
    return extractFromImage(input.buffer, input.mimeType);
  }
  throw new Error(`Unsupported file type: ${input.mimeType}`);
}

/** Splits raw OCR text into 1-indexed lines with a source-aware confidence heuristic. */
function toLines(rawText: string, source: ExtractResult["source"]): OcrLine[] {
  const baseConfidence = source === "pdf-text-layer" ? 99 : 85;
  return rawText
    .split(/\r?\n/)
    .map((text, idx) => ({
      line: idx + 1,
      text,
      // Blank/very short lines are more likely to be layout artifacts than
      // real content, regardless of extraction source.
      confidence:
        text.trim().length === 0
          ? Math.min(baseConfidence, 50)
          : baseConfidence,
    }))
    .filter((l) => l.text.length > 0 || l.line === 1);
}

export async function runOcr(input: OcrInput): Promise<StageResult<OcrResult>> {
  try {
    const { text: rawText, pageCount, source } = await extractRawText(input);
    const lines = toLines(rawText, source);
    if (lines.length === 0) {
      return fail("OCR produced no text");
    }
    const avgConfidence =
      lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
    const result: OcrResult = {
      lines,
      text: lines.map((l) => l.text).join("\n"),
      pageCount,
    };
    return ok(
      result,
      Math.round(avgConfidence),
      lines.map((l) => l.line),
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "OCR failed");
  }
}

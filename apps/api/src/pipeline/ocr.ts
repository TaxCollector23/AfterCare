/**
 * Stage 1: OCR - PDF/image bytes -> line-numbered text with per-line confidence.
 *
 * Every later stage's `sourceLines` refers back to the line numbers produced
 * here, so this is the one stage where getting line numbering right matters
 * more than getting the text perfect.
 *
 * - PDFs with a text layer: `unpdf`, no LLM call, high confidence.
 * - Scanned PDFs (no text layer): each page is rasterized to a PNG via
 *   `pdf-to-img`, then transcribed through the vision waterfall.
 *
 * Text extraction deliberately does NOT use `pdf-parse`. That package bundles
 * pdf.js v1.10.100, which keeps document state in module globals: the second
 * and every later parse in the same process returns the FIRST document's text.
 * In a long-lived API that means one patient being shown another patient's
 * medications. `unpdf` builds a fresh document per call, and the regression is
 * covered in test/pipeline/ocr.test.ts.
 * - Photos/images: transcribed directly through the vision waterfall.
 */
import { extractText, getDocumentProxy } from "unpdf";
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
// exactly - OpenAI's vision API doesn't take HEIC without client-side
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
  /** Which path produced the text - drives the confidence heuristic below. */
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

type RasterizedDoc = AsyncIterable<Buffer> & { destroy?: () => unknown };

/**
 * Loads the rasterizer on demand. `pdf-to-img` pulls in `canvas`, a native
 * module needing cairo/pango that is routinely missing from CI images and
 * serverless runtimes. Importing it lazily keeps that failure contained to
 * scanned PDFs instead of making this whole module unimportable — text-layer
 * PDFs and photos never touch it.
 */
async function rasterizeOrExplain(buffer: Buffer): Promise<RasterizedDoc> {
  let rasterize: (
    input: Buffer,
    options: { scale: number },
  ) => Promise<RasterizedDoc>;
  try {
    ({ pdf: rasterize } = (await import("pdf-to-img")) as unknown as {
      pdf: (
        input: Buffer,
        options: { scale: number },
      ) => Promise<RasterizedDoc>;
    });
  } catch (cause) {
    throw new Error(
      "This looks like a scanned PDF, which needs page rasterization, but the " +
        "image toolchain (pdf-to-img/canvas) is not available in this environment. " +
        "Upload a photo of the pages instead, or install the native canvas build.",
      { cause },
    );
  }
  return rasterize(buffer, { scale: RASTER_SCALE });
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  // A fresh document proxy per call - see the state-leak note at the top.
  const document = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(document, {
    mergePages: true,
  });
  const pdfText = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  const pageCount = Math.max(totalPages, 1);
  const hasTextLayer = pdfText.trim().length >= MIN_CHARS_PER_PAGE * pageCount;

  if (hasTextLayer) {
    return { text: pdfText, pageCount, source: "pdf-text-layer" };
  }

  // Scanned PDF with no real text layer: rasterize each page to a PNG and
  // transcribe it through the vision waterfall (OpenAI -> Gemini x2).
  const doc = await rasterizeOrExplain(buffer);
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
    // pdf-to-img dropped `destroy()` by v4.5; call it only if present.
    const closable = doc as { destroy?: () => unknown };
    if (typeof closable.destroy === "function") await closable.destroy();
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

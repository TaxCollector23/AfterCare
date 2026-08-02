/**
 * Shared grounding/confidence helpers used across every stage and by /ask.
 */
import { CONFIDENCE_THRESHOLD, needsReview, type OcrLine } from '@discharge/shared-types';

export { needsReview, CONFIDENCE_THRESHOLD };

/** User-facing copy shown whenever a result's confidence is below threshold. */
export const REVIEW_WARNING = 'Please check the original document.';

/**
 * Resolves sourceLines back to their original OCR text, for building
 * grounded, quotable answers (e.g. in /ask) instead of just citing numbers.
 */
export function resolveSourceLines(lines: OcrLine[], sourceLines: number[]): string {
  const byLine = new Map(lines.map((l) => [l.line, l.text]));
  return sourceLines
    .filter((n) => byLine.has(n))
    .map((n) => `${n}: ${byLine.get(n)}`)
    .join('\n');
}

/** True when a set of sourceLines actually points at something (non-empty and resolvable). */
export function isGrounded(lines: OcrLine[], sourceLines: number[]): boolean {
  if (sourceLines.length === 0) return false;
  const byLine = new Set(lines.map((l) => l.line));
  return sourceLines.some((n) => byLine.has(n));
}

/**
 * Rendering for grounded answer citations.
 *
 * `AskGroundedResult.source.sourceLines` is already filtered server-side to
 * lines that exist in the document (see pipeline/ask.ts), so this only has to
 * present them. An empty list means the answer was not grounded in the
 * document, and callers must say so rather than printing a citation.
 */

/**
 * "Based on line 4 of your document." / "…lines 4 and 7…" / "…lines 4, 7, and 9…"
 *
 * Returns null when there is nothing to cite. Line numbers are de-duplicated
 * and sorted so the citation reads in document order regardless of the order
 * the model returned them in.
 */
export function citationText(
  sourceLines: readonly number[] | undefined | null,
): string | null {
  if (!sourceLines || sourceLines.length === 0) return null;
  const lines = [...new Set(sourceLines)].sort((a, b) => a - b);

  if (lines.length === 1) return `Based on line ${lines[0]} of your document.`;

  const head = lines.slice(0, -1).join(", ");
  const tail = lines[lines.length - 1];
  const joined =
    lines.length === 2 ? `${head} and ${tail}` : `${head}, and ${tail}`;
  return `Based on lines ${joined} of your document.`;
}

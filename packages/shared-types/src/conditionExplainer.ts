/**
 * Picks the explanation to surface in the condition card.
 *
 * This selects from explanations the pipeline already produced (see
 * apps/api/src/pipeline/explanationGenerator.ts) — there is no extra model call
 * and no new clinical claim. Ungrounded explanations are never eligible: an
 * entry with no source lines was not tied to anything in the patient's own
 * document, so it has no business being the headline card.
 *
 * Note on framing: the pipeline does not extract a diagnosis field, so this is
 * "a key term from your document, explained" and callers must label it that
 * way. It is not a statement of what the patient has.
 */

export interface ExplanationLike {
  plainText: string;
  sourceLines: readonly number[];
  confidence: number;
}

/** Explanations below this confidence are not worth promoting to a card. */
export const MIN_CONDITION_CONFIDENCE = 60;

function earliestLine(explanation: ExplanationLike): number {
  return explanation.sourceLines.reduce(
    (min, line) => (line < min ? line : min),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * The best-grounded explanation, or null when nothing qualifies.
 *
 * Ranking: highest confidence first, then the term appearing earliest in the
 * document — discharge summaries lead with the condition and the procedure, so
 * an earlier citation is the better tie-break.
 */
export function primaryConditionExplanation<T extends ExplanationLike>(
  explanations: readonly T[],
  minConfidence: number = MIN_CONDITION_CONFIDENCE,
): T | null {
  const eligible = explanations.filter(
    (explanation) =>
      explanation.sourceLines.length > 0 &&
      explanation.plainText.trim().length > 0 &&
      explanation.confidence >= minConfidence,
  );
  if (eligible.length === 0) return null;

  return eligible.reduce((best, candidate) => {
    if (candidate.confidence !== best.confidence) {
      return candidate.confidence > best.confidence ? candidate : best;
    }
    return earliestLine(candidate) < earliestLine(best) ? candidate : best;
  });
}

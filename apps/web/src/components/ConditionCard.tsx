import { Link } from "react-router-dom";
import {
  citationText,
  primaryConditionExplanation,
} from "@discharge-guide/shared-types";
import type { GlossaryTerm } from "../types";

/**
 * Condition explainer.
 *
 * Shows the best-grounded explanation the pipeline's explanation stage already
 * produced — no extra model call, no new clinical claim. The pipeline does not
 * extract a diagnosis field, so this is framed as a key term from the
 * document rather than a statement of what the patient has.
 *
 * Renders nothing when no explanation is grounded well enough to promote.
 */
export function ConditionCard({ glossary }: { glossary: GlossaryTerm[] }) {
  const primary = primaryConditionExplanation(
    glossary.map((entry) => ({
      ...entry,
      plainText: entry.plainLanguage,
      sourceLines: entry.sourceLines ?? [],
      confidence: entry.confidence ?? 0,
    })),
  );
  if (!primary) return null;

  const citation = citationText(primary.sourceLines);

  return (
    <div className="card divider-section">
      <span className="kicker">From your document</span>
      <h2 style={{ marginTop: 6 }}>{primary.term}</h2>
      <p className="gloss" style={{ marginTop: 8 }}>
        {primary.plainLanguage}
      </p>
      {citation && (
        <p className="gloss" style={{ fontStyle: "italic", fontSize: 14 }}>
          {citation}
        </p>
      )}
      <Link to="/terms" className="btn-ghost">
        See all explained terms →
      </Link>
    </div>
  );
}

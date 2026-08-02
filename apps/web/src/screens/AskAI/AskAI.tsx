import { useMemo, useState } from "react";
import { RecoveryGate } from "../../components/RecoveryGate";
import { EmptyState } from "../../components/EmptyState";

/** Despite the folder name (matching the original scaffold), this is a plain search
 *  over answers drawn from the patient's own document — not a chatbot, and nothing
 *  is generated live in the browser. */
export default function AskAI() {
  const [query, setQuery] = useState("");

  return (
    <div>
      <h1>Ask a question</h1>
      <p className="gloss measure">
        Search questions answered directly from your own paperwork. This isn't a
        chat — every answer is something your document actually says.
      </p>

      <div className="field" role="search">
        <label htmlFor="faq-search" className="sr-only">
          Search your questions
        </label>
        <input
          id="faq-search"
          type="search"
          placeholder="Search your questions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <RecoveryGate
        emptyState={{
          icon: "ph-question",
          title: "No document answers yet",
          description:
            "Questions and answers grounded in your active recovery guide will appear here when they are available.",
        }}
      >
        {(data) => <FaqList query={query} faq={data.faq} />}
      </RecoveryGate>
    </div>
  );
}

function FaqList({
  query,
  faq,
}: {
  query: string;
  faq: { id: string; question: string; answer: string; sourceLabel?: string }[];
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faq;
    return faq.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q),
    );
  }, [query, faq]);

  if (faq.length === 0) {
    return (
      <EmptyState
        icon="ph-question"
        title="No questions yet"
        description="Once your document is processed, common questions and their answers will appear here."
      />
    );
  }
  if (filtered.length === 0) {
    return <p className="gloss">No matches for &ldquo;{query}&rdquo;.</p>;
  }

  return (
    <div>
      {filtered.map((f) => (
        <div key={f.id} className="card divider-section">
          <h3>{f.question}</h3>
          <p className="gloss" style={{ marginTop: 8 }}>
            {f.answer}
          </p>
          {f.sourceLabel && (
            <p className="gloss" style={{ fontStyle: "italic", fontSize: 14 }}>
              From: {f.sourceLabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

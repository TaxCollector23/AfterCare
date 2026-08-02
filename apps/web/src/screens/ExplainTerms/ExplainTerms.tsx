import { RecoveryGate } from "../../components/RecoveryGate";
import { EmptyState } from "../../components/EmptyState";

export default function ExplainTerms() {
  return (
    <div>
      <h1>Explain these terms</h1>
      <p className="gloss measure">Medical terms found in your document, explained in plain language.</p>
      <RecoveryGate>
        {(data) =>
          data.glossary.length === 0 ? (
            <EmptyState icon="ph-book-open-text" title="No terms yet" description="Once your document is processed, any medical terms it uses will be explained here." />
          ) : (
            <div>
              {data.glossary.map((g) => (
                <div key={g.id} className="card divider-section">
                  <h3>{g.term}</h3>
                  <p className="gloss" style={{ marginTop: 6 }}>
                    {g.plainLanguage}
                  </p>
                  {g.sourceExcerpt && (
                    <p className="gloss" style={{ fontStyle: "italic", fontSize: 14 }}>
                      &ldquo;{g.sourceExcerpt}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </RecoveryGate>
    </div>
  );
}

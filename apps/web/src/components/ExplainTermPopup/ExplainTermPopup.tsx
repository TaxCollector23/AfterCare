import { useState } from "react";
import type { GlossaryTerm } from "../../types";

/** A term drawn from the patient's own document. Click it to see the plain-language meaning inline. */
export function ExplainTermPopup({ term }: { term: GlossaryTerm }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <button
        className="btn-ghost"
        style={{ textDecoration: "underline", textDecorationStyle: "dotted", padding: 0 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {term.term}
      </button>
      {open && (
        <span className="term-popover" role="tooltip">
          {term.plainLanguage}
          {term.sourceExcerpt && (
            <>
              <br />
              <em style={{ opacity: 0.75 }}>&ldquo;{term.sourceExcerpt}&rdquo;</em>
            </>
          )}
        </span>
      )}
    </span>
  );
}

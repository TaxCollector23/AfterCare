import {
  PRIORITY_LABEL,
  PRIORITY_TAG_CLASS,
  type FollowUpAssessment,
} from "@discharge-guide/shared-types";

/**
 * Follow-up priority badge.
 *
 * Always renders the factors that produced the score. The number on its own
 * would read like a clinical verdict; shown with "3 doses with no record of
 * being taken" it reads as what it is — a count of things that already
 * happened. The caption states outright that it isn't a medical assessment.
 */
export function FollowUpBadge({
  assessment,
}: {
  assessment: FollowUpAssessment;
}) {
  const { priority, factors } = assessment;

  return (
    <div className="card divider-section">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Follow-up priority</h2>
        <span className={`tag ${PRIORITY_TAG_CLASS[priority]}`}>
          {PRIORITY_LABEL[priority]}
        </span>
      </div>

      {factors.length === 0 ? (
        <p className="gloss" style={{ marginTop: "var(--sp3)" }}>
          Nothing is outstanding right now — no missed doses, check-ins, or
          appointments.
        </p>
      ) : (
        <ul
          style={{ listStyle: "none", margin: "var(--sp3) 0 0", padding: 0 }}
        >
          {factors.map((factor) => (
            <li key={factor.label} className="list-row">
              <i className="ph-duotone ph-dot-outline" aria-hidden="true" />
              <span style={{ flex: 1 }}>{factor.label}</span>
            </li>
          ))}
        </ul>
      )}

      <p
        className="gloss"
        style={{ fontSize: 14, fontStyle: "italic", marginTop: "var(--sp3)" }}
      >
        This is a reminder of what&rsquo;s outstanding, not a medical
        assessment. It counts what you&rsquo;ve logged &mdash; it doesn&rsquo;t
        judge your health.
      </p>
    </div>
  );
}

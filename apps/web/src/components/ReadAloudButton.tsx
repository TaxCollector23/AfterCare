import { useReadAloud } from "../hooks/useReadAloud";
import { useAccessibility } from "../hooks/useAccessibility";

/** The single accessibility control that lives in the header, per product direction:
 *  no search/notifications/profile/settings clutter up top — just this. */
export function ReadAloudButton() {
  const { readAloudRate } = useAccessibility();
  const { speaking, error, toggle } = useReadAloud(readAloudRate);
  return (
    <span style={{ position: "relative" }}>
      <button className={`readbtn ${speaking ? "on" : ""}`} onClick={toggle} aria-pressed={speaking}>
        <i className={`ph-duotone ${speaking ? "ph-stop-circle" : "ph-speaker-high"}`} aria-hidden="true" />
        {speaking ? "Stop reading" : "Read this page to me"}
      </button>
      {error && (
        <span
          role="alert"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--color-text)",
            color: "var(--color-bg)",
            padding: "8px 12px",
            borderRadius: 4,
            fontSize: 14,
            whiteSpace: "nowrap",
            zIndex: 30,
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
}

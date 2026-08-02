import {
  LINE_SPACING_LABEL,
  READ_ALOUD_RATE_MAX,
  READ_ALOUD_RATE_MIN,
  TEXT_SCALE_LABEL,
} from "@discharge-guide/shared-types";
import { useAccessibility } from "../../hooks/useAccessibility";
import { SignOutButton } from "../../components/SignOutButton";

export default function Accessibility() {
  const a11y = useAccessibility();

  return (
    <div>
      <h1>Accessibility</h1>
      <p className="gloss measure">Make AfterCare comfortable for you. These settings are saved on this device.</p>

      <p className="gloss measure" style={{ fontSize: 15 }}>
        If your phone or computer is already set to reduce motion, use a dark
        theme, or raise contrast, AfterCare follows that the first time you visit.
      </p>

      <div className="card">
        <Row label="Text size">
          {(id) => (
            <div className="flex" role="group" aria-labelledby={id}>
              {(["normal", "large", "largest"] as const).map((v) => (
                <button
                  key={v}
                  className={`chip ${a11y.textScale === v ? "active" : ""}`}
                  aria-pressed={a11y.textScale === v}
                  onClick={() => a11y.update({ textScale: v })}
                >
                  {TEXT_SCALE_LABEL[v]}
                </button>
              ))}
            </div>
          )}
        </Row>
        <Row label="Line spacing">
          {(id) => (
            <div className="flex" role="group" aria-labelledby={id}>
              {(["normal", "relaxed", "loose"] as const).map((v) => (
                <button
                  key={v}
                  className={`chip ${a11y.lineSpacing === v ? "active" : ""}`}
                  aria-pressed={a11y.lineSpacing === v}
                  onClick={() => a11y.update({ lineSpacing: v })}
                >
                  {LINE_SPACING_LABEL[v]}
                </button>
              ))}
            </div>
          )}
        </Row>
        <Row label="High contrast">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.contrast}
              onClick={() => a11y.update({ contrast: !a11y.contrast })}
            />
          )}
        </Row>
        <Row label="Dark mode">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.darkMode}
              onClick={() => a11y.update({ darkMode: !a11y.darkMode })}
            />
          )}
        </Row>
        <Row label="Reduce motion">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.reduceMotion}
              onClick={() => a11y.update({ reduceMotion: !a11y.reduceMotion })}
            />
          )}
        </Row>
        <Row label="Dyslexia-friendly font">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.dyslexiaFont}
              onClick={() => a11y.update({ dyslexiaFont: !a11y.dyslexiaFont })}
            />
          )}
        </Row>
        <Row label="Underline links">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.underlineLinks}
              onClick={() => a11y.update({ underlineLinks: !a11y.underlineLinks })}
            />
          )}
        </Row>
        <Row label="Bigger buttons">
          {(id) => (
            <Toggle
              labelledBy={id}
              on={a11y.largeTargets}
              onClick={() => a11y.update({ largeTargets: !a11y.largeTargets })}
            />
          )}
        </Row>
        <Row label="Read-aloud speed">
          {(id) => (
            <input
              type="range"
              min={READ_ALOUD_RATE_MIN}
              max={READ_ALOUD_RATE_MAX}
              step={0.05}
              value={a11y.readAloudRate}
              aria-labelledby={id}
              aria-valuetext={`${a11y.readAloudRate.toFixed(2)} times normal speed`}
              onChange={(e) => a11y.update({ readAloudRate: Number(e.target.value) })}
            />
          )}
        </Row>
      </div>

      <div style={{ marginTop: "var(--sp6)" }}>
        <SignOutButton />
      </div>
    </div>
  );
}

/**
 * A setting row. The control is a render prop so it can point back at this
 * row's label: without that, every toggle announces only as "Off, button",
 * which is useless on a screen with eight of them.
 */
function Row({
  label,
  children,
}: {
  label: string;
  children: (labelId: string) => React.ReactNode;
}) {
  const labelId = `a11y-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div
      className="row-between"
      style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)", flexWrap: "wrap", gap: 8 }}
    >
      <span id={labelId}>{label}</span>
      {children(labelId)}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  labelledBy,
}: {
  on: boolean;
  onClick: () => void;
  labelledBy: string;
}) {
  return (
    <button
      className={`chip ${on ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={on}
      aria-labelledby={labelledBy}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

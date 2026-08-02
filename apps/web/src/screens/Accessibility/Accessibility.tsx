import { useAccessibility } from "../../hooks/useAccessibility";
import { signOut } from "../../services/session";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Accessibility() {
  const a11y = useAccessibility();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <h1>Accessibility</h1>
      <p className="gloss measure">Make AfterCare comfortable for you. These settings are saved on this device.</p>

      <div className="card">
        <Row label="Text size" htmlFor="text-size">
          {/* "A"/"A+"/"A++" is meaningless to a screen reader, and without a
              group the three buttons are read as unrelated controls. */}
          <div className="flex" role="group" aria-label="Text size" id="text-size">
            {TEXT_SCALES.map(({ value, glyph, name }) => (
              <button
                key={value}
                className={`chip ${a11y.textScale === value ? "active" : ""}`}
                aria-label={name}
                aria-pressed={a11y.textScale === value}
                onClick={() => a11y.update({ textScale: value })}
              >
                <span aria-hidden="true">{glyph}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row label="High contrast">
          <Toggle label="High contrast" on={a11y.contrast} onClick={() => a11y.update({ contrast: !a11y.contrast })} />
        </Row>
        <Row label="Dark mode">
          <Toggle label="Dark mode" on={a11y.darkMode} onClick={() => a11y.update({ darkMode: !a11y.darkMode })} />
        </Row>
        <Row label="Reduce motion">
          <Toggle label="Reduce motion" on={a11y.reduceMotion} onClick={() => a11y.update({ reduceMotion: !a11y.reduceMotion })} />
        </Row>
        <Row label="Dyslexia-friendly font">
          <Toggle label="Dyslexia-friendly font" on={a11y.dyslexiaFont} onClick={() => a11y.update({ dyslexiaFont: !a11y.dyslexiaFont })} />
        </Row>
        <Row label="Read-aloud speed" htmlFor="read-aloud-rate">
          <input
            id="read-aloud-rate"
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={a11y.readAloudRate}
            // A bare slider announces only a number; say what the number means.
            aria-label="Read-aloud speed"
            aria-valuetext={`${a11y.readAloudRate.toFixed(2)} times normal speed`}
            onChange={(e) => a11y.update({ readAloudRate: Number(e.target.value) })}
          />
        </Row>
      </div>

      {user && !user.isLocal && (
        <button
          className="btn btn-outline"
          style={{ marginTop: "var(--sp6)" }}
          onClick={async () => {
            await signOut();
            await refresh();
            navigate("/");
          }}
        >
          <i className="ph-duotone ph-sign-out" aria-hidden="true" /> Sign out
        </button>
      )}
    </div>
  );
}

const TEXT_SCALES = [
  { value: "normal", glyph: "A", name: "Normal text size" },
  { value: "large", glyph: "A+", name: "Large text size" },
  { value: "largest", glyph: "A++", name: "Largest text size" },
] as const;

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      {children}
    </div>
  );
}

/** On/Off chip. The visible text alone doesn't say what is being toggled. */
function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`chip ${on ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

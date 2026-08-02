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
        <Row label="Text size">
          <div className="flex">
            {(["normal", "large", "largest"] as const).map((v) => (
              <button key={v} className={`chip ${a11y.textScale === v ? "active" : ""}`} onClick={() => a11y.update({ textScale: v })}>
                {v === "normal" ? "A" : v === "large" ? "A+" : "A++"}
              </button>
            ))}
          </div>
        </Row>
        <Row label="High contrast">
          <Toggle on={a11y.contrast} onClick={() => a11y.update({ contrast: !a11y.contrast })} />
        </Row>
        <Row label="Dark mode">
          <Toggle on={a11y.darkMode} onClick={() => a11y.update({ darkMode: !a11y.darkMode })} />
        </Row>
        <Row label="Reduce motion">
          <Toggle on={a11y.reduceMotion} onClick={() => a11y.update({ reduceMotion: !a11y.reduceMotion })} />
        </Row>
        <Row label="Dyslexia-friendly font">
          <Toggle on={a11y.dyslexiaFont} onClick={() => a11y.update({ dyslexiaFont: !a11y.dyslexiaFont })} />
        </Row>
        <Row label="Read-aloud speed">
          <input
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={a11y.readAloudRate}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`chip ${on ? "active" : ""}`} onClick={onClick} aria-pressed={on}>
      {on ? "On" : "Off"}
    </button>
  );
}

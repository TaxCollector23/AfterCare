import { useState } from "react";
import { NavLink } from "react-router-dom";

const PRIMARY = [
  { to: "/dashboard", label: "Home", icon: "ph-rows" },
  { to: "/medications", label: "Meds", icon: "ph-pill" },
  { to: "/timeline", label: "Timeline", icon: "ph-clock-counter-clockwise" },
  { to: "/appointments", label: "Visits", icon: "ph-calendar-check" },
];

const MORE = [
  { to: "/upload", label: "Documents", icon: "ph-file-text" },
  { to: "/terms", label: "Explain Terms", icon: "ph-book-open-text" },
  { to: "/ask", label: "Ask a Question", icon: "ph-question" },
  { to: "/emergency", label: "When to Get Help", icon: "ph-first-aid-kit" },
  { to: "/caregiver", label: "Caregiver Access", icon: "ph-users-three" },
  { to: "/accessibility", label: "Accessibility", icon: "ph-person-simple-circle" },
];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {PRIMARY.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <i className={`ph-duotone ${item.icon}`} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
      <button
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 4px 8px", fontSize: 12, color: "var(--n600)" }}
      >
        <i className="ph-duotone ph-dots-three-outline" style={{ fontSize: 22 }} aria-hidden="true" />
        More
      </button>
      {moreOpen && (
        <div className="more-sheet" role="menu">
          {MORE.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
              <i className={`ph-duotone ${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

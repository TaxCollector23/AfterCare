import type { ReactNode } from "react";

export function Card({ title, icon, children }: { title?: string; icon?: string; children: ReactNode }) {
  return (
    <section className="card divider-section">
      {title && (
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <i className={`ph-duotone ${icon}`} aria-hidden="true" />}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

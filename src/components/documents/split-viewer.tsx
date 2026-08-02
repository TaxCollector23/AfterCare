"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { docSections } from "@/lib/document-data";
import { cn } from "@/lib/utils";

export function SplitViewer() {
  const [activeId, setActiveId] = React.useState<string | null>(docSections[0].id);
  const explanationRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  function select(id: string) {
    setActiveId(id);
    explanationRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: mock original PDF */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-(--color-border) px-5 py-4">
          <FileText className="h-5 w-5 text-(--color-text-secondary)" aria-hidden="true" />
          <p className="text-body font-semibold">Original Discharge Summary</p>
        </div>
        <div className="p-6 sm:p-8 bg-[repeating-linear-gradient(transparent,transparent_31px,var(--color-border)_32px)] max-h-[640px] overflow-y-auto">
          <div className="font-mono text-small leading-8 text-(--color-text-secondary) space-y-1">
            <p className="text-(--color-text-primary) font-semibold mb-4">
              BAYVIEW GENERAL HOSPITAL — DISCHARGE SUMMARY
            </p>
            {docSections.map((s) => (
              <button
                key={s.id}
                onClick={() => select(s.id)}
                aria-pressed={activeId === s.id}
                aria-label={`Highlight: ${s.tag}`}
                className={cn(
                  "block w-full text-left rounded-md px-2 py-2 -mx-2 transition-colors duration-150",
                  activeId === s.id
                    ? "bg-(--color-amber-tint) ring-2 ring-(--color-amber)"
                    : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                )}
              >
                {s.original}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: human explanation */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-(--color-border) px-5 py-4">
          <span className="h-5 w-5 rounded-full bg-(--color-green) inline-flex items-center justify-center text-white text-[11px] font-bold" aria-hidden="true">
            ✓
          </span>
          <p className="text-body font-semibold">What This Means</p>
        </div>
        <div className="p-6 sm:p-8 max-h-[640px] overflow-y-auto flex flex-col gap-4">
          {docSections.map((s) => (
            <div
              key={s.id}
              ref={(el) => {
                explanationRefs.current[s.id] = el;
              }}
              role="button"
              tabIndex={0}
              onClick={() => setActiveId(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveId(s.id);
                }
              }}
              className={cn(
                "rounded-xl border p-4 cursor-pointer transition-colors duration-150",
                activeId === s.id
                  ? "border-(--color-amber) bg-(--color-amber-tint)"
                  : "border-(--color-border) hover:border-(--color-border-strong)"
              )}
            >
              <span className="inline-block mb-2 rounded-full bg-(--color-blue-tint) px-2.5 py-0.5 text-small font-semibold text-(--color-blue-dark)">
                {s.tag}
              </span>
              <p className="text-body text-(--color-text-primary)">{s.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
